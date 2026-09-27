// AI Assistant Section — Mercury chat + voice + chat history persistence & continuation
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Mic, MicOff, Send, Bot, User,
  ShoppingCart, BarChart3, MessageCircle, Package,
  Users, TrendingUp, Lock,
  Plus, Loader2, Volume2, VolumeX, History, Trash2, X, MessageSquare, Clock
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { askAI, getQuickSuggestions, isAIEnabled, getSelectedModel, type AIAction, type ChatMessage } from '@/utils/aiService';
import { dispatchAIActionEvents } from '@/utils/aiActions';
import { createVoiceService, type VoiceStatus } from '@/utils/voiceService';
import { speak, stopSpeaking } from '@/utils/ttsService';
import {
  loadConversations,
  saveConversation,
  createConversation,
  getActiveConversation,
  setActiveConversationId,
  saveMessageToActiveConversation,
  deleteConversation,
  getRecentContext,
  type ChatConversation
} from '@/utils/chatStorage';
import { formatCurrency } from '@/utils/storage';
import type { CartItem } from '@/types';

/**
 * AI login-gate — guest users ko AI use karne se pehle login dikhata hai.
 * Cloud backup + cloud-based AI insights ke liye account zaroori hai.
 */
function AILoginGate() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-red-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-orange-200">
        <Lock className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">AI Assistant locked hai</h2>
      <p className="text-sm text-gray-500 max-w-sm mb-6 leading-relaxed">
        AI Assistant aapke dukaan ke data (products, sales, khata) se seekhta hai.
        Use karne ke liye pehle <strong className="text-gray-700">login karo</strong> — data cloud backup bhi hoga aur AI insights bhi milega.
      </p>
      <button
        onClick={() => navigate('/login')}
        className="w-full max-w-xs h-12 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold shadow-lg shadow-orange-200 hover:from-orange-600 hover:to-red-700 transition-all"
      >
        Login / Sign Up Karo
      </button>
      <p className="text-xs text-gray-400 mt-4">Google se 10 second mein login ho jayega</p>
    </div>
  );
}

