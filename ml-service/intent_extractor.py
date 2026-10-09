"""
VoiceCue On-Device & Edge Intent Extractor
Extracts coarse categories from speech transcripts without retaining raw audio or PII.
"""
import re
from typing import Dict, Any, Optional

class IntentExtractor:
    def __init__(self):
        # Taxonomy mapping: pattern -> coarse category
        self.category_patterns = {
            "food.pizza": [
                r"\b(pizza|pepperoni|margherita|dodo|slice|crust)\b",
                r"\b(want to eat|hungry|starving|food delivery|snack|grab a bite)\b"
            ],
            "food.burger": [
                r"\b(burger|cheeseburger|whopper|mcdonalds|fast food|fries)\b"
            ],
            "food.sushi": [
                r"\b(sushi|roll|rolls|salmon|philadelphia roll|sashimi)\b"
            ],
            "beverages.energy": [
                r"\b(energy drink|red bull|monster|burn|volt|caffeine|stamina)\b",
                r"\b(thirsty|need to drink|stay awake|energy boost)\b"
            ],
            "beverages.soda": [
                r"\b(coke|cola|soda|pepsi|lemonade|sprite)\b"
            ],
            "gaming.gear": [
                r"\b(headphones|headset|microphone|keyboard|mouse|mice)\b",
                r"\b(monitor|gpu|graphics card|rtx|gaming|hyperx|razer|logitech)\b"
            ],
            "clothing.footwear": [
                r"\b(sneakers|kicks|running shoes|shoes|nike|adidas|boots|footwear)\b"
            ],
            "entertainment.movies": [
                r"\b(movie|film|series|tv show|netflix|cinema|watch|streaming)\b"
            ]
        }

        # Hard-block sensitive topics (Never allow ad targeting on these)
        self.sensitive_patterns = [
            r"\b(hospital|doctor|medicine|illness|disease|pills|diagnosis|depression)\b",
            r"\b(election|vote|voting|party|political|politics|president)\b",
            r"\b(casino|bet|betting|gamble|gambling|roulette|1xbet|slots)\b",
            r"\b(sex|porn|erotic|nsfw|xxx)\b",
            r"\b(vodka|beer|wine|alcohol|drunk|booze)\b",
            r"\b(credit|loan|payday loan|debt|bankruptcy)\b"
        ]

    def extract_intent(self, text: str) -> Dict[str, Any]:
        """
        Parses text and outputs a sanitized coarse intent tag.
        """
        clean_text = text.lower().strip()

        # 1. Check for sensitive topics
        for pattern in self.sensitive_patterns:
            if re.search(pattern, clean_text):
                return {
                    "matched": False,
                    "blocked": True,
                    "reason": "SENSITIVE_TOPIC_REJECTED",
                    "category": None,
                    "confidence": 0.0
                }

        # 2. Check taxonomy patterns
        best_category = None
        best_confidence = 0.0
        matched_keyword = None

        for category, patterns in self.category_patterns.items():
            for p in patterns:
                match = re.search(p, clean_text)
                if match:
                    confidence = 0.94 if category in ["food.pizza", "gaming.gear", "beverages.energy"] else 0.85
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_category = category
                        matched_keyword = match.group(0)

        if best_category:
            return {
                "matched": True,
                "blocked": False,
                "category": best_category,
                "confidence": best_confidence,
                "matched_keyword": matched_keyword,
                "anonymized": True
            }

        return {
            "matched": False,
            "blocked": False,
            "category": "general.contextual",
            "confidence": 0.40,
            "matched_keyword": None,
            "anonymized": True
        }
