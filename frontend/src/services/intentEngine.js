// VoiceCue rule-based intent engine (pure, dependency-free ES module).
//
// IMPORTANT: this is a keyword/phrase heuristic, NOT a trained model.
// `score` is a heuristic evidence score in [0, 1] derived from how many
// distinct keywords/phrases matched and how specific they are. It is NOT a
// calibrated probability.

export const TAXONOMY = [
  {
    category: 'food.pizza',
    // weight: specificity (2 = strong product signal, 1 = weak/generic signal)
    keywords: { pizza: 2, pepperoni: 2, margherita: 2, 'slice of pizza': 3, hungry: 1, food: 1, starving: 1, eat: 1, slice: 1 }
  },
  {
    category: 'gaming.gear',
    keywords: { headphones: 2, microphone: 2, mic: 1, headset: 2, keyboard: 2, mouse: 1, gpu: 2, 'graphics card': 3, 'gaming mouse': 3, audio: 1, gaming: 1, gear: 1 }
  },
  {
    category: 'beverages.energy',
    keywords: { 'energy drink': 3, 'energy drinks': 3, 'red bull': 3, monster: 2, volt: 2, burn: 1, drink: 1, energy: 1, thirst: 1, thirsty: 1, soda: 1, caffeine: 2 }
  },
  {
    category: 'clothing.footwear',
    keywords: { sneakers: 2, shoes: 2, boots: 2, kicks: 1, 'running shoes': 3, footwear: 2 }
  }
];

export const SENSITIVE_KEYWORDS = [
  'casino', 'bet', 'betting', 'roulette', '1xbet', 'gambling',
  'election', 'politics', 'president', 'party',
  'sex', 'porn', 'nsfw', 'vodka', 'beer', 'alcohol', 'drugs'
];

// Single-token negators; "no more" handled as a phrase.
const NEGATORS = new Set(['not', 'no', "don't", 'dont', 'never', 'without', 'hate', 'stop', "doesn't", 'doesnt', "didn't", 'didnt', "won't", 'wont', "isn't", 'isnt', 'nothing', 'quit', 'quitting', 'avoid', 'avoiding']);
const NEGATION_WINDOW = 4;
// Tokens that end a negation scope ("I'm not hungry but I want pizza").
const SCOPE_BREAKERS = new Set(['but', 'though', 'however', 'although', 'yet']);
const MAX_WEIGHT_SUM = 5; // evidence total that maps to score 1.0

export function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .split(/[^a-z0-9']+/)
    .map(t => t.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

// Find all whole-token occurrences of a (possibly multi-word) phrase.
function findPhrase(tokens, phraseTokens) {
  const hits = [];
  outer: for (let i = 0; i + phraseTokens.length <= tokens.length; i++) {
    for (let j = 0; j < phraseTokens.length; j++) {
      if (tokens[i + j] !== phraseTokens[j]) continue outer;
    }
    hits.push(i);
  }
  return hits;
}

export function isNegatedAt(tokens, index) {
  for (let k = index - 1; k >= Math.max(0, index - NEGATION_WINDOW); k--) {
    const t = tokens[k];
    if (SCOPE_BREAKERS.has(t)) return false;
    if (NEGATORS.has(t)) return true;
    if (t === 'more' && tokens[k - 1] === 'no') return true;
  }
  return false;
}

export function detectSensitive(text) {
  const tokens = tokenize(text);
  const hit = SENSITIVE_KEYWORDS.find(kw => findPhrase(tokens, tokenize(kw)).length > 0);
  return hit || null;
}

/**
 * detectIntent(text) -> { category, matchedKeywords, score, negated, reason }
 * category is null when nothing confident (no un-negated evidence).
 */
export function detectIntent(text) {
  const tokens = tokenize(text);
  const results = [];
  let anyNegated = false;

  for (const { category, keywords } of TAXONOMY) {
    // Prefer longer phrases first so "running shoes" consumes "shoes".
    const entries = Object.entries(keywords).sort((a, b) => b[0].split(' ').length - a[0].split(' ').length);
    const used = new Set();
    const matched = [];
    let weight = 0;
    for (const [kw, w] of entries) {
      const pt = tokenize(kw);
      for (const idx of findPhrase(tokens, pt)) {
        const span = pt.map((_, j) => idx + j);
        if (span.some(p => used.has(p))) continue;
        span.forEach(p => used.add(p));
        if (isNegatedAt(tokens, idx)) { anyNegated = true; continue; }
        if (!matched.includes(kw)) { matched.push(kw); weight += w; }
      }
    }
    if (matched.length) results.push({ category, matchedKeywords: matched, weight });
  }

  if (!results.length) {
    return {
      category: null,
      matchedKeywords: [],
      score: 0,
      negated: anyNegated,
      reason: anyNegated ? 'NEGATED_KEYWORDS_ONLY' : 'NO_KEYWORD_MATCH'
    };
  }

  // Rank by total evidence weight, then by distinct keyword count.
  results.sort((a, b) => b.weight - a.weight || b.matchedKeywords.length - a.matchedKeywords.length);
  const best = results[0];
  const runnerUp = results[1];
  if (runnerUp && runnerUp.weight === best.weight && runnerUp.matchedKeywords.length === best.matchedKeywords.length) {
    return {
      category: null,
      matchedKeywords: [...best.matchedKeywords, ...runnerUp.matchedKeywords],
      score: 0,
      negated: anyNegated,
      reason: `AMBIGUOUS_TIE (${best.category} vs ${runnerUp.category})`
    };
  }

  // Heuristic score: evidence weight saturating at MAX_WEIGHT_SUM.
  // A single weak generic word (weight 1) yields 0.2.
  const score = Math.round(Math.min(1, best.weight / MAX_WEIGHT_SUM) * 100) / 100;
  return {
    category: best.category,
    matchedKeywords: best.matchedKeywords,
    score,
    negated: anyNegated,
    reason: `KEYWORD_MATCH (${best.matchedKeywords.join(', ')})`
  };
}
