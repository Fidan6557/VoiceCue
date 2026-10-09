from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from intent_extractor import IntentExtractor
from moderation_classifier import ModerationClassifier

app = FastAPI(
    title="VoiceCue ML Service",
    description="Edge Intent Extractor & AI Multi-modal Creative Moderation API",
    version="1.0.0"
)

extractor = IntentExtractor()
classifier = ModerationClassifier()

class IntentRequest(BaseModel):
    transcript: str
    locale: Optional[str] = "ru-RU"

class ModerationRequest(BaseModel):
    brandName: str
    headline: str
    callToAction: Optional[str] = ""
    tagline: Optional[str] = ""
    category: Optional[str] = "general"

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "VoiceCue ML Service",
        "models_loaded": ["IntentExtractor_v2", "BrandSafetyClassifier_L2"]
    }

@app.post("/extract-intent")
def extract_intent(req: IntentRequest):
    """
    On-device / Edge intent extraction endpoint.
    Converts speech transcript to sanitized coarse category.
    """
    if not req.transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")
    result = extractor.extract_intent(req.transcript)
    return result

@app.post("/moderate-creative")
def moderate_creative(req: ModerationRequest):
    """
    Layer 2 AI Creative Moderation endpoint.
    Evaluates banner copy, age rating, and brand safety index.
    """
    payload = {
        "brandName": req.brandName,
        "headline": req.headline,
        "callToAction": req.callToAction,
        "tagline": req.tagline,
        "category": req.category
    }
    result = classifier.evaluate_creative(payload)
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
