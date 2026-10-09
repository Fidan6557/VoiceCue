import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { ROOT } from './helpers/loaders.mjs';

const require = createRequire(join(ROOT, 'package.json'));
const db = require(join(ROOT, 'backend/src/store/memoryDb.js'));
const auction = require(join(ROOT, 'backend/src/services/auctionEngine.js'));

const SLOT = 'slot_test_qa';
const mk = (id, bidCpm, extra = {}) => ({
  id, partnerId: 'p_' + id, brandName: 'Brand ' + id, campaignName: id, category: 'test.cat',
  keywords: [], targetSlotAspect: '3:7', bidCpm, dailyBudget: 1000, spentToday: 0,
  status: 'active', moderationStatus: 'approved', headline: 'h', callToAction: 'c', ...extra
});
let saved;
beforeEach(() => {
  saved ??= { campaigns: db.campaigns, slots: db.slots };
  db.slots = [...saved.slots.filter(s => s.id !== SLOT),
    { id: SLOT, name: 'QA slot', aspectRatio: '3:7', pixelWidth: 30, pixelHeight: 70, floorPriceCpm: 2.0, active: true, currentAd: null }];
});
const run = (camps) => { db.campaigns = camps; return auction.decideAdForSlot({ slotId: SLOT, anonSessionId: 'anon_qa_none' }); };

test('second-price: winner pays runner-up + $0.01, never their own bid', () => {
  const r = run([mk('a', 10), mk('b', 6), mk('c', 4)]);
  assert.equal(r.success, true);
  assert.equal(r.creative.id, 'a');
  assert.equal(r.auction.winningCpm, 6.01);
});

test('second-price: tie charges at most the bid', () => {
  const r = run([mk('a', 5), mk('b', 5)]);
  assert.equal(r.success, true);
  assert.ok(r.auction.winningCpm <= 5, `charged ${r.auction.winningCpm} > bid 5`);
});

test('single bidder: never above bid and never below floor', () => {
  const r = run([mk('solo', 8)]);
  assert.equal(r.success, true);
  assert.ok(r.auction.winningCpm <= 8, `charged ${r.auction.winningCpm} above bid`);
  assert.ok(r.auction.winningCpm >= 2.0, `charged ${r.auction.winningCpm} below floor`);
});

test('no bidders: no ad served', () => {
  assert.equal(run([]).success, false);
});

test('bids below floor are excluded', () => {
  assert.equal(run([mk('low', 1.5)]).success, false);
});

test('property: highest bid wins and is never charged above its bid (200 random auctions)', () => {
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(Math.random() * 5);
    const camps = Array.from({ length: n }, (_, k) => mk('r' + k, Number((2 + Math.random() * 20).toFixed(2))));
    const bids = Object.fromEntries(camps.map(c => [c.id, c.bidCpm]));
    const r = run(camps);
    assert.equal(r.success, true);
    assert.ok(r.auction.winningCpm <= bids[r.creative.id] + 1e-9, `charged ${r.auction.winningCpm} > bid ${bids[r.creative.id]}`);
    assert.equal(bids[r.creative.id], Math.max(...Object.values(bids)), 'highest bid must win');
  }
});

test('unknown slot returns error', () => {
  db.campaigns = [mk('a', 10)];
  assert.equal(auction.decideAdForSlot({ slotId: 'nope', anonSessionId: 'x' }).success, false);
});
