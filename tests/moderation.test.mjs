import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadImprovedModeration } from './helpers/loaders.mjs';

const mod = loadImprovedModeration();
const flagged = ['online casino', 'sports betting', 'c4sino slots', 'g@mbling bonus', 'k1ll yourself', 'k.i.l.l', 'get rich quick', 'weapons for sale', 'nsfw'];
const clean = ['Level up your skill', 'First class delivery', 'Free skill assessment', 'Occasional drops', 'Cryptic Quest puzzle', 'Hot Pizza in 30 Mins!'];
for (const t of flagged) test(`flags: ${t}`, () => assert.equal(mod(t).flagged, true));
for (const t of clean) test(`passes: ${t}`, () => assert.equal(mod(t).flagged, false));
