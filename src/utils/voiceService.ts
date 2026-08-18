/**
 * voiceService.ts
 * ──────────────────────────────────────────────────────────────────
 * Handles microphone access and Web Speech API (SpeechRecognition).
 *
 * Supports:
 *  - Hindi (hi-IN), Hinglish, and English (en-IN) recognition
 *  - Callback-based API for clean integration with React hooks
 *  - Full error classification with human-readable Hindi messages
 *  - Graceful degradation when browser does not support the API
 *
 * NO external network calls — runs 100 % offline once the browser's
 * speech engine is downloaded (Chrome/Edge ship it bundled).
 * ──────────────────────────────────────────────────────────────────
 */

// ── Browser API type augmentation ──────────────────────────────────
// TypeScript does not ship SpeechRecognition types by default;
// we declare a minimal compatible interface here.
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  // Config
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  // Lifecycle
  start(): void;
  stop(): void;
  abort(): void;
  // Events
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
  onspeechstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onspeechend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onnomatch: ((this: ISpeechRecognition, ev: Event) => void) | null;
}

// ── Public Types ────────────────────────────────────────────────────

/** Current state of the voice recognition session */
export type VoiceStatus =
  | 'idle'           // No session active
  | 'requesting'     // Asking for mic permission
  | 'listening'      // Actively listening for speech
  | 'processing'     // Final result received, being parsed
  | 'error';         // Something went wrong

/** Detailed error codes returned by the service */
export type VoiceErrorCode =
  | 'NOT_SUPPORTED'         // Browser lacks SpeechRecognition API
  | 'MIC_DENIED'            // User blocked microphone permission
  | 'MIC_NOT_FOUND'         // No microphone hardware detected
  | 'NO_SPEECH'             // Silence timeout — nothing was said
  | 'NETWORK_ERROR'         // Chrome needs network for first boot (rare)
  | 'ABORTED'               // Manually stopped by the user / component
  | 'UNRECOGNIZABLE'        // Audio captured but cannot be transcribed
  | 'UNKNOWN';              // Catch-all fallback

/** Structured error with both code and a localised Hindi/English message */
export interface VoiceError {
  code: VoiceErrorCode;
  /** Human-readable message suitable for showing in a toast/alert */
  message: string;
}

/** Callbacks injected when creating a VoiceService instance */
export interface VoiceServiceCallbacks {
  /** Called once when mic becomes active */
  onListeningStart?: () => void;
  /** Called with the live (interim) transcript while the user speaks */
  onInterimResult?: (transcript: string) => void;
  /** Called with the final, confirmed transcript string */
  onFinalResult: (transcript: string) => void;
  /** Called on any error with a structured VoiceError object */
  onError: (error: VoiceError) => void;
  /** Called when the recognition session ends for any reason */
  onEnd?: () => void;
}

// ── Hindi / Hinglish error messages map ────────────────────────────
const ERROR_MESSAGES: Record<VoiceErrorCode, string> = {
  NOT_SUPPORTED:   'Aapka browser voice input support nahi karta. Chrome ya Edge use karein.',
  MIC_DENIED:      'Microphone access deny kar diya. Browser settings mein permission allow karein.',
  MIC_NOT_FOUND:   'Koi microphone nahi mila. Device mein mic connected hai?',
  NO_SPEECH:       'Kuch nahi suna. Phir se bolein.',
  NETWORK_ERROR:   'Network error aaya. Ek baar internet check karein ya phir koshish karein.',
  ABORTED:         'Voice input band kar diya.',
  UNRECOGNIZABLE:  'Aawaz samajh nahi aai. Clearly bolein — jaise "2 kilo aata".',
  UNKNOWN:         'Kuch galat ho gaya. Phir se koshish karein.',
};

/**
 * Maps the raw Web Speech API `error` string → our `VoiceErrorCode`.
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognitionErrorEvent/error
 */
function mapBrowserError(raw: string): VoiceErrorCode {
  switch (raw) {
    case 'not-allowed':
    case 'permission-denied': return 'MIC_DENIED';
    case 'audio-capture':     return 'MIC_NOT_FOUND';
    case 'no-speech':         return 'NO_SPEECH';
    case 'network':           return 'NETWORK_ERROR';
    case 'aborted':           return 'ABORTED';
    case 'bad-grammar':
    case 'language-not-supported': return 'UNRECOGNIZABLE';
    default:                  return 'UNKNOWN';
  }
}

// ── VoiceService Class ──────────────────────────────────────────────

/**
 * VoiceService
 *
 * Wraps the browser's SpeechRecognition API into a simple,
 * callback-driven service class.
 *
 * Usage:
 * ```ts
 * const svc = createVoiceService({
 *   onFinalResult: (t) => console.log('Said:', t),
 *   onError: (e) => console.error(e.message),
 * });
 * svc.start();   // begin listening
 * svc.stop();    // stop manually
 * svc.destroy(); // cleanup before unmount
 * ```
 */
