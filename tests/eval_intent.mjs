// Evaluation harness: baseline (git HEAD) vs improved intent + moderation.
// Run: node tests/eval_intent.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadBaselineIntent, loadImprovedIntent, loadBaselineModeration, loadImprovedModeration } from './helpers/loaders.mjs';

const intentSet = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/intent_eval.json'), 'utf8'));
const modSet = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/moderation_eval.json'), 'utf8'));
const verbose = process.argv.includes('--verbose');

function scoreIntent(fn) {
  let correct = 0, negTotal = 0, negCorrect = 0, nullTotal = 0, fp = 0, posTotal = 0, posHit = 0;
  const misses = [];
  for (const item of intentSet) {
    const got = fn(item.text).category ?? null;
    const ok = got === item.expected || (item.acceptAlso || []).includes(got);
    if (ok) correct++; else misses.push({ text: item.text, expected: item.expected, got });
    if (item.expected === null) { nullTotal++; if (got !== null) fp++; }
    else { posTotal++; if (ok) posHit++; }
    if (item.tags.includes('negation')) { negTotal++; if (ok) negCorrect++; }
  }
  return {
    accuracy: correct / intentSet.length,
    recall: posHit / posTotal,
    fpRate: fp / nullTotal,
    negationAcc: negCorrect / negTotal,
    misses
  };
}

function scoreMod(fn) {
  let correct = 0, tp = 0, fn_ = 0, fp = 0, tn = 0; const misses = [];
  for (const item of modSet) {
    const got = !!fn(item.text).flagged;
    if (got === item.flag) correct++; else misses.push({ text: item.text, expected: item.flag, got });
    if (item.flag && got) tp++; else if (item.flag) fn_++; else if (got) fp++; else tn++;
  }
  return { accuracy: correct / modSet.length, recall: tp / (tp + fn_), fpRate: fp / (fp + tn), misses };
}

const pct = (x) => (x * 100).toFixed(1) + '%';
function table(title, rows, cols) {
  console.log(`\n== ${title} ==`);
  console.log(['metric', ...rows.map(r => r.name)].map(s => s.padEnd(22)).join(''));
  for (const c of cols) console.log([c, ...rows.map(r => r.m ? pct(r.m[c]) : 'n/a')].map(s => s.padEnd(22)).join(''));
  for (const r of rows) {
    if (!r.m) { console.log(`  [${r.name}] unavailable: ${r.err}`); continue; }
    console.log(`  [${r.name}] ${r.m.misses.length} misses`);
    if (verbose) for (const x of r.m.misses) console.log(`     - "${x.text}" expected=${x.expected} got=${x.got}`);
  }
}

const bIntent = await loadBaselineIntent();
let iRow;
try {
  if (!existsSync(join(ROOT, 'frontend/src/services/intentEngine.js'))) throw new Error('intentEngine.js not found');
  iRow = { name: 'improved', m: scoreIntent(await loadImprovedIntent()) };
} catch (e) { iRow = { name: 'improved', err: e.message }; }
table(`Intent (${intentSet.length} utterances)`, [{ name: 'baseline', m: scoreIntent(bIntent) }, iRow],
  ['accuracy', 'recall', 'fpRate', 'negationAcc']);

let mRow;
try { mRow = { name: 'improved', m: scoreMod(loadImprovedModeration()) }; }
catch (e) { mRow = { name: 'improved', err: e.message }; }
table(`Moderation (${modSet.length} texts)`, [{ name: 'baseline', m: scoreMod(loadBaselineModeration()) }, mRow],
  ['accuracy', 'recall', 'fpRate']);
