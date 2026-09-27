/**
 * VoiceSearchMic — Search bar ke andar chhota mic button.
 * Tap → bolo ("chini", "Raju", "98765...") → text search box mein bhar jata hai.
 *
 * Usage:
 *   <div className="relative">
 *     <Search ... />
 *     <Input ... className="pl-12 pr-12 ..." />
 *     <VoiceSearchMic onResult={t => setSearchQuery(t)} />
 *   </div>
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import { Mic } from 'lucide-react';
import { createVoiceService, VoiceService } from '@/utils/voiceService';
import { useApp } from '@/context/AppContext';

interface VoiceSearchMicProps {
  onResult: (text: string) => void;
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

/** STT transcript saaf karo: danda/punctuation trim, Devanagari digits → ASCII */
export function cleanVoiceSearchText(raw: string): string {
  let t = (raw || '').trim();
  // Devanagari digits (०-९) → 0-9 (hi-IN STT aksar Devanagari mein deta hai)
  t = t.replace(/[०-९]/g, d => String(DEVANAGARI_DIGITS.indexOf(d)));
  // Trailing/leading punctuation hatao (। . , ? ! waghera) — beech wali jagah banao
  t = t.replace(/^[।.,?!;:'"()\-–—\s]+/, '').replace(/[।.,?!;:'"()\-–—\s]+$/, '');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

export function VoiceSearchMic({ onResult }: VoiceSearchMicProps) {
  const { showToast } = useApp();
  const [listening, setListening] = useState(false);
  const svcRef = useRef<ReturnType<typeof createVoiceService> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    return () => { try { svcRef.current?.destroy(); } catch { /* noop */ } };
  }, []);

  const stop = useCallback(() => {
    try { svcRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) { stop(); return; }
    if (!VoiceService.isSupported()) {
      showToast('Is browser mein voice search supported nahi hai (Chrome use karo)', 'error');
      return;
    }
    try { svcRef.current?.destroy(); } catch { /* noop */ }
    const svc = createVoiceService({
      onListeningStart: () => setListening(true),
      onFinalResult: (text) => {
        const clean = cleanVoiceSearchText(text);
        if (clean) onResultRef.current(clean);
        setListening(false);
      },
      onError: (err) => {
        showToast(err.message, 'error');
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    svcRef.current = svc;
    try {
      svc.start();
    } catch {
      showToast('Mic start nahi hua', 'error');
      setListening(false);
    }
  }, [listening, stop, showToast]);

  if (typeof window !== 'undefined' && !VoiceService.isSupported()) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Sun raha hai... tap karke roko' : 'Bolkar search karo'}
      aria-label={listening ? 'Stop voice search' : 'Voice search'}
      className={`absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
        listening
          ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-300'
          : 'bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600'
      }`}
    >
      <Mic className="w-4 h-4" />
      {listening && (
        <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
      )}
    </button>
  );
}
