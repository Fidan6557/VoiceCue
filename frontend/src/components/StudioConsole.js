import { VoiceCueApi } from '../services/api';

export class StudioConsole {
  constructor(containerElement) {
    this.container = containerElement;
    this.slots = [];
    this.moderationQueue = [];
    this.policy = { revShareStudio: 0.7, blockedCategories: ['gambling', 'adult', 'politics'] };
    this.render();
    this.loadData();
  }

  async loadData() {
    this.slots = await VoiceCueApi.getSlots();
    this.moderationQueue = await VoiceCueApi.getModerationQueue();
    this.policy = await VoiceCueApi.getPolicy();
    this.updateUI();
  }

  render() {
    this.container.innerHTML = `
      <div class="dashboard-container">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">B2B Studio Console — Server Administration</h1>
            <p class="dash-subtitle">Manage Minecraft painting slots, enforce strict moderation, and monitor monetization (70% revenue share)</p>
          </div>
          <div class="badge badge-green" style="font-size: 13px; padding: 6px 14px;">
            💰 Revenue Split: 70% Studio / 30% Platform
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Studio Payout (70% Net)</div>
            <div class="stat-value" style="color: #34d399;">$8,316.00</div>
            <div class="stat-sub">From gross volume of $11,880.00</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Ad Slots</div>
            <div class="stat-value">3 slots</div>
            <div class="stat-sub">Tavern, Town Square, Mining Outpost</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Opt-In Players (Consent)</div>
            <div class="stat-value">28.4%</div>
            <div class="stat-sub">3,420 players enabled mic</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Moderation Queue (L3 Review)</div>
            <div class="stat-value" id="stat-mod-count">1 pending</div>
            <div class="stat-sub">AI scoring passed</div>
          </div>
        </div>

        <div class="content-grid-2">
          <!-- Slots Inventory -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>🖼 Minecraft World Slots Inventory</span>
              <span class="badge badge-blue">In-World Inventory</span>
            </h2>

            <table class="data-table">
              <thead>
                <tr>
                  <th>Slot & Type</th>
                  <th>Size</th>
                  <th>Coordinates (X,Y,Z)</th>
                  <th>Floor CPM</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="slots-table-body">
                <!-- JS populated -->
              </tbody>
            </table>
          </div>

          <!-- Studio Safety Filters -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>🛡 Safety Filters & Blocklist</span>
              <span class="badge badge-yellow">Brand Safety & COPPA</span>
            </h2>

            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              Categories restricted from displaying on your game server. The system automatically rejects matching intents:
            </p>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-gambling" checked />
                <span>🎰 Casino & Gambling</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-adult" checked />
                <span>🔞 Adult Content (18+)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-politics" checked />
                <span>🗳 Politics</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-alcohol" checked />
                <span>🍺 Alcohol & Tobacco</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-crypto" checked />
                <span>🪙 Cryptocurrencies & NFTs</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                <input type="checkbox" id="block-weapons" checked />
                <span>⚔ Out-of-game Weapons</span>
              </label>
            </div>

            <button class="btn-primary" id="btn-save-policy" style="padding: 8px 16px; font-size: 12px;">
              Save Server Safety Policy
            </button>
          </div>
        </div>

        <!-- 3-Layer Moderation Queue -->
        <div class="panel-card" style="margin-top: 24px;">
          <h2 class="panel-title">
            <span>⚖ Layer 3 Moderation: Studio Manual Review Queue</span>
            <span class="badge badge-green">L1 Heuristics: OK • L2 AI Vision: OK</span>
          </h2>

          <div style="overflow-x: auto;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID / Brand</th>
                  <th>Category</th>
                  <th>Banner Text</th>
                  <th>AI Risk Score</th>
                  <th>Studio Action</th>
                </tr>
              </thead>
              <tbody id="moderation-table-body">
                <!-- JS populated -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector('#btn-save-policy');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const blocked = [];
        if (this.container.querySelector('#block-gambling').checked) blocked.push('gambling');
        if (this.container.querySelector('#block-adult').checked) blocked.push('adult');
        if (this.container.querySelector('#block-politics').checked) blocked.push('politics');
        if (this.container.querySelector('#block-alcohol').checked) blocked.push('alcohol');
        if (this.container.querySelector('#block-crypto').checked) blocked.push('crypto');
        if (this.container.querySelector('#block-weapons').checked) blocked.push('weapons');

        this.policy.blockedCategories = blocked;
        await VoiceCueApi.updatePolicy(this.policy);
        alert('Server safety policy successfully updated!');
      });
    }
  }

  updateUI() {
    // Render Slots Table
    const slotsTbody = this.container.querySelector('#slots-table-body');
    if (slotsTbody && this.slots.length) {
      slotsTbody.innerHTML = this.slots.map(s => `
        <tr>
          <td>
            <div style="font-weight: 700; color: #fff;">${s.name}</div>
            <div style="font-size: 11px; color: #94a3b8;">${s.id} (${s.type})</div>
          </td>
          <td><span class="badge badge-blue">${s.blockWidth}x${s.blockHeight} blocks (${s.aspectRatio})</span></td>
          <td style="font-family: var(--font-mono); color: #cbd5e1;">X:${s.location.x} Y:${s.location.y} Z:${s.location.z}</td>
          <td style="font-weight: 700; color: #ffca28;">$${s.floorPriceCpm.toFixed(2)}</td>
          <td><span class="badge badge-green">Active</span></td>
        </tr>
      `).join('');
    }

    // Render Moderation Queue
    const modTbody = this.container.querySelector('#moderation-table-body');
    const modCount = this.container.querySelector('#stat-mod-count');
    if (modTbody) {
      if (this.moderationQueue.length === 0) {
        modTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8;">Moderation queue is empty. All creatives verified!</td></tr>`;
        if (modCount) modCount.textContent = '0 pending';
      } else {
        if (modCount) modCount.textContent = `${this.moderationQueue.length} pending`;
        modTbody.innerHTML = this.moderationQueue.map(item => `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${item.brandName}</div>
              <div style="font-size: 11px; color: #94a3b8;">${item.id}</div>
            </td>
            <td><span class="badge badge-blue">${item.category}</span></td>
            <td style="color: #f1f5f9; font-weight: 500;">"${item.headline}"</td>
            <td>
              <span class="badge ${item.riskScore < 0.3 ? 'badge-green' : 'badge-yellow'}">
                Risk: ${item.riskScore} • ${item.aiCheck ? item.aiCheck.nsfw : 'Checked'}
              </span>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn-primary" style="padding: 6px 12px; font-size: 11px;" onclick="window.voiceCueApp.reviewModeration('${item.id}', 'approve')">
                  ✓ Approve
                </button>
                <button class="btn-danger" onclick="window.voiceCueApp.reviewModeration('${item.id}', 'reject')">
                  ✕ Reject
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    }
  }
}
