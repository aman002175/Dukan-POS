/**
 * chatStorage.ts
 * ──────────────────────────────────────────────────────────────────
 * Persists AI chat history to localStorage.
 * Each query is saved with timestamp and conversation context.
 * Supports active conversation switching & history chat continuation.
 * ──────────────────────────────────────────────────────────────────
 */

import type { ChatMessage } from './aiService';

const CHAT_STORAGE_KEY = 'dukaan_ai_chat_history';
const ACTIVE_CONV_KEY = 'dukaan_ai_active_conv_id';
const MAX_CHATS = 50; // Keep last 50 conversations

export interface ChatConversation {
  id: string;
  startedAt: number;
  lastMessageAt: number;
  messages: ChatMessage[];
  summary: string; // first user message as summary
}

/** Load all conversations from localStorage (sorted newest first) */
export function loadConversations(): ChatConversation[] {
  try {
    const data = localStorage.getItem(CHAT_STORAGE_KEY);
    if (data) {
      const convs = JSON.parse(data) as ChatConversation[];
      return convs.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
    }
  } catch {
    // corrupted data
  }
  return [];
}

/** Save conversations array to localStorage */
function saveConversations(conversations: ChatConversation[]): void {
  try {
    // Keep only last MAX_CHATS conversations
    const trimmed = conversations.slice(0, MAX_CHATS);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    console.error('Failed to save chat history');
  }
}

/** Create a new blank conversation */
export function createConversation(): ChatConversation {
  return {
    id: `chat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    startedAt: Date.now(),
    lastMessageAt: Date.now(),
    messages: [],
    summary: '',
  };
}

/** Get active conversation ID from localStorage */
export function getActiveConversationId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CONV_KEY);
  } catch {
    return null;
  }
}

/** Set active conversation ID */
export function setActiveConversationId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_CONV_KEY, id);
    window.dispatchEvent(new CustomEvent('ai-chat-updated', { detail: { conversationId: id } }));
  } catch {
    console.error('Failed to set active conversation ID');
  }
}

/** Get active conversation (or restore latest / create new) */
export function getActiveConversation(): ChatConversation {
  const conversations = loadConversations();
  const activeId = getActiveConversationId();

  if (activeId) {
    const found = conversations.find(c => c.id === activeId);
    if (found) return found;
  }

  if (conversations.length > 0) {
    const latest = conversations[0];
    setActiveConversationId(latest.id);
    return latest;
  }

  const newConv = createConversation();
  saveConversation(newConv);
  setActiveConversationId(newConv.id);
  return newConv;
}

/** Save or update a conversation */
export function saveConversation(conv: ChatConversation): void {
  const conversations = loadConversations();
  const idx = conversations.findIndex(c => c.id === conv.id);

  if (idx !== -1) {
    conversations[idx] = conv;
  } else {
    conversations.unshift(conv);
  }

  saveConversations(conversations);
  window.dispatchEvent(new CustomEvent('ai-chat-updated', { detail: { conversationId: conv.id } }));
}

/** Save user query + AI response pair to active conversation */
export function saveMessageToActiveConversation(
  userText: string,
  aiAnswer: string
): ChatConversation {
  const conv = getActiveConversation();
  const userMsg: ChatMessage = { role: 'user', content: userText.trim() };
  const assistantMsg: ChatMessage = { role: 'assistant', content: aiAnswer.trim() };

  conv.messages = [...conv.messages, userMsg, assistantMsg];
  conv.lastMessageAt = Date.now();
  if (!conv.summary) {
    conv.summary = userText.trim().slice(0, 80);
  }

  saveConversation(conv);
  setActiveConversationId(conv.id);
  return conv;
}

/** Delete a conversation by ID */
export function deleteConversation(id: string): void {
  const conversations = loadConversations().filter(c => c.id !== id);
  saveConversations(conversations);
  if (getActiveConversationId() === id) {
    if (conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    } else {
      localStorage.removeItem(ACTIVE_CONV_KEY);
    }
  }
  window.dispatchEvent(new CustomEvent('ai-chat-updated', { detail: { conversationId: id } }));
}

/** Clear all conversations */
export function clearAllConversations(): void {
  localStorage.removeItem(CHAT_STORAGE_KEY);
  localStorage.removeItem(ACTIVE_CONV_KEY);
  window.dispatchEvent(new CustomEvent('ai-chat-updated', { detail: {} }));
}

/** Get a conversation by ID */
export function getConversation(id: string): ChatConversation | undefined {
  return loadConversations().find(c => c.id === id);
}

/** Get recent context for AI (last N messages from active conversation) */
export function getRecentContext(maxMessages = 10): ChatMessage[] {
  const activeConv = getActiveConversation();
  return activeConv.messages.slice(-maxMessages);
}
