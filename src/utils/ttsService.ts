/**
 * ttsService.ts
 * ──────────────────────────────────────────────────────────────────
 * Text-to-Speech service using Web Speech API (SpeechSynthesis).
 * Speaks AI responses in Hindi voice.
 * ──────────────────────────────────────────────────────────────────
 */

let synth: SpeechSynthesis | null = null;
let hindiVoice: SpeechSynthesisVoice | null = null;
let isInitialized = false;

function init() {
  if (isInitialized) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  synth = window.speechSynthesis;
  isInitialized = true;

  // Load voices — Hindi voice may load async
  const loadVoices = () => {
    const voices = synth!.getVoices();
    // Priority: hi-IN > Indian English > any Hindi
    hindiVoice =
      voices.find(v => v.lang === 'hi-IN') ||
      voices.find(v => v.lang.startsWith('hi')) ||
      voices.find(v => v.lang === 'en-IN') ||
      voices.find(v => v.lang.startsWith('en')) ||
      null;
  };

  loadVoices();
  synth.onvoiceschanged = loadVoices;
}

/**
 * Speak text in Hindi voice.
 * Strips emojis and special chars for cleaner speech.
 */
export function speak(text: string): void {
  init();
  if (!synth) return;

  // Cancel any ongoing speech
  synth.cancel();

  // Clean text for speech — remove emojis, markdown, special chars
  const cleanText = text
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/[*#`_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);

  if (hindiVoice) {
    utterance.voice = hindiVoice;
  }

  utterance.lang = 'hi-IN';
  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  synth.speak(utterance);
}

/** Stop ongoing speech */
export function stopSpeaking(): void {
  init();
  synth?.cancel();
}

/** Check if TTS is available */
export function isTTSAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.speechSynthesis;
}

/** Check if currently speaking */
export function isSpeaking(): boolean {
  init();
  return synth?.speaking ?? false;
}
