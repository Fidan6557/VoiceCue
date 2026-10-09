"""
VoiceCue On-Device & Edge Intent Extractor
Extracts coarse categories from speech transcripts without retaining raw audio or PII.

NOTE: this is a rule-based keyword/phrase heuristic, not a trained model.
`score` is a heuristic evidence score in [0, 1] (matched keyword weights,
saturating), NOT a calibrated probability. It mirrors
frontend/src/services/intentEngine.js.
"""
import re
from typing import Dict, Any, List, Optional

NEGATORS = {"quit", "quitting", "avoid", "avoiding",
    "not", "no", "don't", "dont", "never", "without", "hate", "stop",
    "doesn't", "doesnt", "didn't", "didnt", "won't", "wont", "isn't", "isnt", "nothing",
}
SCOPE_BREAKERS = {"but", "though", "however", "although", "yet"}
NEGATION_WINDOW = 4
MAX_WEIGHT_SUM = 5.0


def tokenize(text: str) -> List[str]:
    text = (text or "").lower().replace("’", "'").replace("`", "'")
    return [t.strip("'") for t in re.split(r"[^a-z0-9']+", text) if t.strip("'")]


def find_phrase(tokens: List[str], phrase: List[str]) -> List[int]:
    n = len(phrase)
    return [i for i in range(len(tokens) - n + 1) if tokens[i:i + n] == phrase]


def is_negated_at(tokens: List[str], index: int) -> bool:
    for k in range(index - 1, max(0, index - NEGATION_WINDOW) - 1, -1):
        t = tokens[k]
        if t in SCOPE_BREAKERS:
            return False
        if t in NEGATORS:
            return True
        if t == "more" and k > 0 and tokens[k - 1] == "no":
            return True
    return False


class IntentExtractor:
    def __init__(self):
        # category -> {keyword/phrase: specificity weight (1 weak, 2 strong, 3 very specific phrase)}
        self.taxonomy: Dict[str, Dict[str, int]] = {
            "food.pizza": {"pizza": 2, "pepperoni": 2, "margherita": 2, "dodo": 1, "crust": 1, "slice": 1,
                           "want to eat": 1, "hungry": 1, "starving": 1, "food delivery": 2, "snack": 1,
                           "grab a bite": 1},
            "food.burger": {"burger": 2, "cheeseburger": 3, "whopper": 3, "mcdonalds": 2, "fast food": 2, "fries": 1},
            "food.sushi": {"sushi": 2, "sashimi": 2, "philadelphia roll": 3, "salmon": 1, "rolls": 1},
            "beverages.energy": {"energy drink": 3, "energy drinks": 3, "red bull": 3, "monster": 2, "burn": 1,
                                 "volt": 2, "caffeine": 2, "stamina": 1, "thirsty": 1, "need to drink": 1,
                                 "stay awake": 1, "energy boost": 2},
            "beverages.soda": {"coke": 2, "cola": 2, "soda": 2, "pepsi": 2, "lemonade": 2, "sprite": 2},
            "gaming.gear": {"headphones": 2, "headset": 2, "microphone": 2, "keyboard": 2, "mouse": 1, "mice": 1,
                            "monitor": 1, "gpu": 2, "graphics card": 3, "rtx": 2, "gaming": 1, "hyperx": 2,
                            "razer": 2, "logitech": 2},
            "clothing.footwear": {"sneakers": 2, "kicks": 1, "running shoes": 3, "shoes": 2, "nike": 2,
                                  "adidas": 2, "boots": 2, "footwear": 2},
            "entertainment.movies": {"movie": 2, "film": 2, "series": 1, "tv show": 2, "netflix": 2,
                                     "cinema": 2, "watch": 1, "streaming": 1},
        }

        # Hard-block sensitive topics (Never allow ad targeting on these). Word-boundary matched.
        self.sensitive_patterns = [
            r"\b(hospital|doctor|medicine|illness|disease|pills|diagnosis|depression)\b",
            r"\b(election|vote|voting|party|political|politics|president)\b",
            r"\b(casino|bet|betting|gamble|gambling|roulette|1xbet|slots)\b",
            r"\b(sex|porn|erotic|nsfw|xxx)\b",
            r"\b(vodka|beer|wine|alcohol|drunk|booze)\b",
            r"\b(credit|loan|payday loan|debt|bankruptcy)\b",
        ]

    def detect_intent(self, text: str) -> Dict[str, Any]:
        """Returns {category, matched_keywords, score, negated, reason}; category None if not confident."""
        tokens = tokenize(text)
        any_negated = False
        results = []
        for category, keywords in self.taxonomy.items():
            used = set()
            matched: List[str] = []
            weight = 0
            for kw, w in sorted(keywords.items(), key=lambda kv: -len(kv[0].split())):
                pt = tokenize(kw)
                for idx in find_phrase(tokens, pt):
                    span = range(idx, idx + len(pt))
                    if any(p in used for p in span):
                        continue
                    used.update(span)
                    if is_negated_at(tokens, idx):
                        any_negated = True
                        continue
                    if kw not in matched:
                        matched.append(kw)
                        weight += w
            if matched:
                results.append((weight, len(matched), category, matched))

        if not results:
            return {"category": None, "matched_keywords": [], "score": 0.0, "negated": any_negated,
                    "reason": "NEGATED_KEYWORDS_ONLY" if any_negated else "NO_KEYWORD_MATCH"}

        results.sort(key=lambda r: (-r[0], -r[1]))
        best = results[0]
        if len(results) > 1 and results[1][:2] == best[:2]:
            return {"category": None, "matched_keywords": best[3] + results[1][3], "score": 0.0,
                    "negated": any_negated, "reason": f"AMBIGUOUS_TIE ({best[2]} vs {results[1][2]})"}

        score = round(min(1.0, best[0] / MAX_WEIGHT_SUM), 2)
        return {"category": best[2], "matched_keywords": best[3], "score": score, "negated": any_negated,
                "reason": f"KEYWORD_MATCH ({', '.join(best[3])})"}

    def extract_intent(self, text: str) -> Dict[str, Any]:
        """
        Parses text and outputs a sanitized coarse intent tag.
        `confidence` is kept for API compatibility and equals the heuristic `score`.
        """
        clean_text = (text or "").lower().strip()

        # 1. Check for sensitive topics
        for pattern in self.sensitive_patterns:
            if re.search(pattern, clean_text):
                return {
                    "matched": False,
                    "blocked": True,
                    "reason": "SENSITIVE_TOPIC_REJECTED",
                    "category": None,
                    "score": 0.0,
                    "confidence": 0.0,
                }

        # 2. Rule-based taxonomy match with negation handling
        intent = self.detect_intent(clean_text)
        matched_keyword: Optional[str] = intent["matched_keywords"][0] if intent["matched_keywords"] else None
        return {
            "matched": intent["category"] is not None,
            "blocked": False,
            "category": intent["category"] or "general.contextual",
            "score": intent["score"],
            "confidence": intent["score"],  # heuristic, equals score; not a calibrated probability
            "matched_keyword": matched_keyword if intent["category"] else None,
            "matched_keywords": intent["matched_keywords"] if intent["category"] else [],
            "negated": intent["negated"],
            "reason": intent["reason"],
            "anonymized": True,
        }
