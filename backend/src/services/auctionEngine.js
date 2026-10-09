// Ad Decision Engine - Second-Price Auction (Vickrey Auction), Pacing & Relevance Matching
const db = require('../store/memoryDb');

class AuctionEngine {
  decideAdForSlot({ slotId, anonSessionId }) {
    // 1. Locate slot
    const slot = db.slots.find(s => s.id === slotId && s.active);
    if (!slot) {
      return { success: false, error: 'SlotNotFoundOrInactive' };
    }

    // 2. Fetch player's active unexpired intent
    const intentSignal = db.getLatestValidSignal(anonSessionId);

    // 3. Filter active, approved campaigns matching slot aspect ratio
    let eligibleCampaigns = db.campaigns.filter(c => 
      c.status === 'active' && 
      c.moderationStatus === 'approved' &&
      c.targetSlotAspect === slot.aspectRatio &&
      c.spentToday < c.dailyBudget &&
      c.bidCpm >= slot.floorPriceCpm
    );

    // Category / Keyword Matcher
    if (intentSignal && intentSignal.category) {
      const targetCategory = intentSignal.category.toLowerCase();
      const matched = eligibleCampaigns.filter(c => {
        const catMatch = c.category.toLowerCase() === targetCategory || 
                         c.category.toLowerCase().startsWith(targetCategory.split('.')[0]);
        const keywordMatch = intentSignal.rawKeyword && c.keywords.some(kw => 
          intentSignal.rawKeyword.toLowerCase().includes(kw.toLowerCase())
        );
        return catMatch || keywordMatch;
      });

      // If we have targeted matches, prioritize them!
      if (matched.length > 0) {
        eligibleCampaigns = matched;
      }
    }

    if (eligibleCampaigns.length === 0) {
      return {
        success: false,
        slotId,
        message: 'No eligible bids for this slot criteria. Displaying default ambient game texture.'
      };
    }

    // 4. Run Second-Price Auction (Vickrey Auction)
    // Sort by bid descending
    eligibleCampaigns.sort((a, b) => b.bidCpm - a.bidCpm);

    const winner = eligibleCampaigns[0];
    let winningCpm = slot.floorPriceCpm;

    if (eligibleCampaigns.length > 1) {
      const runnerUp = eligibleCampaigns[1];
      // Second price + 1 cent, bounded by winner's max bid
      winningCpm = Math.min(winner.bidCpm, Number((runnerUp.bidCpm + 0.01).toFixed(2)));
    } else {
      winningCpm = Math.max(slot.floorPriceCpm, Number((winner.bidCpm * 0.75).toFixed(2)));
    }

    // 5. Calculate Revenue Split (70% studio / 30% platform)
    const costPerImpression = winningCpm / 1000;
    const studioShare = Number((costPerImpression * db.studioPolicy.revShareStudio).toFixed(5));
    const platformShare = Number((costPerImpression * (1 - db.studioPolicy.revShareStudio)).toFixed(5));

    // Update campaign spend & analytics
    winner.spentToday = Number((winner.spentToday + costPerImpression).toFixed(4));
    db.analytics.totalImpressions += 1;
    db.analytics.totalSpendGross = Number((db.analytics.totalSpendGross + costPerImpression).toFixed(2));
    db.analytics.studioPayout = Number((db.analytics.studioPayout + (costPerImpression * 0.7)).toFixed(2));
    db.analytics.platformFee = Number((db.analytics.platformFee + (costPerImpression * 0.3)).toFixed(2));

    // Update slot's current rendered ad
    slot.currentAd = {
      campaignId: winner.id,
      brandName: winner.brandName,
      headline: winner.headline,
      couponCode: winner.couponCode,
      updatedAt: Date.now()
    };

    // Record event
    db.analytics.recentEvents.unshift({
      type: 'AUCTION_WON',
      slotId: slot.id,
      brand: winner.brandName,
      winningCpm: `$${winningCpm}`,
      intentTriggered: intentSignal ? intentSignal.category : 'contextual_fallback',
      timestamp: new Date().toISOString()
    });
    if (db.analytics.recentEvents.length > 50) db.analytics.recentEvents.pop();

    return {
      success: true,
      auction: {
        slotId: slot.id,
        slotName: slot.name,
        winningBrand: winner.brandName,
        winningCpm,
        competingBiddersCount: eligibleCampaigns.length,
        studioEarnings: `$${(studioShare * 1000).toFixed(2)}/1k`,
        platformFee: `$${(platformShare * 1000).toFixed(2)}/1k`
      },
      creative: {
        id: winner.id,
        brand: winner.brandName,
        headline: winner.headline,
        callToAction: winner.callToAction,
        tagline: winner.tagline,
        couponCode: winner.couponCode,
        bannerBg: winner.bannerBg,
        bannerAccent: winner.bannerAccent,
        accentIcon: winner.accentIcon,
        aspectRatio: slot.aspectRatio,
        pixelResolution: `${slot.pixelWidth}x${slot.pixelHeight}`,
        sponsoredNotice: 'Sponsored • VoiceCue Verified',
        whyThisAd: intentSignal 
          ? `You opted into Smart Recommendations and recently mentioned interest in "${intentSignal.category.replace('.', ' ')}". No raw audio or text leaves your device.`
          : 'Contextual game world recommendation.'
      }
    };
  }
}

module.exports = new AuctionEngine();
