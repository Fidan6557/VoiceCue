// Shared loaders: baseline (git HEAD) vs current implementations.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const require = createRequire(join(ROOT, 'package.json'));

export function gitShow(path, rev = 'HEAD') {
  return execFileSync('git', ['show', `${rev}:${path}`], { cwd: ROOT, encoding: 'utf8' });
}

// Baseline intent: instantiate the ORIGINAL SpeechRecognizer and capture processTranscript output.
let _baselineRec = null;
export async function loadBaselineIntent() {
  if (_baselineRec) return _baselineRec;
  const src = gitShow('frontend/src/services/speechRecognizer.js');
  const dir = mkdtempSync(join(tmpdir(), 'voicecue-baseline-'));
  const file = join(dir, 'speechRecognizer.baseline.mjs');
  writeFileSync(file, src);
  if (typeof globalThis.window === 'undefined') globalThis.window = {}; // no WebSpeech -> recognition null
  const { SpeechRecognizer } = await import(pathToFileURL(file).href);
  let last = null;
  const rec = new SpeechRecognizer({ onIntentExtracted: (r) => { last = r; } });
  _baselineRec = (text) => {
    last = null;
    rec.processTranscript(text);
    // Baseline emits 'general.contextual' as a fallback (no real intent) and category null when blocked.
    const category = last && !last.blocked && last.category !== 'general.contextual' ? last.category : null;
    return { category, raw: last };
  };
  return _baselineRec;
}

export async function loadImprovedIntent() {
  const mod = await import(pathToFileURL(join(ROOT, 'frontend/src/services/intentEngine.js')).href);
  if (typeof mod.detectIntent !== 'function') throw new Error('intentEngine.js has no detectIntent export');
  return (text) => { const r = mod.detectIntent(text); return { category: r ? r.category : null, raw: r }; };
}

// Baseline moderation: evaluate ORIGINAL moderationPipeline.js source with stubbed deps.
export function loadBaselineModeration() {
  const src = gitShow('backend/src/services/moderationPipeline.js');
  const m = { exports: {} };
  const stubRequire = (id) => {
    if (id.includes('memoryDb')) return { moderationQueue: [], campaigns: [] };
    if (id === 'uuid') return { v4: () => '00000000-0000' };
    return require(id);
  };
  vm.runInNewContext(`(function(module, exports, require){${src}\n})`, { console, Math, Date })(m, m.exports, stubRequire);
  const pipeline = m.exports;
  return (text) => {
    const r = pipeline.checkL1Rules({ headline: text, tagline: '', callToAction: '' });
    return { flagged: !r.passed, raw: r };
  };
}

// Improved moderation: adapt to whatever API the current module exposes.
export function loadImprovedModeration() {
  const p = join(ROOT, 'backend/src/services/moderationPipeline.js');
  delete require.cache[require.resolve(p)];
  const mod = require(p);
  return (text) => {
    const r = mod.checkL1Rules({ headline: text, tagline: '', callToAction: '' });
    return { flagged: !r.passed, raw: r };
  };
}
