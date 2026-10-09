// Privacy Gateway - Enforces strict privacy rules, opt-in consent, TTL, and category filtering
const crypto = require('crypto');
const db = require('../store/memoryDb');

// Per-process random salt: session ids written to logs/analytics are one-way HMAC digests
// that cannot be reversed or correlated across server restarts.
const LOG_SALT = process.env.VOICECUE_LOG_SALT || crypto.randomBytes(32).toString('hex');

// Coarse categories the on-device extractor is allowed to emit.
const BASE_KNOWN_CATEGORIES = [
  'food.pizza', 'gaming.gear', 'beverages.energy', 'clothing.footwear', 'general.contextual'
];

const SENSITIVE_CATEGORIES = [
  'health', 'medical', 'politics', 'religion',
  'sexuality', 'gambling', 'alcohol', 'finance.crypto', 'minors'
];

class PrivacyGateway {
  hashSessionId(anonSessionId) {
    return 'h_' + crypto.createHmac('sha256', LOG_SALT).update(String(anonSessionId)).digest('hex').slice(0, 16);
  }

  getKnownCategories() {
    const fromCampaigns = db.campaigns.map(c => String(c.category || '').toLowerCase()).filter(Boolean);
    return Array.from(new Set([...BASE_KNOWN_CATEGORIES, ...fromCampaigns]));
  }

  isSensitive(category) {
    return SENSITIVE_CATEGORIES.some(cat => category.includes(cat));
  }

  // Validate incoming coarse signal. Any raw keyword / transcript fields are ignored and never stored.
  processSignal({ anonSessionId, category, confidence = null }) {
    // 1. Consent check (do not create sessions for unknown ids)
    const session = db.sessions.get(anonSessionId);
    if (!session || !session.consented) {
      return {
        accepted: false,
        code: 'UNCONSENTED',
        reason: 'UNCONSENTED: Player has not activated Smart Recommendations'
      };
    }

    const normalized = String(category).trim().toLowerCase();

    // 2. Sensitive category hard-block (GDPR / COPPA compliance)
    if (this.isSensitive(normalized)) {
      return {
        accepted: false,
        code: 'SENSITIVE_CATEGORY',
        reason: `DROPPED_BY_PRIVACY_GATEWAY: Category '${normalized}' violates brand safety / sensitive policy.`
      };
    }

    // 3. Studio blocklist check
    const studioBlocked = db.studioPolicy.blockedCategories || [];
    if (studioBlocked.some(blocked => normalized.includes(String(blocked).toLowerCase()))) {
      return {
        accepted: false,
        code: 'STUDIO_BLOCKED',
        reason: `STUDIO_BLOCKED: Category '${normalized}' is disallowed by game server policies.`
      };
    }

    // 4. Known-category check
    if (!this.getKnownCategories().includes(normalized)) {
      return {
        accepted: false,
        code: 'UNKNOWN_CATEGORY',
        reason: `UNKNOWN_CATEGORY: '${normalized}' is not a recognized coarse category.`
      };
    }

    // 5. Ingest signal with 10-minute TTL (category + confidence only)
    const storedSignal = db.addIntentSignal(anonSessionId, normalized, confidence);

    // Privacy log: only hashed session id + category
    db.analytics.recentEvents.unshift({
      type: 'INTENT_INGESTED',
      anonSessionHash: this.hashSessionId(anonSessionId),
      category: normalized,
      ttlMinutes: 10,
      timestamp: new Date().toISOString()
    });
    if (db.analytics.recentEvents.length > 50) db.analytics.recentEvents.pop();

    return {
      accepted: true,
      category: storedSignal.category,
      confidence: storedSignal.confidence,
      ttlExpiresAt: storedSignal.ttlExpiresAt,
      message: 'Signal securely stored with 10-minute expiration. Only the coarse category is kept; no raw audio or text preserved.'
    };
  }

  // Wipes all data for the player (Right to be Forgotten)
  forgetPlayer(anonSessionId) {
    const existed = db.deleteSession(anonSessionId);
    const hash = this.hashSessionId(anonSessionId);
    db.analytics.recentEvents = db.analytics.recentEvents.filter(e => e.anonSessionHash !== hash);
    return {
      success: true,
      sessionExisted: existed,
      message: 'All signals and tokens for this session purged immediately.'
    };
  }
}

module.exports = new PrivacyGateway();
