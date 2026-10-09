"""
VoiceCue Creative Moderation Classifier

NOTE: rule-based heuristic (word-boundary rules + obfuscation normalization),
not a trained ML model. `risk_score` / `score` are deterministic heuristics,
not calibrated probabilities. Mirrors backend/src/services/moderationPipeline.js.
"""
import re
from typing import Dict, Any, List

LEET_MAP = {"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b",
            "@": "a", "$": "s", "!": "i", "|": "i", "+": "t"}


def normalize_text(raw: str) -> str:
    """Undo common obfuscation: leetspeak, dotted/dashed letters, spaced letters, repeats."""
    t = (raw or "").lower()
    chars = list(t)
    for i, ch in enumerate(chars):
        if ch in LEET_MAP:
            prev = t[i - 1] if i > 0 else ""
            nxt = t[i + 1] if i + 1 < len(t) else ""
            if prev.isalpha() or nxt.isalpha():
                chars[i] = LEET_MAP[ch]
    t = "".join(chars)
    t = re.sub(r"([a-z])[.\-_*]+(?=[a-z])", r"\1", t)                      # k.i.l.l
    t = re.sub(r"\b(?:[a-z] ){2,}[a-z]\b", lambda m: m.group(0).replace(" ", ""), t)  # k i l l
    t = re.sub(r"([a-z])\1{2,}", r"\1", t)                                 # kiiill -> kill
    t = re.sub(r"[^a-z0-9%\s]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


# (pattern, category). Word boundaries avoid false positives like "skill", "class", "assessment".
PROHIBITED_RULES = [
    (r"\b(100% guarantee|easy money|get rich quick|quick money|crypto|scam|jackpot|win money)\b", "financial_scam"),
    (r"\b(buy now or regret|shock content|click here|urgent)\b", "manipulative_copy"),
    (r"\b(casino|slots|sports betting|betting|gambling|1xbet)\b", "gambling"),
    (r"\b(porn|sex|nsfw)\b", "adult"),
    (r"\b(drugs|narcotics)\b", "drugs"),
    (r"\b(kill(?:s|er|ers|ing)?|weapons?)\b", "violence"),
    (r"\b(hate(?:s|rs)?)\b", "hate"),
]


def find_violations(text: str) -> List[Dict[str, str]]:
    normalized = normalize_text(text)
    plain = re.sub(r"[^a-z0-9%\s]+", " ", (text or "").lower())
    out = []
    for pattern, category in PROHIBITED_RULES:
        m = re.search(pattern, normalized) or re.search(pattern, plain)
        if m:
            out.append({"term": m.group(0), "category": category})
    return out


class ModerationClassifier:
    def evaluate_creative(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates creative headline, tagline and call to action with heuristic rules.
        """
        headline = payload.get("headline", "") or ""
        tagline = payload.get("tagline", "") or ""
        cta = payload.get("callToAction", "") or ""
        full_text = f"{headline} {tagline} {cta}"

        violations = find_violations(full_text)
        reasons = [f"PROHIBITED_TERM:{v['term']} ({v['category']})" for v in violations]

        if violations:
            return {
                "decision": "REJECT",
                "risk_score": 1.0,
                "score": 0.0,
                "brand_safety_rating": "CRITICAL_VIOLATION",
                "reasons": reasons,
                "flags": {
                    "prohibited_terms": [v["term"] for v in violations],
                    "categories": sorted({v["category"] for v in violations}),
                },
                "recommendation": "Automatically rejected by rule-based Layer 2 filter.",
            }

        # Deterministic heuristic risk from observable copy features
        risk = 0.0
        letters = re.sub(r"[^A-Za-z]", "", full_text)
        if len(letters) > 8 and sum(c.isupper() for c in letters) / len(letters) > 0.7:
            risk += 0.15
            reasons.append("EXCESSIVE_CAPS")
        if full_text.count("!") >= 3:
            risk += 0.1
            reasons.append("EXCESSIVE_EXCLAMATION")
        if len(headline.strip()) < 5:
            risk += 0.1
            reasons.append("HEADLINE_TOO_SHORT")
        risk = round(min(1.0, risk), 2)

        return {
            "decision": "PASS_TO_STUDIO_QUEUE",
            "risk_score": risk,
            "score": round(1.0 - risk, 2),  # heuristic, not a calibrated probability
            "brand_safety_rating": "NO_RULE_VIOLATIONS",
            "reasons": reasons,
            "flags": {
                "prohibited_terms": [],
                "brand_safety_percentage": f"{round((1.0 - risk) * 100, 1)}%",
            },
            "recommendation": "No rule violations found. Requires studio administrator sign-off.",
        }
