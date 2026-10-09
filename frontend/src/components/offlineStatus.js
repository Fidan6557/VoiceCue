// Detects api.js offline/simulated fallbacks ({ ok:false, offline:true, simulated:true })
// and drives a visible "Offline demo" badge so simulated data is never presented as live.

export function isOfflineResult(res) {
  return !!(res && typeof res === 'object' && !Array.isArray(res) &&
    (res.offline === true || res.simulated === true));
}

// Unwraps list-shaped responses: arrays pass through, offline/simulated objects -> fallback.
export function asList(res, fallback = []) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.data)) return res.data;
  return fallback;
}

export function setBackendStatus(offline) {
  const el = document.getElementById('backend-status');
  if (!el) return;
  el.classList.toggle('offline', !!offline);
  el.textContent = offline ? 'OFFLINE DEMO (simulated)' : 'LIVE';
  el.title = offline
    ? 'Backend unreachable: data shown is simulated locally, not real.'
    : 'Connected to VoiceCue backend.';
}

// Records a response: flags offline mode if simulated, otherwise marks live.
export function trackResult(res) {
  if (isOfflineResult(res)) setBackendStatus(true);
  else if (res !== null && res !== undefined) setBackendStatus(false);
  return res;
}
