// VoiceCue Speech Recognition & Edge Intent Extractor

export class SpeechRecognizer {
  constructor(options = {}) {
    this.onIntentExtracted = options.onIntentExtracted || (() => {});
    this.onSpeechStatus = options.onSpeechStatus || (() => {});
    this.onTranscript = options.onTranscript || (() => {});

    this.isListening = false;
    this.recognition = null;
    this.initWebSpeech();

    // Taxonomy rules (on-device extractor)
    this.taxonomy = [
      {
        category: 'food.pizza',
        keywords: ['pizza', 'pepperoni', 'hungry', 'food', 'starving', 'eat', 'slice'],
        confidence: 0.95
      },
      {
        category: 'gaming.gear',
        keywords: ['headphones', 'microphone', 'mic', 'headset', 'audio', 'keyboard', 'mouse', 'gpu', 'gaming', 'gear'],
        confidence: 0.92
      },
      {
        category: 'beverages.energy',
        keywords: ['drink', 'energy', 'thirst', 'thirsty', 'soda', 'volt', 'burn', 'monster', 'red bull'],
        confidence: 0.90
      },
      {
        category: 'clothing.footwear',
        keywords: ['sneakers', 'shoes', 'boots', 'kicks', 'running shoes', 'footwear'],
        confidence: 0.88
      }
    ];

    // Sensitive categories (hard-blocked)
    this.sensitiveKeywords = [
      'casino', 'bet', 'betting', 'roulette', '1xbet', 'gambling',
      'election', 'politics', 'president', 'party',
      'sex', 'porn', 'nsfw', 'vodka', 'beer', 'alcohol', 'drugs'
    ];
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

  // Simulated or real transcript analysis
  processTranscript(transcript) {
    const lower = transcript.toLowerCase().trim();

    // 1. Sensitive check
    for (const bad of this.sensitiveKeywords) {
      if (lower.includes(bad)) {
        this.onIntentExtracted({
          blocked: true,
          reason: `SENSITIVE_TOPIC_REJECTED (${bad})`,
          transcript,
          category: null,
          confidence: 0
        });
        return;
      }
    }

    // 2. Taxonomy matching
    let matched = null;
    for (const item of this.taxonomy) {
      for (const kw of item.keywords) {
        if (lower.includes(kw)) {
          matched = {
            category: item.category,
            confidence: item.confidence,
            matchedKeyword: kw,
            transcript,
            blocked: false
          };
          break;
        }
      }
      if (matched) break;
    }

    if (matched) {
      this.onIntentExtracted(matched);
    } else {
      this.onIntentExtracted({
        category: 'general.contextual',
        confidence: 0.45,
        matchedKeyword: null,
        transcript,
        blocked: false
      });
    }
  }

  // Helper to test voice phrases directly
  simulateVoice(phrase) {
    this.onTranscript(phrase);
    this.processTranscript(phrase);
  }
}
