// VoiceCue API Client.
// When the backend is unreachable or returns an error, results are explicitly flagged
// ({ ok:false, offline?:true, simulated?:true, error }) instead of faking success.

const API_BASE = '/api';

async function request(path, { method = 'GET', body } = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (res.ok) return { ok: true, data };
    return {
      ok: false,
      status: res.status,
      data,
      error: (data && (data.error || data.reason || data.message)) || `HTTP ${res.status}`
    };
  } catch (e) {
    console.warn(`VoiceCue backend unreachable (${method} ${path})`, e);
    return { ok: false, offline: true, error: e && e.message ? e.message : 'Network error' };
  }
}

function offlineFlags(r) {
  return { ok: false, offline: !!r.offline, simulated: !!r.offline, status: r.status, error: r.error };
}

export const VoiceCueApi = {
  // Session & Consent
  async getSession(sessionId) {
    const r = await request(`/privacy/status/${encodeURIComponent(sessionId)}`);
    if (r.ok) return r.data;
    return { id: sessionId, consented: false, signals: [], ...offlineFlags(r) };
  },

  async setConsent(sessionId, consented) {
    const r = await request('/privacy/consent', { method: 'POST', body: { sessionId, consented: !!consented } });
    if (r.ok) return r.data;
    return { success: false, consented, ...offlineFlags(r) };
  },

  async forgetMe(sessionId) {
    const r = await request('/privacy/forget', { method: 'POST', body: { sessionId } });
    if (r.ok) return r.data;
    return { success: false, message: 'Purge NOT confirmed by server', ...offlineFlags(r) };
  },

  // Intent Signal. Raw keyword / transcript text never leaves the device: only category + confidence are sent.
  async sendIntentSignal(payload) {
    const { anonSessionId, category, confidence } = payload || {};
    const r = await request('/intent/signal', { method: 'POST', body: { anonSessionId, category, confidence } });
    if (r.ok) return r.data;
    return {
      ...(r.data || {}),
      accepted: false,
      reason: r.offline ? `BACKEND_OFFLINE: signal not sent (${r.error})` : r.error,
      ...offlineFlags(r)
    };
  },

  // Auction
  async runAuction(slotId, anonSessionId) {
    const r = await request('/auction/decide', { method: 'POST', body: { slotId, anonSessionId } });
    if (r.ok) return r.data;
    if (r.offline) return null;
    return { success: false, ...(r.data || {}), ...offlineFlags(r) };
  },

  // Slots
  async getSlots() {
    const r = await request('/slots');
    return r.ok ? r.data : [];
  },

  // Campaigns
  async getCampaigns() {
    const r = await request('/campaigns');
    return r.ok ? r.data : [];
  },

  async createCampaign(campaign) {
    const r = await request('/campaigns', { method: 'POST', body: campaign });
    if (r.ok) return r.data;
    return {
      campaign,
      status: r.offline ? 'not_submitted_offline' : 'rejected',
      reviewResult: { status: r.offline ? 'NOT_SUBMITTED (backend offline)' : `ERROR: ${r.error}` },
      ...offlineFlags(r)
    };
  },

  // Moderation
  async getModerationQueue() {
    const r = await request('/moderation');
    return r.ok ? r.data : [];
  },

  async reviewModeration(modId, decision) {
    const r = await request('/moderation/review', { method: 'POST', body: { modId, decision } });
    if (r.ok) return r.data;
    return { success: false, ...offlineFlags(r) };
  },

  // Policy & Analytics
  async getPolicy() {
    const r = await request('/studio/policy');
    if (r.ok) return r.data;
    // Local defaults so the UI can render; flagged as not coming from the server.
    return { revShareStudio: 0.7, blockedCategories: ['gambling', 'adult', 'politics'], ...offlineFlags(r) };
  },

  async updatePolicy(policy) {
    const r = await request('/studio/policy', { method: 'PUT', body: policy });
    if (r.ok) return r.data;
    return { ...policy, ...offlineFlags(r) };
  },

  async getAnalytics() {
    const r = await request('/analytics');
    return r.ok ? r.data : null;
  }
};
