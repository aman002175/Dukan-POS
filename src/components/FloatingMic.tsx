// Floating Mic — AI CONTROLLER. No visible button — controlled by Header.
import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, X, Volume2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { askAI } from '@/utils/aiService';
import { createVoiceService, type VoiceStatus } from '@/utils/voiceService';
import { speak, stopSpeaking } from '@/utils/ttsService';
import { parseVoiceCommand } from '@/utils/parserUtil';
import { saveMessageToActiveConversation } from '@/utils/chatStorage';
import type { CartItem, TabType } from '@/types';

// Preprocess voice input: convert Hindi number words to actual numbers
function preprocessVoiceInput(transcript: string): string {
  const parsed = parseVoiceCommand(transcript);
  if (!parsed.quantityExplicit || parsed.quantity === 1) return transcript;
  return transcript
    .replace(/\b(saadhe?|साढ़े?|dedh|डेढ़|dhai|ढाई|paune|पौने|sawa|सवा|aadha|आधा|aadhe|आधे)\b/gi, '')
    .replace(/\b(bees|बीस|unnis|उन्नीस|atharah|अट्ठारह|satrah|सत्रह|solah|सोलह|pandrah|पन्द्रा|chaudah|चौदह|terah|तेरह|baarah|बारह|gyarah|ग्यारह|das|दस|nau|नौ|aath|आठ|saat|सात|chhe|छह|paanch|पांच|char|चार|teen|तीन|do|दो|ek|एक)\b/gi, '')
    .replace(/\s+/g, ' ').trim().replace(/^/, parsed.quantity + ' ').trim();
}

interface FloatingMicProps {
  activeTab: TabType;
}

