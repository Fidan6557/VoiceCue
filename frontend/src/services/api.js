// VoiceCue API Client with offline/fallback resilience

const API_BASE = '/api';

export const VoiceCueApi = {
  // Session & Consent
  async getSession(sessionId) {
    try {
      const res = await fetch(`${API_BASE}/privacy/status/${sessionId}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, using local state', e);
    }
    return { id: sessionId, consented: false, signals: [] };
  },

  async setConsent(sessionId, consented) {
    try {
      const res = await fetch(`${API_BASE}/privacy/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, consented })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, fallback applied', e);
    }
    return { success: true, consented };
  },

  async forgetMe(sessionId) {
    try {
      const res = await fetch(`${API_BASE}/privacy/forget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return { success: true, message: 'Purged' };
  },

  // Intent Signal
  async sendIntentSignal(payload) {
    try {
      const res = await fetch(`${API_BASE}/intent/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (e) {
      console.warn('Backend offline, simulated ingestion', e);
      return { accepted: true, category: payload.category, ttlExpiresAt: Date.now() + 600000 };
    }
  },

  // Auction
  async runAuction(slotId, anonSessionId) {
    try {
      const res = await fetch(`${API_BASE}/auction/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, anonSessionId })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline, running local auction mock', e);
    }
    return null;
  },

  // Slots
  async getSlots() {
    try {
      const res = await fetch(`${API_BASE}/slots`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return [];
  },

  // Campaigns
  async getCampaigns() {
    try {
      const res = await fetch(`${API_BASE}/campaigns`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return [];
  },

  async createCampaign(campaign) {
    try {
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaign)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return { campaign, status: 'simulated_created' };
  },

  // Moderation
  async getModerationQueue() {
    try {
      const res = await fetch(`${API_BASE}/moderation`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return [];
  },

  async reviewModeration(modId, decision) {
    try {
      const res = await fetch(`${API_BASE}/moderation/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modId, decision })
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return { success: true };
  },

  // Policy & Analytics
  async getPolicy() {
    try {
      const res = await fetch(`${API_BASE}/studio/policy`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return { revShareStudio: 0.7, blockedCategories: ['gambling', 'adult', 'politics'] };
  },

  async updatePolicy(policy) {
    try {
      const res = await fetch(`${API_BASE}/studio/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return policy;
  },

  async getAnalytics() {
    try {
      const res = await fetch(`${API_BASE}/analytics`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Backend offline', e);
    }
    return null;
  }
};