export class VoiceService {
  private recognition: ISpeechRecognition | null = null;
  private callbacks: VoiceServiceCallbacks;
  private _status: VoiceStatus = 'idle';

  /** True when SpeechRecognition is supported in this browser */
  static isSupported(): boolean {
    return !!(
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    );
  }

  constructor(callbacks: VoiceServiceCallbacks) {
    this.callbacks = callbacks;

    if (!VoiceService.isSupported()) {
      return; // will error on start()
    }

    // Normalise vendor-prefixed constructor
    const SpeechRecognitionCtor = (
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    ) as new () => ISpeechRecognition;

    this.recognition = new SpeechRecognitionCtor();
    this._configure();
  }

  /** Read-only current status */
  get status(): VoiceStatus {
    return this._status;
  }

  // ── Private: wire up the recognition instance ───────────────────

  private _configure() {
    if (!this.recognition) return;
    const r = this.recognition;

    /**
     * Language priority:
     *  1. hi-IN  — pure Hindi (best for kirana commands)
     *  2. en-IN  — Indian English fallback
     * Chrome picks the best match; it will handle Hinglish naturally
     * because shopkeepers mix both ("2 packet maggi dena").
     *
     * Note: Only one lang can be set; we choose hi-IN because
     * Chrome's hi-IN model already handles common English brand names
     * like "Maggi", "Aashirvaad", "Parle-G" etc.
     */
    r.lang = 'hi-IN';

    // Single utterance mode — one command at a time
    r.continuous = false;

    // Receive partial results for live UI feedback
    r.interimResults = true;

    // Only take the top-1 alternative (most confident)
    r.maxAlternatives = 1;

    // ── Event Handlers ────────────────────────────────────────────

    r.onstart = () => {
      this._status = 'listening';
      this.callbacks.onListeningStart?.();
    };

    r.onspeechstart = () => {
      // Speech detected — good, keep listening
    };

    r.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alt = result[0];
        if (result.isFinal) {
          finalTranscript += alt.transcript;
        } else {
          interim += alt.transcript;
        }
      }

      // Broadcast interim for live display
      if (interim) {
        this.callbacks.onInterimResult?.(interim);
      }

      // Process the confirmed transcript
      if (finalTranscript) {
        this._status = 'processing';
        // Normalise: trim whitespace, lowercase for parser
        const clean = finalTranscript.trim().toLowerCase();
        this.callbacks.onFinalResult(clean);
      }
    };

    r.onspeechend = () => {
      // Speech ended; SpeechRecognition will fire onend momentarily
      this.recognition?.stop();
    };

    r.onerror = (event: SpeechRecognitionErrorEvent) => {
      const code = mapBrowserError(event.error);
      this._status = 'error';
      this.callbacks.onError({
        code,
        message: ERROR_MESSAGES[code],
      });
    };

    r.onnomatch = () => {
      this._status = 'error';
      this.callbacks.onError({
        code: 'UNRECOGNIZABLE',
        message: ERROR_MESSAGES.UNRECOGNIZABLE,
      });
    };

    r.onend = () => {
      if (this._status !== 'error' && this._status !== 'processing') {
        this._status = 'idle';
      }
      this.callbacks.onEnd?.();
    };
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Start a new recognition session.
   * Fires onListeningStart callback when mic activates.
   */
  start(): void {
    if (!VoiceService.isSupported()) {
      this._status = 'error';
      this.callbacks.onError({
        code: 'NOT_SUPPORTED',
        message: ERROR_MESSAGES.NOT_SUPPORTED,
      });
      return;
    }

    // Prevent double-start
    if (this._status === 'listening') {
      this.stop();
      return;
    }

    try {
      this._status = 'requesting';
      this.recognition?.start();
    } catch (err) {
      // InvalidStateError if already running — safe to ignore
      console.warn('[VoiceService] start() error:', err);
    }
  }

  /**
   * Gracefully stop the current session.
   * Will still fire onFinalResult if partial speech was captured.
   */
  stop(): void {
    try {
      this.recognition?.stop();
    } catch {
      // Already stopped — ignore
    }
    this._status = 'idle';
  }

  /**
   * Hard-abort: discards any in-progress audio without firing results.
   * Use when the user explicitly cancels.
   */
  abort(): void {
    try {
      this.recognition?.abort();
    } catch {
      // Already aborted — ignore
    }
    this._status = 'idle';
  }

  /**
   * Clean up: call in useEffect cleanup / component unmount.
   * Prevents memory leaks and dangling event listeners.
   */
  destroy(): void {
    this.abort();
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      this.recognition.onspeechstart = null;
      this.recognition.onspeechend = null;
      this.recognition.onnomatch = null;
      this.recognition = null;
    }
  }
}

/**
 * Factory function — preferred way to create a VoiceService.
 * ```ts
 * const svc = createVoiceService({ onFinalResult, onError });
 * ```
 */
export function createVoiceService(callbacks: VoiceServiceCallbacks): VoiceService {
  return new VoiceService(callbacks);
}