export function FloatingMic({ activeTab }: FloatingMicProps) {
  const { state, showToast } = useApp();
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [lastAction, setLastAction] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const voiceRef = useRef<ReturnType<typeof createVoiceService> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cartRef = useRef<CartItem[]>([]);

  // Notify Header of status changes
  const updateStatus = useCallback((status: string) => {
    window.dispatchEvent(new CustomEvent('mic-status-changed', { detail: { status } }));
  }, []);

  useEffect(() => { return () => { voiceRef.current?.destroy(); if (feedbackTimer.current) clearTimeout(feedbackTimer.current); }; }, []);

  // Listen for cart updates from POSSection
  useEffect(() => {
    const handler = (e: Event) => { cartRef.current = (e as CustomEvent).detail?.cart || []; };
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  // Listen for toggle-mic from Header — Tapping mic interrupts AI speech & starts new prompt listening immediately
  useEffect(() => {
    const handler = () => {
      // 1. Immediately stop any ongoing AI audio speech & clear feedback toast
      stopSpeaking();
      setShowFeedback(false);

      if (voiceStatus === 'listening') {
        // If actively listening, tap stops the microphone
        voiceRef.current?.stop();
        setVoiceStatus('idle');
        updateStatus('idle');
        setInterimText('');
      } else {
        // If idle, processing, or interrupting an old AI response: start listening to new prompt right away!
        if (voiceRef.current) {
          try { voiceRef.current.destroy(); } catch {}
        }
        setIsProcessing(false);

        const svc = createVoiceService({
          onListeningStart: () => { setVoiceStatus('listening'); updateStatus('listening'); setInterimText(''); },
          onInterimResult: (t) => setInterimText(t),
          onFinalResult: (t) => { setInterimText(''); processVoice(t); },
          onError: (err) => { showToast(err.message, 'error'); setVoiceStatus('idle'); updateStatus('idle'); setInterimText(''); },
          onEnd: () => { setVoiceStatus('idle'); updateStatus('idle'); setInterimText(''); },
        });
        voiceRef.current = svc;
        svc.start();
      }
    };
    window.addEventListener('toggle-mic', handler);
    return () => window.removeEventListener('toggle-mic', handler);
  }, [voiceStatus, isProcessing, showToast, updateStatus]);

  // Auto-hide feedback
  useEffect(() => {
    if (!showFeedback) return;
    feedbackTimer.current = setTimeout(() => setShowFeedback(false), 5000);
    return () => { if (feedbackTimer.current) clearTimeout(feedbackTimer.current); };
  }, [showFeedback, lastAction]);

  // ── Execute action from AI response ──
  const executeAction = useCallback((action: { type: string; [key: string]: unknown } | undefined, answerText: string) => {
    if (!action || action.type === 'none') { speak(answerText); return; }

    switch (action.type) {
      case 'add_to_cart': {
        const items = action.items as Array<{ productId: string; quantity: number }> | undefined;
        items?.forEach(item => {
          window.dispatchEvent(new CustomEvent('ai-add-to-cart', { detail: { productId: item.productId, quantity: item.quantity || 1 } }));
        });
        speak(answerText);
        break;
      }
      case 'record_cash': {
        window.dispatchEvent(new CustomEvent('ai-record-bill', {
          detail: { type: 'cash', items: action.items, total: action.total }
        }));
        speak(answerText);
        break;
      }
      case 'record_udhaar': {
        window.dispatchEvent(new CustomEvent('ai-record-bill', {
          detail: {
            type: 'udhaar',
            customerId: action.customerId,
            customerName: action.customerName,
            items: action.items,
            total: action.total
          }
        }));
        speak(answerText);
        break;
      }
      case 'record_payment': {
        window.dispatchEvent(new CustomEvent('ai-record-payment', {
          detail: {
            customerId: action.customerId,
            customerName: action.customerName,
            amount: action.amount
          }
        }));
        speak(answerText);
        break;
      }
      case 'add_product': { window.dispatchEvent(new CustomEvent('ai-add-product', { detail: action })); speak(answerText); break; }
      case 'edit_product': { window.dispatchEvent(new CustomEvent('ai-edit-product', { detail: action })); speak(answerText); break; }
      case 'delete_product': { window.dispatchEvent(new CustomEvent('ai-delete-product', { detail: action })); speak(answerText); break; }
      case 'update_stock': { window.dispatchEvent(new CustomEvent('ai-update-stock', { detail: action })); speak(answerText); break; }
      case 'add_customer': { window.dispatchEvent(new CustomEvent('ai-add-customer', { detail: action })); speak(answerText); break; }
      case 'edit_customer': { window.dispatchEvent(new CustomEvent('ai-edit-customer', { detail: action })); speak(answerText); break; }
      case 'delete_customer': { window.dispatchEvent(new CustomEvent('ai-delete-customer', { detail: action })); speak(answerText); break; }
      case 'delete_sale': { window.dispatchEvent(new CustomEvent('ai-delete-sale', { detail: action })); speak(answerText); break; }
      case 'bulk_import': { window.dispatchEvent(new CustomEvent('ai-bulk-import', { detail: action })); speak(answerText); break; }
      case 'clarify_product':
      case 'clarify_customer': { speak(answerText); break; }
      default: { speak(answerText); break; }
    }
  }, []);

  // ── Process voice input through Inception API ──
  const processVoice = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setIsProcessing(true);
    setVoiceStatus('processing');
    updateStatus('processing');
    try {
      const processedText = preprocessVoiceInput(text);
      const response = await askAI(processedText, state, [], cartRef.current, activeTab);
      const actionType = response.action?.type || 'none';
      const summary = actionType !== 'none' ? `[${actionType}] ${response.answer.slice(0, 60)}` : response.answer.slice(0, 80);
      setLastAction(summary);
      setShowFeedback(true);
      executeAction(response.action, response.answer);
      saveMessageToActiveConversation(processedText, response.answer);
    } catch { showToast('AI se response nahi aaya', 'error'); }
    finally { setIsProcessing(false); setVoiceStatus('idle'); updateStatus('idle'); setInterimText(''); }
  }, [state, activeTab, isProcessing, showToast, executeAction, updateStatus]);

  return (
    <>
      {/* Feedback toast */}
      {showFeedback && lastAction && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[90%]">
          <div className="bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3">
            <Volume2 className="w-4 h-4 text-green-400 flex-shrink-0 animate-pulse" />
            <p className="text-sm font-medium flex-1 truncate">{lastAction}</p>
            <button onClick={() => setShowFeedback(false)} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Interim transcript — top bar under header */}
      {interimText && (
        <div className="fixed top-[60px] left-1/2 -translate-x-1/2 z-[60] max-w-sm w-[90%]">
          <div className="bg-white rounded-2xl shadow-xl border border-purple-200 p-3">
            <p className="text-xs text-purple-500 font-medium mb-1 flex items-center gap-1">
              <Mic className="w-3 h-3 animate-pulse" /> Sun raha hai...
            </p>
            <p className="text-sm text-gray-800 font-semibold italic">"{interimText}"</p>
          </div>
        </div>
      )}
    </>
  );
}
