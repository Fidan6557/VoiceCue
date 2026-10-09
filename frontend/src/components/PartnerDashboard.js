import { VoiceCueApi } from '../services/api';

export class PartnerDashboard {
  constructor(containerElement, onCampaignCreated) {
    this.container = containerElement;
    this.onCampaignCreated = onCampaignCreated || (() => {});
    this.campaigns = [];
    this.render();
    this.loadData();
  }

  async loadData() {
    this.campaigns = await VoiceCueApi.getCampaigns();
    this.renderCampaignList();
  }

  render() {
    this.container.innerHTML = `
      <div class="dashboard-container">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">B2B Partner Portal — Advertisers</h1>
            <p class="dash-subtitle">Contextual campaigns driven by player voice intent in the Minecraft open world</p>
          </div>
          <button class="btn-primary" id="btn-quick-seed">+ Create Campaign</button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Active Impressions</div>
            <div class="stat-value">14,850</div>
            <div class="stat-sub">+18.4% today</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">CTR / Coupon Redemptions</div>
            <div class="stat-value">11.0%</div>
            <div class="stat-sub">1,634 in-game interactions</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Average eCPM</div>
            <div class="stat-value">$8.95</div>
            <div class="stat-sub">Second-Price Auction (Vickrey)</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Spend Today</div>
            <div class="stat-value">$443.50</div>
            <div class="stat-sub">Daily cap $2,050</div>
          </div>
        </div>

        <div class="content-grid-2">
          <!-- Create Campaign Panel -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>🎯 New Campaign Builder</span>
              <span class="badge badge-blue">Slot Spec: Minecraft Exact Ratio</span>
            </h2>

            <form id="campaign-form">
              <div class="form-group">
                <label class="form-label">Brand / Company</label>
                <input class="form-input" id="camp-brand" type="text" value="Dodo Pizza" required />
              </div>

              <div class="form-group">
                <label class="form-label">Campaign Name</label>
                <input class="form-input" id="camp-name" type="text" value="Hot Pizza for Miners" required />
              </div>

              <div class="form-group">
                <label class="form-label">Voice Intent Category</label>
                <select class="form-select" id="camp-category">
                  <option value="food.pizza">food.pizza (Pizza, food, snacks)</option>
                  <option value="gaming.gear">gaming.gear (Headsets, microphones, mice)</option>
                  <option value="beverages.energy">beverages.energy (Energy drinks, beverages)</option>
                  <option value="clothing.footwear">clothing.footwear (Sneakers, apparel)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Trigger Keywords (comma separated)</label>
                <input class="form-input" id="camp-keywords" type="text" value="pizza, hungry, food, pepperoni, slice" />
              </div>

              <div class="form-group">
                <label class="form-label">Target In-Game Slot</label>
                <select class="form-select" id="camp-slot">
                  <option value="2:1">Painting / Billboard 2:1 (Tavern 256x128 or Town Square 512x256)</option>
                  <option value="1:1">Item Frame 1:1 (Mining Outpost 128x128)</option>
                </select>
              </div>

              <div class="form-group">
                <label class="form-label">Banner Headline</label>
                <input class="form-input" id="camp-headline" type="text" value="Hot Pizza in 30 Mins!" required />
              </div>

              <div class="form-group">
                <label class="form-label">Promo Code / Coupon for Player</label>
                <input class="form-input" id="camp-coupon" type="text" value="CRAFTPIZZA" required />
              </div>

              <div class="form-group" style="display: flex; gap: 12px;">
                <div style="flex: 1;">
                  <label class="form-label">CPM Bid ($ per 1,000 impressions)</label>
                  <input class="form-input" id="camp-cpm" type="number" step="0.5" value="9.50" required />
                </div>
                <div style="flex: 1;">
                  <label class="form-label">Daily Budget ($)</label>
                  <input class="form-input" id="camp-budget" type="number" value="500" required />
                </div>
              </div>

              <!-- Live Banner Preview Box -->
              <div class="form-group">
                <label class="form-label">Minecraft Banner Texture Preview</label>
                <div class="banner-preview-box" id="preview-box">
                  <div style="font-size: 28px;" id="preview-icon">🍕</div>
                  <div>
                    <div style="font-weight: 800; font-size: 15px; color: #fff;" id="preview-title">Hot Pizza in 30 Mins!</div>
                    <div style="font-size: 11px; color: #ffca28; margin-top: 4px;" id="preview-code">Coupon: CRAFTPIZZA (-25%)</div>
                    <div style="font-size: 10px; color: #10b981; margin-top: 2px;">SPONSORED • VOICECUE VERIFIED</div>
                  </div>
                </div>
              </div>

              <button type="submit" class="btn-primary" style="width: 100%; margin-top: 12px;">
                Submit to Moderation Pipeline (AI + Studio)
              </button>
            </form>
          </div>

          <!-- Active Campaigns List -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>📊 Active Advertising Campaigns</span>
              <span class="badge badge-green">Real-Time Auction</span>
            </h2>

            <div style="overflow-x: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Brand / Campaign</th>
                    <th>Intent</th>
                    <th>Slot</th>
                    <th>CPM</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody id="campaigns-table-body">
                  <!-- Populated by JS -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const form = this.container.querySelector('#campaign-form');
    if (!form) return;

    // Live update preview
    const headlineInput = this.container.querySelector('#camp-headline');
    const couponInput = this.container.querySelector('#camp-coupon');
    const categorySelect = this.container.querySelector('#camp-category');
    const previewTitle = this.container.querySelector('#preview-title');
    const previewCode = this.container.querySelector('#preview-code');
    const previewIcon = this.container.querySelector('#preview-icon');

    const updatePreview = () => {
      previewTitle.textContent = headlineInput.value || 'Banner Headline';
      previewCode.textContent = `Coupon: ${couponInput.value || 'DISCOUNT'}`;
      const cat = categorySelect.value;
      if (cat.includes('pizza')) previewIcon.textContent = '🍕';
      else if (cat.includes('gaming')) previewIcon.textContent = '🎧';
      else if (cat.includes('energy')) previewIcon.textContent = '⚡';
      else if (cat.includes('footwear')) previewIcon.textContent = '👟';
    };

    headlineInput.addEventListener('input', updatePreview);
    couponInput.addEventListener('input', updatePreview);
    categorySelect.addEventListener('change', updatePreview);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const campaign = {
        brandName: this.container.querySelector('#camp-brand').value,
        campaignName: this.container.querySelector('#camp-name').value,
        category: categorySelect.value,
        keywords: this.container.querySelector('#camp-keywords').value,
        targetSlotAspect: this.container.querySelector('#camp-slot').value,
        headline: headlineInput.value,
        callToAction: 'Claim discount in-game now',
        couponCode: couponInput.value,
        bidCpm: parseFloat(this.container.querySelector('#camp-cpm').value),
        dailyBudget: parseFloat(this.container.querySelector('#camp-budget').value),
        bannerBg: '#1e293b',
        bannerAccent: '#ffca28',
        accentIcon: previewIcon.textContent
      };

      const result = await VoiceCueApi.createCampaign(campaign);
      alert(`Campaign "${campaign.campaignName}" submitted to Moderation Pipeline!\nL1/L2 Status: ${result.reviewResult ? result.reviewResult.status : 'queued'}`);
      this.loadData();
      this.onCampaignCreated(campaign);
    });
  }

  renderCampaignList() {
    const tbody = this.container.querySelector('#campaigns-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.campaigns.map(c => `
      <tr>
        <td>
          <div style="font-weight: 700; color: #fff;">${c.accentIcon || '⭐'} ${c.brandName}</div>
          <div style="font-size: 11px; color: #94a3b8;">${c.campaignName}</div>
        </td>
        <td><span class="badge badge-blue">${c.category}</span></td>
        <td>${c.targetSlotAspect}</td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #ffca28;">$${c.bidCpm.toFixed(2)}</td>
        <td>
          <span class="badge ${c.moderationStatus === 'approved' ? 'badge-green' : 'badge-yellow'}">
            ${c.moderationStatus === 'approved' ? 'Approved' : 'In Review'}
          </span>
        </td>
      </tr>
    `).join('');
  }
}
