// VoiceCue Speech Recognition & Edge Intent Extractor
import { detectIntent, detectSensitive, TAXONOMY, SENSITIVE_KEYWORDS } from './intentEngine.js';

export class SpeechRecognizer {
  constructor(options = {}) {
    this.onIntentExtracted = options.onIntentExtracted || (() => {});
    this.onSpeechStatus = options.onSpeechStatus || (() => {});
    this.onTranscript = options.onTranscript || (() => {});

    this.isListening = false;
    this.recognition = null;
    this.initWebSpeech();

    // Taxonomy + sensitive keyword rules live in ./intentEngine.js (pure, rule-based).
    this.taxonomy = TAXONOMY;
    this.sensitiveKeywords = SENSITIVE_KEYWORDS;
  }

  initWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.onSpeechStatus({ listening: true, text: 'Listening to speech...' });
      };

      this.recognition.onresult = (event) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript;
        this.onTranscript(transcript);
        this.processTranscript(transcript);
      };

      this.recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        this.onSpeechStatus({ listening: false, text: `Error: ${event.error}` });
      };

      this.recognition.onend = () => {
        if (this.isListening) {
          try { this.recognition.start(); } catch (e) {}
        } else {
          this.onSpeechStatus({ listening: false, text: 'Microphone disconnected' });
        }
      };
    }
  }

  start() {
    if (!this.recognition) {
      this.onSpeechStatus({ listening: true, text: 'Simulation mode (WebSpeech not supported)' });
      return;
    }
    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      console.warn('Already started or mic permission issue', e);
    }
  }

  stop() {
    this.isListening = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch (e) {}
    }
    this.onSpeechStatus({ listening: false, text: 'Microphone turned off' });
  }

  // Simulated or real transcript analysis (rule-based heuristic, see intentEngine.js)
  processTranscript(transcript) {
    // 1. Sensitive check (word-boundary)
    const bad = detectSensitive(transcript);
    if (bad) {
      this.onIntentExtracted({
        blocked: true,
        reason: `SENSITIVE_TOPIC_REJECTED (${bad})`,
        transcript,
        category: null,
        score: 0,
        confidence: 0
      });
      return;
    }

    // 2. Taxonomy matching with word boundaries, negation and evidence scoring
    const intent = detectIntent(transcript);
    // NOTE: `confidence` is kept only for backwards compatibility with callers;
    // it equals `score`, a heuristic evidence score, not a calibrated probability.
    this.onIntentExtracted({
      category: intent.category || 'general.contextual',
      score: intent.score,
      confidence: intent.score,
      matchedKeyword: intent.matchedKeywords[0] || null,
      matchedKeywords: intent.matchedKeywords,
      negated: intent.negated,
      reason: intent.reason,
      matched: Boolean(intent.category),
      transcript,
      blocked: false
    });
  }

  // Helper to test voice phrases directly
  simulateVoice(phrase) {
    this.onTranscript(phrase);
    this.processTranscript(phrase);
  }
}
