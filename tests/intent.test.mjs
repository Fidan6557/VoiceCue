import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadImprovedIntent } from './helpers/loaders.mjs';

const present = existsSync(join(ROOT, 'frontend/src/services/intentEngine.js'));
const detect = present ? await loadImprovedIntent() : null;
const skip = present ? false : 'intentEngine.js missing';

const cases = [
  ['I want pizza', 'food.pizza'],
  ["I don't want pizza", null],
  ['never buying shoes again', null],
  ["I'm not hungry", null],
  ['no energy drinks for me', null],
  ["I don't need a new headset", null],
  ['need new running shoes', 'clothing.footwear'],
  ['my headset mic is broken', 'gaming.gear'],
  ["I'm scared", null],
  ['that was great', null],
  ['read the comic', null],
  ['', null],
];
for (const [text, expected] of cases) {
  test(`detectIntent(${JSON.stringify(text)}) -> ${expected}`, { skip }, () => {
    assert.equal(detect(text).category, expected);
  });
}

test('detectIntent never throws on odd input', { skip }, () => {
  for (const t of [null, undefined, 42, '   ', '!!!', 'PIZZA!!!']) assert.doesNotThrow(() => detect(t));
});
