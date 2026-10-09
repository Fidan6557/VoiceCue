import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './helpers/loaders.mjs';

// Simulate backend offline (fetch rejects): api.js should fall back instead of throwing.
let api, err;
try { ({ VoiceCueApi: api } = await import(pathToFileURL(join(ROOT, 'frontend/src/services/api.js')).href)); } catch (e) { err = e; }
const skip = err ? `api.js not importable in Node: ${err.message}` : false;

async function offline(fn) {
  const orig = globalThis.fetch, warn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  try { return await fn(); } finally { globalThis.fetch = orig; console.warn = warn; }
}

test('getSession falls back to unconsented state when offline', { skip }, async () => {
  const s = await offline(() => api.getSession('anon_x'));
  assert.equal(s.consented, false);
});

test('every API method resolves (not rejects) when offline', { skip }, async () => {
  const failures = [];
  await offline(async () => {
    for (const [name, fn] of Object.entries(api)) {
      if (typeof fn !== 'function') continue;
      try { await fn.call(api, 'anon_x', true); } catch (e) { failures.push(`${name}: ${e.message}`); }
    }
  });
  assert.deepEqual(failures, []);
});
