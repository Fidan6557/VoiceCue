// Three-Layer Moderation Pipeline (L1 Rules, L2 AI Classifier, L3 Studio Human Review)
const db = require('../store/memoryDb');
const { v4: uuidv4 } = require('uuid');

// Rule-based (not ML) creative screening helpers.
const LEET_MAP = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'i', '+': 't' };

// Normalize obfuscation: leetspeak, separators inside words ("k.i.l.l"),
// spaced single letters ("k i l l"), repeated letters ("kiiill" -> "kill").
function normalizeText(raw) {
  let t = String(raw || '').toLowerCase();
  // Leet substitution only when the char is adjacent to a letter (keeps "100%" / "1xbet" intact-ish).
  t = t.replace(/[013457@$!|+8]/g, (ch, i, str) => {
    const prev = str[i - 1] || ''; const next = str[i + 1] || '';
    return /[a-z]/.test(prev) || /[a-z]/.test(next) ? LEET_MAP[ch] : ch;
  });
  t = t.replace(/([a-z])[.\-_*]+(?=[a-z])/g, '$1'); // k.i.l.l / h-a-t-e
  // Collapse runs of >=3 single letters separated by spaces: "k i l l" -> "kill"
  t = t.replace(/\b(?:[a-z] ){2,}[a-z]\b/g, m => m.replace(/ /g, ''));
  t = t.replace(/([a-z])\1{2,}/g, '$1'); // kiiiill -> kill
  return t.replace(/[^a-z0-9%\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Whole-word / whole-phrase rules. Word boundaries avoid false positives such as
// "skill" (kill), "class"/"assessment" (ass), "scunthorpe"-style substrings.
const BANNED_RULES = [
  { term: 'casino', category: 'gambling' },
  { term: 'betting', category: 'gambling' },
  { term: 'gambling', category: 'gambling' },
  { term: '1xbet', category: 'gambling' },
  { term: 'porn', category: 'adult' },
  { term: 'nsfw', category: 'adult' },
  { term: 'weapon', category: 'violence', plural: true },
  { term: 'kill', category: 'violence', plural: true },
  { term: 'hate', category: 'hate', plural: true },
  { term: 'crypto', category: 'financial_scam' },
  { term: 'quick money', category: 'financial_scam' },
  { term: 'get rich quick', category: 'financial_scam' }
].map(r => {
  const body = r.term.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return { ...r, re: new RegExp(`\\b${body}${r.plural ? '(?:s|z|er|ers|ing)?' : ''}\\b`, 'i') };
});

function findViolations(text) {
  const normalized = normalizeText(text);
  // Also check the plain lowercased text so terms containing digits ("1xbet") survive.
  const plain = String(text || '').toLowerCase().replace(/[^a-z0-9%\s]+/g, ' ');
  const reasons = [];
  for (const rule of BANNED_RULES) {
    const m = normalized.match(rule.re) || plain.match(rule.re);
    if (m) reasons.push({ term: rule.term, matched: m[0], category: rule.category });
  }
  return { normalized, reasons };
}

class ModerationPipeline {
  // L1: Heuristic & Pattern Check (word-boundary + obfuscation normalization)
  checkL1Rules(campaignData) {
    const textToCheck = `${campaignData.headline || ''} ${campaignData.tagline || ''} ${campaignData.callToAction || ''}`;
    const { reasons } = findViolations(textToCheck);

    if (reasons.length) {
      return {
        passed: false,
        layer: 'L1_RULES',
        reason: `Violates prohibited keywords policy: found ${reasons.map(r => `'${r.term}'`).join(', ')}`,
        reasons
      };
    }

    return { passed: true, layer: 'L1_RULES', reasons: [] };
  }

  // L2: Heuristic brand-safety signals. NOT an ML classifier and NOT random:
  // riskScore is a deterministic heuristic derived from observable copy features.
  evaluateL2AI(campaignData) {
    const text = `${campaignData.headline || ''} ${campaignData.tagline || ''} ${campaignData.callToAction || ''}`;
    const reasons = [];
    let risk = 0;
    const letters = text.replace(/[^A-Za-z]/g, '');
    const upperRatio = letters.length ? letters.replace(/[^A-Z]/g, '').length / letters.length : 0;
    if (letters.length > 8 && upperRatio > 0.7) { risk += 0.15; reasons.push('EXCESSIVE_CAPS'); }
    if ((text.match(/!/g) || []).length >= 3) { risk += 0.1; reasons.push('EXCESSIVE_EXCLAMATION'); }
    if (/\b(urgent|act now|click here|100% guarantee|limited time)\b/i.test(normalizeText(text))) { risk += 0.2; reasons.push('PRESSURE_LANGUAGE'); }
    if ((campaignData.headline || '').trim().length < 5) { risk += 0.1; reasons.push('HEADLINE_TOO_SHORT'); }
    const { reasons: banned } = findViolations(text);
    if (banned.length) { risk += 0.6; reasons.push(...banned.map(b => `PROHIBITED_TERM:${b.term}`)); }
    risk = Math.min(1, Math.round(risk * 100) / 100);

    return {
      passed: risk < 0.5,
      layer: 'L2_HEURISTIC_CLASSIFIER',
      // Heuristic score (1 - risk), not a calibrated probability.
      score: Number((1 - risk).toFixed(2)),
      confidence: (1 - risk).toFixed(2), // kept for backward compat; equals score
      riskScore: risk,
      reasons,
      flags: {
        heuristicReasons: reasons,
        brandSafetyScore: ((1 - risk) * 100).toFixed(1) + '%'
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
module.exports.normalizeText = normalizeText;
module.exports.findViolations = findViolations;
