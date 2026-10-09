export class ArchitectureInspector {
  constructor(containerElement) {
    this.container = containerElement;
    this.logs = [];
    this.render();
  }

  addLog(entry) {
    this.logs.unshift({
      time: new Date().toLocaleTimeString(),
      ...entry
    });
    if (this.logs.length > 30) this.logs.pop();
    this.updateLogUI();
  }

  render() {
    this.container.innerHTML = `
      <div class="dashboard-container">
        <div class="dash-header">
          <div>
            <h1 class="dash-title">VoiceCue Core Architecture & Telemetry Inspector</h1>
            <p class="dash-subtitle">Data flow visualization, privacy guarantees, and second-price auction telemetry</p>
          </div>
          <span class="status-indicator">
            <span class="status-dot"></span>
            LIVE TELEMETRY STREAM
          </span>
        </div>

        <!-- Visual Flow Diagram -->
        <div class="panel-card" style="margin-bottom: 28px;">
          <h2 class="panel-title">
            <span>🔄 End-to-End Pipeline: From Player Mic to In-Game Minecraft Painting</span>
            <span class="badge badge-green">Zero Raw Audio Leakage</span>
          </h2>

          <div class="flow-diagram">
            <div class="flow-step active">
              <div class="flow-step-icon">🎙</div>
              <div class="flow-step-title">1. Player Microphone</div>
              <div class="flow-step-desc">Opt-in consent. Voice capture performed strictly on the player device.</div>
            </div>

            <div class="flow-arrow">➔</div>

            <div class="flow-step active">
              <div class="flow-step-icon">🧠</div>
              <div class="flow-step-title">2. On-Device NLP</div>
              <div class="flow-step-desc">Coarse intent (food.pizza). Raw audio and transcript wiped immediately.</div>
            </div>

            <div class="flow-arrow">➔</div>

            <div class="flow-step active">
              <div class="flow-step-icon">🛡</div>
              <div class="flow-step-title">3. Privacy Gateway</div>
              <div class="flow-step-desc">Anonymous session. 10-minute TTL. Sensitive topics filtered (GDPR/COPPA).</div>
            </div>

            <div class="flow-arrow">➔</div>

            <div class="flow-step active">
              <div class="flow-step-icon">⚡</div>
              <div class="flow-step-title">4. Auction Engine</div>
              <div class="flow-step-desc">Second-price Vickrey auction. 70/30 split. Frequency cap & pacing delay.</div>
            </div>

            <div class="flow-arrow">➔</div>

            <div class="flow-step active">
              <div class="flow-step-icon">🖼</div>
              <div class="flow-step-title">5. Painting Rendering</div>
              <div class="flow-step-desc">Dynamic texture update in Minecraft world with "Sponsored" label.</div>
            </div>
          </div>
        </div>

        <div class="content-grid-2">
          <!-- Privacy Guarantees Panel -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>🔒 Privacy & Security Guarantees</span>
              <span class="badge badge-blue">Privacy by Design</span>
            </h2>

            <ul style="list-style: none; font-size: 13px; line-height: 2; color: #cbd5e1;">
              <li>✅ <strong>Raw audio never leaves device:</strong> STT runs entirely on client.</li>
              <li>✅ <strong>Strict 10-minute TTL:</strong> Player intent signals expire after 600 seconds.</li>
              <li>✅ <strong>Sensitive categories banned:</strong> Health, religion, politics, adult 18+, gambling.</li>
              <li>✅ <strong>k-Anonymity (k ≥ 50):</strong> Partners only receive coarse, aggregated reporting.</li>
              <li>✅ <strong>Right to be forgotten:</strong> Player can instantly purge all session data in 1 click.</li>
              <li>✅ <strong>Transparency:</strong> "Why am I seeing this?" prompt on every ad placement.</li>
            </ul>
          </div>

          <!-- Live Event Log -->
          <div class="panel-card">
            <h2 class="panel-title">
              <span>📡 Real-Time Event Log</span>
              <span class="badge badge-yellow" id="event-count">0 events</span>
            </h2>

            <div id="inspector-log-container" style="max-height: 280px; overflow-y: auto; font-family: var(--font-mono); font-size: 12px;">
              <div style="color: #64748b; padding: 10px;">Waiting for voice intents or auction events...</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  updateLogUI() {
    const container = this.container.querySelector('#inspector-log-container');
    const counter = this.container.querySelector('#event-count');
    if (!container) return;

    if (counter) counter.textContent = `${this.logs.length} events`;

    container.innerHTML = this.logs.map(log => `
      <div style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 12px; align-items: center;">
        <span style="color: #64748b;">${log.time}</span>
        <span class="badge ${log.type.includes('ERROR') || log.type.includes('BLOCKED') ? 'badge-yellow' : 'badge-green'}">${log.type}</span>
        <span style="color: #f1f5f9; flex: 1;">${log.message}</span>
      </div>
    `).join('');
  }
}