// ── Action Badge ──
function ActionBadge({ action }: { action: AIAction }) {
  if (action.type === 'none') return null;
  const info: Record<string, { icon: React.ElementType; label: string; color: string }> = {
    add_to_cart: { icon: ShoppingCart, label: 'Cart mein add ho gaya', color: 'bg-green-100 text-green-700 border-green-200' },
    record_cash: { icon: ShoppingCart, label: 'Cash bill ready', color: 'bg-green-100 text-green-700 border-green-200' },
    record_udhaar: { icon: Users, label: 'Udhaar record ho gaya', color: 'bg-red-100 text-red-700 border-red-200' },
    record_payment: { icon: Users, label: 'Payment record ho gaya', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    show_report: { icon: BarChart3, label: 'Report taiyaar', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    show_customer: { icon: Users, label: 'Customer info', color: 'bg-pink-100 text-pink-700 border-pink-200' },
    whatsapp_message: { icon: MessageCircle, label: 'WhatsApp ready', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    reorder_suggestion: { icon: Package, label: 'Reorder list', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    discount_suggestion: { icon: TrendingUp, label: 'Discount', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    clarify_product: { icon: Package, label: 'Product select karo', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    clarify_customer: { icon: Users, label: 'Customer select karo', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  };
  const i = info[action.type];
  if (!i) return null;
  const Icon = i.icon;
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${i.color} mt-2`}>
      <Icon className="w-3.5 h-3.5" />{i.label}
    </div>
  );
}

// ── Clarify Popup ──
function ClarifyPopup({ action, onSelect, onClose }: { action: AIAction; onSelect: (id: string, name: string) => void; onClose: () => void }) {
  if (action.type === 'clarify_product') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-gray-900 mb-3">Kaunsa Product?</h3>
          <div className="space-y-2">
            {action.options.map(opt => (
              <button key={opt.productId} onClick={() => onSelect(opt.productId, opt.productName)}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-orange-50 border border-gray-200 rounded-2xl p-3 text-left">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{opt.productName}</p>
                  <p className="text-xs text-gray-500">Stock: {opt.stock}</p>
                </div>
                <span className="font-bold text-orange-600">{formatCurrency(opt.price)}</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-full mt-3 text-sm text-gray-500 py-2">Cancel</button>
        </div>
      </div>
    );
  }
  if (action.type === 'clarify_customer') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
          <h3 className="font-bold text-gray-900 mb-3">Kaunsa Customer?</h3>
          <div className="space-y-2">
            {action.options.map(opt => (
              <button key={opt.customerId} onClick={() => onSelect(opt.customerId, opt.customerName)}
                className="w-full flex items-center justify-between bg-gray-50 hover:bg-purple-50 border border-gray-200 rounded-2xl p-3 text-left">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{opt.customerName}</p>
                  <p className="text-xs text-gray-500">{opt.phone}</p>
                </div>
                <span className="font-bold text-purple-600">{formatCurrency(opt.totalDue)} due</span>
              </button>
            ))}
          </div>
          <button onClick={onClose} className="w-full mt-3 text-sm text-gray-500 py-2">Cancel</button>
        </div>
      </div>
    );
  }
  return null;
}

// ── Chat Bubble ──
function ChatBubble({ msg, isLast, action, ttsEnabled, onToggleTTS }: { msg: ChatMessage; isLast: boolean; action?: AIAction; ttsEnabled: boolean; onToggleTTS: () => void }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      <div className={`max-w-[80%] ${isUser ? 'order-1' : ''}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-br-md' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-md'
        }`}>{msg.content}</div>
        {isLast && !isUser && action && action.type !== 'none' && <ActionBadge action={action} />}
        {isLast && !isUser && (
          <button onClick={onToggleTTS} className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-400 hover:text-purple-600">
            {ttsEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            {ttsEnabled ? 'Voice ON' : 'Voice OFF'}
          </button>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
          <User className="w-4 h-4 text-orange-600" />
        </div>
      )}
    </div>
  );
}

// Helper to format date/time nicely
function formatChatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
  return `${date.getDate()}/${date.getMonth() + 1} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
}

// ── Main AISection ──
export function AISection() {
  const { state, showToast } = useApp();
  const { mode: authMode } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<AIAction>({ type: 'none' });
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [interimText, setInterimText] = useState('');
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [currentModel, setCurrentModel] = useState(getSelectedModel());
  const [clarifyAction, setClarifyAction] = useState<AIAction | null>(null);
  const [pendingClarifyContext, setPendingClarifyContext] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef<ReturnType<typeof createVoiceService> | null>(null);
  const convRef = useRef<ChatConversation | null>(null);
  const cartRef = useRef<CartItem[]>([]);

  const aiEnabled = isAIEnabled();
  const suggestions = getQuickSuggestions(state);

  // Sync active conversation state from chatStorage
  const refreshChatState = useCallback(() => {
    const active = getActiveConversation();
    convRef.current = active;
    setMessages(active.messages || []);
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    refreshChatState();
    window.addEventListener('ai-chat-updated', refreshChatState);
    return () => window.removeEventListener('ai-chat-updated', refreshChatState);
  }, [refreshChatState]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { return () => { voiceRef.current?.destroy(); stopSpeaking(); }; }, []);

  // Listen for cart updates from POSSection
  useEffect(() => {
    const handler = (e: Event) => {
      cartRef.current = (e as CustomEvent).detail?.cart || [];
    };
    window.addEventListener('cart-updated', handler);
    return () => window.removeEventListener('cart-updated', handler);
  }, []);

  // Listen for voice input from FloatingMic
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.transcript) sendMessage(detail.transcript);
    };
    window.addEventListener('ai-voice-input', handler);
    return () => window.removeEventListener('ai-voice-input', handler);
  }); // intentionally no deps

  // Listen for model switch events
  useEffect(() => {
    const handler = (e: Event) => {
      const modelId = (e as CustomEvent).detail?.modelId;
      if (modelId) setCurrentModel(modelId);
    };
    window.addEventListener('ai-model-switched', handler);
    return () => window.removeEventListener('ai-model-switched', handler);
  }, []);

  // ── Execute AI action via shared dispatcher (aiActions.ts) ──
  const executeAction = useCallback((action: AIAction) => {
    if (!action || action.type === 'none') return;
    if (action.type === 'whatsapp_message') {
      if (navigator.share) navigator.share({ text: action.message }).catch(() => {});
      else { navigator.clipboard?.writeText(action.message); showToast('Message copy ho gaya!', 'success'); }
      return;
    }
    const dispatched = dispatchAIActionEvents(action);
    if (!dispatched) {
      // clarify_* caller handle karta hai; read-only/info actions ka text jawab hi kaafi hai
    }
  }, [showToast]);

  // ── Send message ──
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    stopSpeaking();

    try {
      const historyContext = getRecentContext(10);
      const response = await askAI(text, state, historyContext, cartRef.current);
      // Save to chat storage and active conversation
      const updatedConv = saveMessageToActiveConversation(text, response.answer);
      convRef.current = updatedConv;
      setMessages(updatedConv.messages);
      setLastAction(response.action || { type: 'none' });

      if (response.action?.type === 'clarify_product' || response.action?.type === 'clarify_customer') {
        setClarifyAction(response.action);
        setPendingClarifyContext(text.trim());
      } else if (response.action && response.action.type !== 'none') {
        executeAction(response.action);
      }

      if (ttsEnabled && response.answer) speak(response.answer);
    } catch {
      showToast('AI se response nahi aaya', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [state, isLoading, ttsEnabled, showToast, executeAction]);

  const handleClarifySelect = useCallback((_id: string, name: string) => {
    setClarifyAction(null);
    const ctx = pendingClarifyContext ? `${pendingClarifyContext} — ${name} select karo` : `${name} select karo`;
    setPendingClarifyContext('');
    sendMessage(ctx);
  }, [pendingClarifyContext, sendMessage]);

  const toggleVoice = useCallback(() => {
    stopSpeaking(); // Immediately interrupt & stop any ongoing AI voice response
    if (voiceStatus === 'listening') {
      voiceRef.current?.stop();
      setVoiceStatus('idle');
      setInterimText('');
      return;
    }
    const svc = createVoiceService({
      onListeningStart: () => { setVoiceStatus('listening'); setInterimText(''); },
      onInterimResult: (t) => setInterimText(t),
      onFinalResult: (t) => { setVoiceStatus('processing'); setInterimText(''); sendMessage(t); setTimeout(() => setVoiceStatus('idle'), 500); },
      onError: (err) => { showToast(err.message, 'error'); setVoiceStatus('idle'); setInterimText(''); },
      onEnd: () => { setVoiceStatus('idle'); setInterimText(''); },
    });
    voiceRef.current = svc; svc.start();
  }, [voiceStatus, sendMessage, showToast]);

  const handleStartNewChat = () => {
    const newConv = createConversation();
    saveConversation(newConv);
    setActiveConversationId(newConv.id);
    setLastAction({ type: 'none' });
    setShowHistoryDrawer(false);
  };

  const handleSelectConversation = (convId: string) => {
    setActiveConversationId(convId);
    setShowHistoryDrawer(false);
  };

  const handleDeleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConversation(convId);
    showToast('Chat history delete ho gayi', 'info');
  };

  const activeConvId = convRef.current?.id;

  // 🔐 LOGIN GATE — guest users AI use nahi kar sakte
  if (authMode === 'guest') {
    return <AILoginGate />;
  }

  return (
    <div className="flex flex-col h-screen lg:h-auto lg:max-h-screen relative overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-500 via-purple-600 to-indigo-700 p-4 text-white relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-12 translate-x-12" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black">AI Assistant</h2>
              <p className="text-purple-200 text-[10px]">Powered by Mercury ({currentModel.split('/')[1] || currentModel}) — {aiEnabled ? 'Active' : 'API Key needed'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* History Drawer Toggle Button */}
            <button
              onClick={() => setShowHistoryDrawer(true)}
              className="relative w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="Purani Chat History"
            >
              <History className="w-4 h-4" />
              {conversations.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-purple-700">
                  {conversations.length}
                </span>
              )}
            </button>

            {/* Voice Sound Toggle */}
            <button onClick={() => { setTtsEnabled(p => !p); stopSpeaking(); }}
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${ttsEnabled ? 'bg-white/20' : 'bg-white/10'}`}>
              {ttsEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* New Chat Button */}
            <button
              onClick={handleStartNewChat}
              className="w-8 h-8 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
              title="Nayi Chat Shuru Karo"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        {aiEnabled && (
          <div className="relative z-10 flex gap-2 mt-3 overflow-x-auto">
            <div className="bg-white/15 rounded-xl px-3 py-1.5 flex-shrink-0">
              <p className="text-[9px] text-purple-200">Aaj</p>
              <p className="text-xs font-bold">{formatCurrency(state.sales.filter(s => s.date === new Date().toISOString().split('T')[0]).reduce((sum, s) => sum + s.total, 0))}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-3 py-1.5 flex-shrink-0">
              <p className="text-[9px] text-purple-200">Products</p>
              <p className="text-xs font-bold">{state.products.length}</p>
            </div>
            <div className="bg-white/15 rounded-xl px-3 py-1.5 flex-shrink-0">
              <p className="text-[9px] text-purple-200">Udhaar</p>
              <p className="text-xs font-bold">{formatCurrency(state.customers.reduce((sum, c) => sum + Math.max(0, c.totalDue), 0))}</p>
            </div>
          </div>
        )}
      </div>

      {/* No API key */}
      {!aiEnabled && (
        <div className="bg-amber-50 border-b border-amber-200 p-3 flex-shrink-0">
          <p className="font-bold text-amber-800 text-xs">API Key Set Karo — Vercel env mein <code className="bg-amber-100 px-1">VITE_INCEPTION_API_KEY</code> add karo</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-200">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h3 className="font-bold text-gray-900 text-base mb-1">AI Assistant</h3>
            <p className="text-gray-500 text-xs mb-5">Bolo aur ho jayega — Hindi mein baat karo</p>
            <div className="flex flex-wrap gap-2 justify-center max-w-md mx-auto">
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)} disabled={!aiEnabled}
                  className="bg-white border border-gray-200 text-gray-700 text-[11px] px-3 py-1.5 rounded-xl hover:bg-orange-50 disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatBubble key={i} msg={msg} isLast={i === messages.length - 1 && msg.role === 'assistant'}
            action={i === messages.length - 1 ? lastAction : undefined} ttsEnabled={ttsEnabled} onToggleTTS={() => setTtsEnabled(p => !p)} />
        ))}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
                <span className="text-sm text-gray-500">Soch raha hai...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Clarify Popup */}
      {clarifyAction && <ClarifyPopup action={clarifyAction} onSelect={handleClarifySelect} onClose={() => { setClarifyAction(null); setPendingClarifyContext(''); }} />}

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-3 flex-shrink-0">
        {interimText && (
          <div className="mb-2 px-3 py-2 bg-purple-50 rounded-xl border border-purple-200">
            <p className="text-xs text-purple-600 font-medium flex items-center gap-1.5">
              <Mic className="w-3 h-3 animate-pulse" />{interimText}
            </p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder={aiEnabled ? "Bolo kuch bhi..." : "Pehle API key set karo"}
            disabled={!aiEnabled || isLoading}
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50" />
          {input.trim() && (
            <button onClick={() => sendMessage(input)} disabled={isLoading}
              className="w-11 h-11 bg-gradient-to-r from-orange-500 to-red-600 rounded-2xl flex items-center justify-center text-white disabled:opacity-50">
              <Send className="w-5 h-5" />
            </button>
          )}
        </div>
        {/* BIG MIC BUTTON */}
        <button onClick={toggleVoice} disabled={!aiEnabled}
          className={`w-full mt-2 h-12 rounded-2xl flex items-center justify-center gap-2 font-semibold text-sm transition-all disabled:opacity-50 ${
            voiceStatus === 'listening' ? 'bg-red-500 text-white animate-pulse'
            : voiceStatus === 'processing' ? 'bg-purple-500 text-white'
            : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white'
          }`}>
          {voiceStatus === 'listening' ? <><MicOff className="w-5 h-5" /> Ruk Jao</>
           : voiceStatus === 'processing' ? <><Loader2 className="w-5 h-5 animate-spin" /> Samajh Raha...</>
           : <><Mic className="w-5 h-5" /> Mic Se Bolo</>}
        </button>
      </div>

      {/* ── Chat History Sidebar Drawer ── */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-black/50 flex justify-end transition-opacity animate-in fade-in" onClick={() => setShowHistoryDrawer(false)}>
          <div className="bg-white w-full max-w-sm h-full flex flex-col shadow-2xl p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                  <History className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Purani Chat History</h3>
                  <p className="text-xs text-gray-400">{conversations.length} saved chats</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryDrawer(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center hover:bg-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button in Drawer */}
            <button
              onClick={handleStartNewChat}
              className="mt-3 w-full py-2.5 px-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-100 hover:from-violet-600 hover:to-purple-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Nayi Chat Shuru Karo
            </button>

            {/* Conversation List */}
            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {conversations.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Koi purani history nahi hai</p>
                </div>
              ) : (
                conversations.map(conv => {
                  const isActive = conv.id === activeConvId;
                  const firstMessage = conv.summary || (conv.messages.find(m => m.role === 'user')?.content) || 'Nayi Baatchaat';

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-2 ${
                        isActive
                          ? 'bg-purple-50 border-purple-300 shadow-sm'
                          : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatChatTime(conv.lastMessageAt)}</span>
                          <span>•</span>
                          <span>{conv.messages.length} msgs</span>
                        </div>
                        <p className={`text-xs font-semibold truncate ${isActive ? 'text-purple-900' : 'text-gray-800'}`}>
                          {firstMessage}
                        </p>
                      </div>

                      <button
                        onClick={e => handleDeleteConversation(conv.id, e)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-white/80 transition-colors"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
