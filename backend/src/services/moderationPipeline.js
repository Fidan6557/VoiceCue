// Three-Layer Moderation Pipeline (L1 Rules, L2 AI Classifier, L3 Studio Human Review)
const db = require('../store/memoryDb');
const { v4: uuidv4 } = require('uuid');

class ModerationPipeline {
  // L1: Heuristic & Pattern Check
  checkL1Rules(campaignData) {
    const textToCheck = `${campaignData.headline || ''} ${campaignData.tagline || ''} ${campaignData.callToAction || ''}`.toLowerCase();
    
    const hardBannedWords = [
      'casino', 'betting', 'gambling', '1xbet', 'porn', 'nsfw', 
      'weapon', 'crypto', 'quick money', 'get rich quick'
    ];

    for (const word of hardBannedWords) {
      if (textToCheck.includes(word)) {
        return {
          passed: false,
          layer: 'L1_RULES',
          reason: `Violates prohibited keywords policy: found '${word}'`
        };
      }
    }

    return { passed: true, layer: 'L1_RULES' };
  }

  // L2: AI Multimodal Evaluation (Simulated or proxied to ML container)
  evaluateL2AI(campaignData) {
    // Check brand safety confidence
    const riskFactor = Math.random() * 0.15; // Low risk default for approved brands
    const isClean = riskFactor < 0.25;

    return {
      passed: isClean,
      layer: 'L2_AI_CLASSIFIER',
      confidence: (1 - riskFactor).toFixed(2),
      flags: {
        nsfw: 'CLEAR (0.01)',
        toxicity: 'CLEAR (0.02)',
        brandSafetyScore: (98.5 - riskFactor * 10).toFixed(1) + '%'
      }
    };
  }

  // Process a new campaign creative through pipeline
  ingestCreativeForReview(campaignData) {
    // 1. Layer 1 Check
    const l1Result = this.checkL1Rules(campaignData);
    if (!l1Result.passed) {
      return {
        status: 'rejected',
        reason: l1Result.reason,
        stage: 'L1_RULES'
      };
    }

    // 2. Layer 2 Check
    const l2Result = this.evaluateL2AI(campaignData);

    // 3. Layer 3 Queue placement
    const modItem = {
      id: `mod_${uuidv4().slice(0, 8)}`,
      campaignId: campaignData.id || `camp_${Date.now()}`,
      brandName: campaignData.brandName,
      headline: campaignData.headline,
      category: campaignData.category,
      riskScore: 1 - parseFloat(l2Result.confidence),
      aiCheck: l2Result.flags,
      status: 'pending_studio_review',
      submittedAt: new Date().toISOString()
    };

    db.moderationQueue.unshift(modItem);
    return {
      status: 'queued_for_review',
      moderationId: modItem.id,
      l1: l1Result,
      l2: l2Result
    };
  }

  // Studio Admin decision (Approve or Reject)
  reviewItem(modId, decision, reviewer = 'StudioAdmin') {
    const item = db.moderationQueue.find(m => m.id === modId);
    if (!item) return { success: false, error: 'ItemNotFound' };

    item.status = decision === 'approve' ? 'approved' : 'rejected';
    item.reviewedBy = reviewer;
    item.reviewedAt = new Date().toISOString();

    // If campaign exists in DB, update status
    const camp = db.campaigns.find(c => c.id === item.campaignId);
    if (camp) {
      camp.moderationStatus = item.status;
      if (decision === 'approve') camp.status = 'active';
    }

    return { success: true, item };
  }
}

module.exports = new ModerationPipeline();
