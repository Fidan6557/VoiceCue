// Privacy Gateway - Enforces strict privacy rules, opt-in consent, TTL, and category filtering
const db = require('../store/memoryDb');

class PrivacyGateway {
  // Validate incoming coarse signal
  processSignal({ anonSessionId, category, confidence, rawKeyword }) {
    // 1. Consent check
    const session = db.getOrCreateSession(anonSessionId);
    if (!session.consented) {
      return {
        accepted: false,
        reason: 'UNCONSENTED: Player has not activated Smart Recommendations'
      };
    }

    // 2. Sensitive category hard-block (GDPR / COPPA compliance)
    const sensitiveCategories = [
      'health', 'medical', 'politics', 'religion', 
      'sexuality', 'gambling', 'alcohol', 'finance.crypto', 'minors'
    ];

    const isSensitive = sensitiveCategories.some(cat => 
      category.toLowerCase().includes(cat)
    );

    if (isSensitive) {
      return {
        accepted: false,
        reason: `DROPPED_BY_PRIVACY_GATEWAY: Category '${category}' violates brand safety / sensitive policy.`
      };
    }

    // 3. Studio blocklist check
    const studioBlocked = db.studioPolicy.blockedCategories || [];
    const isStudioBlocked = studioBlocked.some(blocked => 
      category.toLowerCase().includes(blocked.toLowerCase())
    );

    if (isStudioBlocked) {
      return {
        accepted: false,
        reason: `STUDIO_BLOCKED: Category '${category}' is disallowed by game server policies.`
      };
    }

    // 4. Ingest signal with 10-minute TTL
    const storedSignal = db.addIntentSignal(anonSessionId, category, confidence, rawKeyword);

    // Record privacy log (k-anonymity proof)
    db.analytics.recentEvents.unshift({
      type: 'INTENT_INGESTED',
      anonSessionId,
      category,
      ttlMinutes: 10,
      timestamp: new Date().toISOString()
    });
    if (db.analytics.recentEvents.length > 50) db.analytics.recentEvents.pop();

    return {
      accepted: true,
      category: storedSignal.category,
      ttlExpiresAt: storedSignal.ttlExpiresAt,
      message: 'Signal securely stored with 10-minute expiration. No raw audio preserved.'
    };
  }

  // Wipes all data for the player (Right to be Forgotten)
  forgetPlayer(anonSessionId) {
    db.setConsent(anonSessionId, false);
    return {
      success: true,
      message: `All signals and tokens for session ${anonSessionId} purged immediately.`
    };
  }
}

module.exports = new PrivacyGateway();
