// In-memory data store for VoiceCue (simulating Redis + Postgres)
const { v4: uuidv4 } = require('uuid');

class MemoryDb {
  constructor() {
    this.sessions = new Map(); // anonSessionId -> { consented: boolean, ageVerified: boolean, createdAt, lastSignal, activeIntent }
    this.slots = [
      {
        id: 'slot_tavern_01',
        gameId: 'minecraft_world_alpha',
        name: 'Tavern Wooden Wall Painting',
        type: 'painting',
        aspectRatio: '2:1',
        blockWidth: 2,
        blockHeight: 1,
        pixelWidth: 256,
        pixelHeight: 128,
        location: { x: 12, y: 4, z: -8 },
        floorPriceCpm: 4.50,
        active: true,
        currentAd: null
      },
      {
        id: 'slot_square_02',
        gameId: 'minecraft_world_alpha',
        name: 'Village Town Square Billboard',
        type: 'billboard',
        aspectRatio: '2:1',
        blockWidth: 4,
        blockHeight: 2,
        pixelWidth: 512,
        pixelHeight: 256,
        location: { x: 0, y: 7, z: 18 },
        floorPriceCpm: 6.00,
        active: true,
        currentAd: null
      },
      {
        id: 'slot_outpost_03',
        gameId: 'minecraft_world_alpha',
        name: 'Mining Outpost Item Frame',
        type: 'item_frame',
        aspectRatio: '1:1',
        blockWidth: 1,
        blockHeight: 1,
        pixelWidth: 128,
        pixelHeight: 128,
        location: { x: -24, y: 3, z: 5 },
        floorPriceCpm: 3.00,
        active: true,
        currentAd: null
      }
    ];

    this.studioPolicy = {
      studioName: 'BlockCraft Studios',
      gameTitle: 'Minecraft Open World Alpha',
      revShareStudio: 0.70, // 70% studio, 30% VoiceCue platform
      blockedCategories: ['gambling', 'adult', 'politics', 'alcohol', 'weapons', 'crypto'],
      strictModeration: true,
      maxDailyImpressionsPerPlayer: 8,
      defaultDeliveryDelaySeconds: 60
    };

    this.campaigns = [
      {
        id: 'camp_dodo_pizza',
        partnerId: 'partner_dodo',
        brandName: 'Dodo Pizza',
        campaignName: 'Hot Pepperoni Craft',
        category: 'food.pizza',
        keywords: ['pizza', 'food', 'hungry', 'eat', 'pepperoni', 'slice', 'delivery'],
        targetSlotAspect: '2:1',
        bidCpm: 9.50,
        dailyBudget: 500,
        spentToday: 142.50,
        status: 'active',
        moderationStatus: 'approved',
        headline: 'Hot Pizza in 30 Mins!',
        callToAction: '25% Off with Code CRAFTPIZZA',
        couponCode: 'CRAFTPIZZA',
        bannerTheme: 'pizza',
        bannerBg: '#d32f2f',
        bannerAccent: '#ffca28',
        tagline: 'Perfect for long Minecraft gaming sessions',
        accentIcon: '🍕'
      },
      {
        id: 'camp_hyperx_audio',
        partnerId: 'partner_hyperx',
        brandName: 'HyperX Audio',
        campaignName: 'Cloud III Headset Gaming',
        category: 'gaming.gear',
        keywords: ['headphones', 'mic', 'headset', 'audio', 'sound', 'gaming', 'gear'],
        targetSlotAspect: '2:1',
        bidCpm: 12.00,
        dailyBudget: 800,
        spentToday: 216.00,
        status: 'active',
        moderationStatus: 'approved',
        headline: 'HyperX Cloud III: Hear Creepers 50 Blocks Away',
        callToAction: 'Promo Code MINESOUND for -20%',
        couponCode: 'MINESOUND',
        bannerTheme: 'gaming',
        bannerBg: '#1a1a24',
        bannerAccent: '#00e5ff',
        tagline: 'Crystal Clear 7.1 Surround Sound',
        accentIcon: '🎧'
      },
      {
        id: 'camp_energy_surge',
        partnerId: 'partner_surge',
        brandName: 'Volt Energy',
        campaignName: 'Endless Stamina Drink',
        category: 'beverages.energy',
        keywords: ['drink', 'energy', 'thirst', 'stamina', 'beverage', 'boost', 'volt'],
        targetSlotAspect: '2:1',
        bidCpm: 7.80,
        dailyBudget: 400,
        spentToday: 85.00,
        status: 'active',
        moderationStatus: 'approved',
        headline: 'Volt Energy: Endless Miner Stamina',
        callToAction: 'Buy 2 Cans, Get 1 Free',
        couponCode: 'VOLTMINER',
        bannerTheme: 'energy',
        bannerBg: '#122615',
        bannerAccent: '#76ff03',
        tagline: 'Energy Boost for All-Night Building',
        accentIcon: '⚡'
      },
      {
        id: 'camp_sneakers_boost',
        partnerId: 'partner_boost',
        brandName: 'Apex Sneakers',
        campaignName: 'Speed Runner Footwear',
        category: 'clothing.footwear',
        keywords: ['sneakers', 'shoes', 'footwear', 'running', 'kicks'],
        targetSlotAspect: '1:1',
        bidCpm: 6.50,
        dailyBudget: 350,
        spentToday: 42.00,
        status: 'active',
        moderationStatus: 'approved',
        headline: 'Apex Speed: Light as a Feather',
        callToAction: 'Promo Code FASTBOOTS for -15%',
        couponCode: 'FASTBOOTS',
        bannerTheme: 'fashion',
        bannerBg: '#212121',
        bannerAccent: '#ff9100',
        tagline: 'Real-World Sprint Speed',
        accentIcon: '👟'
      }
    ];

    this.moderationQueue = [
      {
        id: 'mod_req_99',
        campaignId: 'camp_pending_energy',
        brandName: 'Nitro Burst',
        category: 'beverages.energy',
        headline: 'Super Energy Boost for School Kids',
        riskScore: 0.28,
        aiCheck: {
          nsfw: 'clear (0.01)',
          toxicity: 'clear (0.02)',
          ageAppropriate: 'flagged: mentions minors/school'
        },
        status: 'pending_studio_review',
        submittedAt: new Date(Date.now() - 1000 * 60 * 35).toISOString()
      }
    ];

    this.analytics = {
      totalImpressions: 14850,
      totalClicks: 1634,
      totalSpendGross: 11880.00,
      studioPayout: 8316.00, // 70%
      platformFee: 3564.00, // 30%
      optInRatePercent: 28.4,
      activeOptInPlayers: 3420,
      recentEvents: []
    };
  }

