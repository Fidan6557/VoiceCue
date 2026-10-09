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
      // Budget: must be able to afford one impression at its own max bid (price never exceeds own bid)
      (c.dailyBudget - c.spentToday) >= c.bidCpm / 1000 &&
      c.bidCpm >= slot.floorPriceCpm
    );

    // Category / Keyword Matcher
    if (intentSignal && intentSignal.category) {
      const targetCategory = intentSignal.category.toLowerCase();
      const matched = eligibleCampaigns.filter(c => {
        const catMatch = c.category.toLowerCase() === targetCategory || 
                         c.category.toLowerCase().startsWith(targetCategory.split('.')[0]);
        // Raw keywords are never stored server-side, so matching is category-only.
        return catMatch;
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
    // Deterministic ordering: bid desc, then campaign id asc as tie-breaker (no randomness).
    eligibleCampaigns.sort((a, b) => (b.bidCpm - a.bidCpm) || String(a.id).localeCompare(String(b.id)));

    const winner = eligibleCampaigns[0];
    const INCREMENT = 0.01;
    // Clearing price = max(second-highest bid, floor) + increment, never above winner's own bid.
    // Single bidder: second price is the floor.
    const secondBid = eligibleCampaigns.length > 1 ? eligibleCampaigns[1].bidCpm : slot.floorPriceCpm;
    const clearing = Math.max(secondBid, slot.floorPriceCpm) + INCREMENT;
    const winningCpm = Number(Math.min(winner.bidCpm, clearing).toFixed(2));
    const pricingRule = eligibleCampaigns.length > 1 ? 'second_price_plus_increment' : 'floor_plus_increment';

    // 5. Calculate Revenue Split (70% studio / 30% platform)
    const costPerImpression = winningCpm / 1000;
    const studioShare = Number((costPerImpression * db.studioPolicy.revShareStudio).toFixed(5));
    const platformShare = Number((costPerImpression * (1 - db.studioPolicy.revShareStudio)).toFixed(5));

    // Update campaign spend & analytics
    winner.spentToday = Number((winner.spentToday + costPerImpression).toFixed(6));
    db.analytics.totalImpressions += 1;
    // Keep sub-cent precision so per-impression amounts are not rounded away
    db.analytics.totalSpendGross = Number((db.analytics.totalSpendGross + costPerImpression).toFixed(5));
    db.analytics.studioPayout = Number((db.analytics.studioPayout + studioShare).toFixed(5));
    db.analytics.platformFee = Number((db.analytics.platformFee + platformShare).toFixed(5));

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
        winnerBidCpm: winner.bidCpm,
        floorPriceCpm: slot.floorPriceCpm,
        pricingRule,
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
          ? `You opted into Smart Recommendations and recently showed interest in the "${intentSignal.category.replace('.', ' ')}" category. Only that coarse category is shared; no raw audio or text is stored.`
          : 'Contextual game world recommendation.'
      }
    };
  }
}

module.exports = new AuctionEngine();
