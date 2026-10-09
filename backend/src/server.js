const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./store/memoryDb');
const privacyGateway = require('./services/privacyGateway');
const auctionEngine = require('./services/auctionEngine');
const moderationPipeline = require('./services/moderationPipeline');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve frontend production build if present
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'VoiceCue B2B Core Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// --- PRIVACY & CONSENT ROUTES ---

// Get player session state
app.get('/api/privacy/status/:sessionId', (req, res) => {
  const session = db.getOrCreateSession(req.params.sessionId);
  // Expose only coarse signal fields
  res.json({ ...session, signals: session.signals.map(({ category, confidence, timestamp, ttlExpiresAt }) => ({ category, confidence, timestamp, ttlExpiresAt })) });
});

// Player toggles opt-in / opt-out
app.post('/api/privacy/consent', (req, res) => {
  const { sessionId, consented, ageVerified } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });
  if (typeof consented !== 'boolean') return res.status(400).json({ error: 'consented (boolean) is required' });
  
  const session = db.setConsent(sessionId, !!consented, ageVerified !== false);
  res.json({
    success: true,
    session,
    message: consented 
      ? 'Consent granted for smart contextual voice recommendations. 10-min TTL active.' 
      : 'Consent revoked. All local signals purged immediately.'
  });
});

// Right to be forgotten (Instant wipe)
app.post('/api/privacy/forget', (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const result = privacyGateway.forgetPlayer(sessionId);
  res.json(result);
});

// --- INTENT SIGNAL INGESTION ---

app.post('/api/intent/signal', (req, res) => {
  // NOTE: raw keyword / transcript fields (e.g. rawKeyword) are intentionally ignored and never stored or logged.
  const { anonSessionId, category, confidence } = req.body || {};
  if (!anonSessionId || typeof anonSessionId !== 'string' || !category || typeof category !== 'string') {
    return res.status(400).json({ accepted: false, code: 'BAD_REQUEST', error: 'anonSessionId and category (strings) required' });
  }

  // Confidence: optional. Missing -> null (never fabricated). Present -> must be a finite number, clamped to [0,1].
  let conf = null;
  if (confidence !== undefined && confidence !== null) {
    const n = Number(confidence);
    if (typeof confidence === 'boolean' || !Number.isFinite(n)) {
      return res.status(400).json({ accepted: false, code: 'BAD_REQUEST', error: 'confidence must be a number in [0,1]' });
    }
    conf = Math.min(1, Math.max(0, n));
  }

  const result = privacyGateway.processSignal({ anonSessionId, category, confidence: conf });

  if (!result.accepted) {
    const status = result.code === 'UNKNOWN_CATEGORY' ? 400 : 403;
    return res.status(status).json({ ...result, error: result.reason });
  }

  res.json(result);
});

// --- AUCTION & AD DECISION ---

app.post('/api/auction/decide', (req, res) => {
  const { slotId, anonSessionId } = req.body;
  if (!slotId) return res.status(400).json({ error: 'slotId required' });

  const decision = auctionEngine.decideAdForSlot({ slotId, anonSessionId });
  res.json(decision);
});

// --- SLOTS MANAGEMENT (STUDIO CONSOLE) ---

app.get('/api/slots', (req, res) => {
  res.json(db.slots);
});

app.post('/api/slots', (req, res) => {
  const newSlot = {
    id: req.body.id || `slot_${Date.now()}`,
    gameId: req.body.gameId || 'minecraft_world_alpha',
    name: req.body.name || 'Custom In-Game Slot',
    type: req.body.type || 'painting',
    aspectRatio: req.body.aspectRatio || '2:1',
    blockWidth: req.body.blockWidth || 2,
    blockHeight: req.body.blockHeight || 1,
    pixelWidth: req.body.pixelWidth || 256,
    pixelHeight: req.body.pixelHeight || 128,
    location: req.body.location || { x: 0, y: 0, z: 0 },
    floorPriceCpm: req.body.floorPriceCpm || 5.0,
    active: true,
    currentAd: null
  };
  db.slots.push(newSlot);
  res.status(201).json(newSlot);
});

// --- CAMPAIGNS (PARTNER DASHBOARD) ---

app.get('/api/campaigns', (req, res) => {
  res.json(db.campaigns);
});

app.post('/api/campaigns', (req, res) => {
  const { brandName, campaignName, category, keywords, targetSlotAspect, bidCpm, dailyBudget, headline, callToAction, couponCode, bannerBg, bannerAccent, accentIcon } = req.body;
  
  const campaign = {
    id: `camp_${Date.now()}`,
    partnerId: `partner_${Date.now()}`,
    brandName: brandName || 'Partner Brand',
    campaignName: campaignName || 'New Campaign',
    category: category || 'general',
    keywords: Array.isArray(keywords) ? keywords : (keywords || '').split(',').map(s => s.trim()),
    targetSlotAspect: targetSlotAspect || '2:1',
    bidCpm: parseFloat(bidCpm) || 5.00,
    dailyBudget: parseFloat(dailyBudget) || 200,
    spentToday: 0.0,
    status: 'pending_review',
    moderationStatus: 'pending',
    headline: headline || 'Special Offer',
    callToAction: callToAction || 'Claim discount now',
    couponCode: couponCode || 'SAVE10',
    bannerTheme: 'custom',
    bannerBg: bannerBg || '#1e293b',
    bannerAccent: bannerAccent || '#38bdf8',
    tagline: 'Sponsored in-game recommendation',
    accentIcon: accentIcon || '✨'
  };

  // Pipeline check
  const reviewResult = moderationPipeline.ingestCreativeForReview(campaign);
  db.campaigns.push(campaign);

  res.status(201).json({ campaign, reviewResult });
});

// --- MODERATION QUEUE ---

app.get('/api/moderation', (req, res) => {
  res.json(db.moderationQueue);
});

app.post('/api/moderation/review', (req, res) => {
  const { modId, decision } = req.body;
  if (!modId || !decision) return res.status(400).json({ error: 'modId and decision required' });

  const result = moderationPipeline.reviewItem(modId, decision);
  res.json(result);
});

// --- STUDIO POLICY ---

app.get('/api/studio/policy', (req, res) => {
  res.json(db.studioPolicy);
});

app.put('/api/studio/policy', (req, res) => {
  const body = req.body || {};
  const update = {};
  if (body.revShareStudio !== undefined) {
    const r = Number(body.revShareStudio);
    if (!Number.isFinite(r) || r < 0 || r > 1) return res.status(400).json({ error: 'revShareStudio must be in [0,1]' });
    update.revShareStudio = r;
  }
  if (body.blockedCategories !== undefined) {
    if (!Array.isArray(body.blockedCategories)) return res.status(400).json({ error: 'blockedCategories must be an array' });
    update.blockedCategories = body.blockedCategories.map(String);
  }
  for (const [k, v] of Object.entries(body)) {
    if (!(k in update) && k !== 'revShareStudio' && k !== 'blockedCategories') update[k] = v;
  }
  db.studioPolicy = { ...db.studioPolicy, ...update };
  res.json(db.studioPolicy);
});

// --- ANALYTICS ---

app.get('/api/analytics', (req, res) => {
  res.json(db.analytics);
});

// SPA Fallback for client routing
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api')) return next();
  const indexPath = path.join(frontendDist, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Start Server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[VoiceCue Backend] Core API operational at http://localhost:${PORT}`);
  });
}

module.exports = app;