  // Session & Consent methods
  getOrCreateSession(sessionId) {
    if (!sessionId || !this.sessions.has(sessionId)) {
      const newId = sessionId || `anon_${uuidv4().slice(0, 8)}`;
      this.sessions.set(newId, {
        id: newId,
        consented: false,
        ageVerified: false,
        createdAt: Date.now(),
        signals: []
      });
      return this.sessions.get(newId);
    }
    return this.sessions.get(sessionId);
  }

  setConsent(sessionId, consented, ageVerified = true) {
    const s = this.getOrCreateSession(sessionId);
    s.consented = consented;
    s.ageVerified = ageVerified;
    if (!consented) {
      s.signals = []; // Instant wipe on opt-out
    }
    return s;
  }

  addIntentSignal(sessionId, category, confidence = 0.9, rawKeyword = '') {
    const s = this.getOrCreateSession(sessionId);
    if (!s.consented) {
      throw new Error('ConsentNotGranted: Player has not opted into smart recommendations');
    }
    const signal = {
      category,
      confidence,
      timestamp: Date.now(),
      ttlExpiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes TTL
      rawKeyword
    };
    s.signals.push(signal);
    // Keep only non-expired signals
    s.signals = s.signals.filter(sig => sig.ttlExpiresAt > Date.now());
    return signal;
  }

  getLatestValidSignal(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s || !s.consented || !s.signals.length) return null;
    const valid = s.signals.filter(sig => sig.ttlExpiresAt > Date.now());
    if (!valid.length) return null;
    return valid[valid.length - 1];
  }
}

const db = new MemoryDb();
module.exports = db;
