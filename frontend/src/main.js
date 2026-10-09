import { MinecraftWorld } from './components/MinecraftWorld';
import { SpeechRecognizer } from './services/speechRecognizer';
import { PartnerDashboard } from './components/PartnerDashboard';
import { StudioConsole } from './components/StudioConsole';
import { ArchitectureInspector } from './components/ArchitectureInspector';
import { VoiceCueApi } from './services/api';

class VoiceCueApp {
  constructor() {
    this.sessionId = 'anon_' + Math.random().toString(36).substring(2, 9);
    this.consented = true;
    this.pacingDelay = 5; // seconds for demo presentation
    this.activeTab = 'minecraft';

    this.minecraftWorld = null;
    this.speechRecognizer = null;
    this.partnerDashboard = null;
    this.studioConsole = null;
    this.inspector = null;

    this.init();
  }

  async init() {
    // Session Display
    const sessionEl = document.getElementById('header-session-id');
    if (sessionEl) sessionEl.textContent = this.sessionId;

    // 1. Initialize Inspector first so we can log events
    const inspectorRoot = document.getElementById('inspector-root');
    this.inspector = new ArchitectureInspector(inspectorRoot);

    this.inspector.addLog({
      type: 'INITIALIZED',
      message: `VoiceCue Platform initialized. Anonymous session: ${this.sessionId}`
    });

    // 2. Initialize 3D Minecraft World
    const canvas3d = document.getElementById('canvas-3d');
    this.minecraftWorld = new MinecraftWorld(canvas3d, (slot) => this.openAdModal(slot));

    // 3. Initialize B2B Dashboards
    const partnerRoot = document.getElementById('partner-dashboard-root');
    this.partnerDashboard = new PartnerDashboard(partnerRoot, (newCamp) => {
      this.inspector.addLog({
        type: 'CAMPAIGN_CREATED',
        message: `New campaign "${newCamp.campaignName}" registered by partner ${newCamp.brandName}`
      });
      if (this.studioConsole) this.studioConsole.loadData();
    });

    const studioRoot = document.getElementById('studio-console-root');
    this.studioConsole = new StudioConsole(studioRoot);

    // 4. Initialize Speech Recognizer
    this.initSpeech();

    // 5. Setup UI Tabs and Controls
    this.setupNavigation();
    this.setupHUDControls();
    this.setupAdModal();
    this.setupPointerLock();

    // Send initial consent to backend
    await VoiceCueApi.setConsent(this.sessionId, true);
    this.inspector.addLog({
      type: 'CONSENT_GRANTED',
      message: 'Player granted Opt-in consent for smart voice recommendations.'
    });

    // Seed initial ad into Tavern Painting so the world feels alive right away!
    setTimeout(() => {
      this.triggerIntentWorkflow('food.pizza', 0.95, 'pizza', 'I want hot pizza!', 1);
    }, 1500);
  }

