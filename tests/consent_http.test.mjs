import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ROOT } from './helpers/loaders.mjs';

const require = createRequire(join(ROOT, 'package.json'));
let app, server, base, loadErr = null;
try { app = require(join(ROOT, 'backend/src/server.js')); } catch (e) { loadErr = e; }
const skip = loadErr ? `server.js not loadable: ${loadErr.message}`
  : (typeof app?.listen !== 'function' ? 'server.js does not export an express app' : false);

before(async () => {
  if (skip) return;
  await new Promise(res => { server = app.listen(0, '127.0.0.1', res); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(() => server?.close());

const post = (p, body) => fetch(base + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const sid = () => 'anon_qa_' + Math.random().toString(36).slice(2, 10);

test('signal without consent is rejected with 403', { skip }, async () => {
  const r = await post('/intent/signal', { anonSessionId: sid(), category: 'food.pizza', confidence: 0.9 });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).accepted, false);
});

test('signal after consent accepted; after revoke rejected', { skip }, async () => {
  const s = sid();
  assert.equal((await post('/privacy/consent', { sessionId: s, consented: true })).status, 200);
  const ok = await post('/intent/signal', { anonSessionId: s, category: 'food.pizza', confidence: 0.9 });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).accepted, true);
  await post('/privacy/consent', { sessionId: s, consented: false });
  const no = await post('/intent/signal', { anonSessionId: s, category: 'food.pizza', confidence: 0.9 });
  assert.equal(no.status, 403);
});

test('forget wipes signals and consent', { skip }, async () => {
  const s = sid();
  await post('/privacy/consent', { sessionId: s, consented: true });
  await post('/intent/signal', { anonSessionId: s, category: 'gaming.gear', confidence: 0.9 });
  assert.equal((await post('/privacy/forget', { sessionId: s })).status, 200);
  const st = await (await fetch(`${base}/privacy/status/${s}`)).json();
  assert.equal(st.consented, false);
  assert.equal((st.signals || []).length, 0);
});

test('sensitive categories dropped even with consent', { skip }, async () => {
  const s = sid();
  await post('/privacy/consent', { sessionId: s, consented: true });
  for (const category of ['gambling.casino', 'health.medical', 'politics.election', 'alcohol.beer']) {
    const r = await post('/intent/signal', { anonSessionId: s, category, confidence: 0.9 });
    assert.notEqual(r.status, 200, `${category} was accepted`);
  }
});

test('auction for unconsented session is not personalised', { skip }, async () => {
  const s = sid();
  await post('/intent/signal', { anonSessionId: s, category: 'clothing.footwear' });
  const r = await (await post('/auction/decide', { slotId: 'slot_tavern_01', anonSessionId: s })).json();
  if (r.success) assert.doesNotMatch(r.creative.whyThisAd || '', /footwear/);
});

test('missing params -> 400', { skip }, async () => {
  assert.equal((await post('/intent/signal', {})).status, 400);
  assert.equal((await post('/privacy/consent', {})).status, 400);
});