  initSpeech() {
    this.speechRecognizer = new SpeechRecognizer({
      onTranscript: (text) => {
        const hudTranscript = document.getElementById('hud-transcript');
        if (hudTranscript) hudTranscript.textContent = `"${text}"`;
      },
      onSpeechStatus: (status) => {
        const micBadge = document.getElementById('mic-badge');
        const micLabel = document.getElementById('mic-label');
        if (micBadge && micLabel) {
          if (status.listening) {
            micBadge.className = 'mic-badge active';
            micLabel.textContent = status.text;
          } else {
            micBadge.className = 'mic-badge muted';
            micLabel.textContent = status.text;
          }
        }
      },
      onIntentExtracted: (result) => {
        if (!this.consented) {
          alert('Recommendations are disabled in privacy settings (Opt-In OFF).');
          return;
        }

        if (result.blocked) {
          this.inspector.addLog({
            type: 'PRIVACY_BLOCKED',
            message: `Request blocked by Privacy Gateway: ${result.reason}`
          });
          const hudCat = document.getElementById('hud-category');
          if (hudCat) {
            hudCat.textContent = 'BLOCKED (Sensitive)';
            hudCat.style.color = '#ef4444';
          }
          alert(`[VoiceCue Privacy Gateway]\nBlocked: category detected as sensitive (${result.reason}). Ad collection and display prohibited.`);
          return;
        }

        this.triggerIntentWorkflow(
          result.category,
          result.confidence,
          result.matchedKeyword,
          result.transcript,
          this.pacingDelay
        );
      }
    });

    // Quick speech simulator buttons
    document.querySelectorAll('.speech-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const phrase = btn.dataset.phrase;
        this.speechRecognizer.simulateVoice(phrase);
      });
    });
  }

  async triggerIntentWorkflow(category, confidence, matchedKeyword, transcript, delaySeconds) {
    // 1. Update HUD Radar
    const hudCat = document.getElementById('hud-category');
    const hudConf = document.getElementById('hud-conf');
    const hudTtl = document.getElementById('hud-ttl');
    if (hudCat) {
      hudCat.textContent = category;
      hudCat.style.color = '#38bdf8';
    }
    if (hudConf) hudConf.textContent = confidence.toFixed(2);
    if (hudTtl) hudTtl.textContent = '10:00 min';

    this.inspector.addLog({
      type: 'INTENT_EXTRACTED',
      message: `On-Device Extractor: category "${category}" (conf: ${confidence.toFixed(2)}), keyword: "${matchedKeyword || 'n/a'}"`
    });

    // 2. Transmit coarse signal to Privacy Gateway
    const gatewayRes = await VoiceCueApi.sendIntentSignal({
      anonSessionId: this.sessionId,
      category,
      confidence,
      rawKeyword: matchedKeyword
    });

    if (gatewayRes && gatewayRes.accepted === false) {
      this.inspector.addLog({
        type: 'GATEWAY_DROPPED',
        message: gatewayRes.reason
      });
      return;
    }

    this.inspector.addLog({
      type: 'PRIVACY_GATEWAY_OK',
      message: `Signal ${category} saved in Privacy Gateway (TTL 10m). Display delay: ${delaySeconds} sec.`
    });

    // 3. Pacing Delay (Simulating player walking around the open world for 1-2 minutes)
    const targetSlotId = (category.includes('footwear') || category.includes('clothing'))
      ? 'slot_outpost_03'
      : (category.includes('gaming') ? 'slot_square_02' : 'slot_tavern_01');

    setTimeout(async () => {
      // 4. Run Second-Price Auction
      const auctionRes = await VoiceCueApi.runAuction(targetSlotId, this.sessionId);

      if (auctionRes && auctionRes.success) {
        const { auction, creative } = auctionRes;

        this.inspector.addLog({
          type: 'AUCTION_WON',
          message: `Winner: ${auction.winningBrand} (CPM: $${auction.winningCpm}). Minecraft server revenue: ${auction.studioEarnings}.`
        });

        // 5. Render dynamically on in-game Minecraft painting!
        this.minecraftWorld.updateSlotWithAd(targetSlotId, creative);

        // Flash HUD indicator
        const prompt = document.getElementById('interaction-prompt');
        if (prompt) {
          prompt.classList.add('visible');
          prompt.querySelector('.prompt-text').textContent = `[E] Painting updated in the world: ${creative.brand}!`;
          setTimeout(() => prompt.classList.remove('visible'), 4000);
        }

        // Refresh studio & partner telemetry
        if (this.partnerDashboard) this.partnerDashboard.loadData();
        if (this.studioConsole) this.studioConsole.loadData();
      }
    }, delaySeconds * 1000);
  }

  setupNavigation() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
      btn.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        btn.classList.add('active');

        const tabKey = btn.dataset.tab;
        this.activeTab = tabKey;

        document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
        const targetView = document.getElementById(`view-${tabKey}`);
        if (targetView) targetView.classList.add('active');

        // Resize 3D canvas if returning to Minecraft
        if (tabKey === 'minecraft' && this.minecraftWorld) {
          this.minecraftWorld.onWindowResize();
        }
      });
    });
  }

  setupHUDControls() {
    // Opt-In Switch
    const optInToggle = document.getElementById('toggle-optin');
    if (optInToggle) {
      optInToggle.addEventListener('change', async (e) => {
        this.consented = e.target.checked;
        await VoiceCueApi.setConsent(this.sessionId, this.consented);
        if (this.consented) {
          this.inspector.addLog({
            type: 'CONSENT_ENABLED',
            message: 'Player enabled smart recommendations.'
          });
        } else {
          this.inspector.addLog({
            type: 'CONSENT_REVOKED',
            message: 'Player revoked consent. Local intents cleared.'
          });
          const hudCat = document.getElementById('hud-category');
          if (hudCat) hudCat.textContent = 'OPT-OUT (Muted)';
        }
      });
    }

    // Toggle Mic Button
    const micBtn = document.getElementById('btn-toggle-mic');
    if (micBtn) {
      micBtn.addEventListener('click', () => {
        if (!this.speechRecognizer.isListening) {
          this.speechRecognizer.start();
          micBtn.classList.add('recording');
          micBtn.innerHTML = '<span>Stop</span>';
        } else {
          this.speechRecognizer.stop();
          micBtn.classList.remove('recording');
          micBtn.innerHTML = '<span>Record</span>';
        }
      });
    }

    // Pacing Delay Selector
    const delaySelect = document.getElementById('select-pacing-delay');
    if (delaySelect) {
      delaySelect.addEventListener('change', (e) => {
        this.pacingDelay = parseInt(e.target.value, 10);
      });
    }
  }

  setupPointerLock() {
    const overlay = document.getElementById('pointer-lock-overlay');
    const startBtn = document.getElementById('btn-start-game');
    const canvas = document.getElementById('canvas-3d');

    const requestLock = () => {
      canvas.requestPointerLock = canvas.requestPointerLock || canvas.mozRequestPointerLock;
      canvas.requestPointerLock();
    };

    if (startBtn) startBtn.addEventListener('click', requestLock);
    if (canvas) canvas.addEventListener('click', () => {
      if (!this.minecraftWorld.isLocked) requestLock();
    });

    document.addEventListener('pointerlockchange', () => {
      const isLocked = document.pointerLockElement === canvas;
      this.minecraftWorld.isLocked = isLocked;
      if (overlay) {
        overlay.style.display = isLocked ? 'none' : 'flex';
      }
    });
  }

  setupAdModal() {
    const modal = document.getElementById('ad-modal');
    const closeBtn = document.getElementById('modal-close-btn');
    const claimDoneBtn = document.getElementById('btn-claim-done');
    const copyBtn = document.getElementById('btn-copy-coupon');
    const forgetBtn = document.getElementById('btn-forget-me');

    const closeModal = () => {
      if (modal) modal.classList.remove('open');
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (claimDoneBtn) claimDoneBtn.addEventListener('click', closeModal);

    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const code = document.getElementById('modal-coupon-code').textContent;
        navigator.clipboard.writeText(code).then(() => {
          copyBtn.textContent = '✓ Copied!';
          setTimeout(() => copyBtn.textContent = 'Copy', 2000);
        });
      });
    }

    if (forgetBtn) {
      forgetBtn.addEventListener('click', async () => {
        await VoiceCueApi.forgetMe(this.sessionId);
        alert('All your data and session markers have been immediately deleted.');
        this.inspector.addLog({
          type: 'RIGHT_TO_FORGET',
          message: `Right to be forgotten fulfilled: session data ${this.sessionId} completely erased.`
        });
        closeModal();
      });
    }
  }

  openAdModal(slot) {
    const modal = document.getElementById('ad-modal');
    if (!modal) return;

    // Release mouse pointer lock when opening dialog
    if (document.exitPointerLock) document.exitPointerLock();

    const ad = slot.currentAd || {
      brand: 'Slot ' + slot.name,
      headline: 'Ad placement available for brands',
      couponCode: 'MINECRAFT2026',
      accentIcon: '🖼',
      whyThisAd: 'You are inspecting a registered painting slot in the Minecraft world.'
    };

    document.getElementById('modal-icon').textContent = ad.accentIcon || '🍕';
    document.getElementById('modal-headline').textContent = ad.headline;
    document.getElementById('modal-brand-name').textContent = ad.brand;
    document.getElementById('modal-coupon-code').textContent = ad.couponCode || 'CRAFTPIZZA';
    document.getElementById('modal-why-text').textContent = ad.whyThisAd;

    modal.classList.add('open');
  }

  // Hook for studio moderation review
  async reviewModeration(modId, decision) {
    await VoiceCueApi.reviewModeration(modId, decision);
    if (this.studioConsole) this.studioConsole.loadData();
    if (this.partnerDashboard) this.partnerDashboard.loadData();
    this.inspector.addLog({
      type: 'MODERATION_DECISION',
      message: `Studio decision for submission ${modId}: ${decision.toUpperCase()}`
    });
  }
}

// Global instance for inline button callbacks
window.voiceCueApp = new VoiceCueApp();
