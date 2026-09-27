import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSelectedModel,
  setSelectedModel,
  GROQ_MODELS,
  isAITaskRunning,
  autoSwitchModelIfIdle,
  askAI
} from '@/utils/groqService';
import type { AppState } from '@/types';
import { defaultAppState } from '@/utils/storage';

describe('groqService — Model Selection & Auto-Switching', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns default model when localStorage is empty', () => {
    expect(getSelectedModel()).toBe(GROQ_MODELS[0].id);
  });

  it('saves and reads selected model', () => {
    setSelectedModel(GROQ_MODELS[1].id);
    expect(getSelectedModel()).toBe(GROQ_MODELS[1].id);
  });

  it('returns default model if saved model is invalid', () => {
    localStorage.setItem('dukaan_pos_groq_model', 'invalid-model');
    expect(getSelectedModel()).toBe(GROQ_MODELS[0].id);
  });

  it('tracks active AI task running state correctly', () => {
    expect(isAITaskRunning()).toBe(false);
  });

  it('falls back to alternate model if primary model returns HTTP 429 rate limit', async () => {
    setSelectedModel(GROQ_MODELS[0].id); // primary model: qwen3.8-27b

    // Mock fetch: first call (primary model) fails with 429, second call (fallback) succeeds
    let fetchCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      fetchCount++;
      const body = JSON.parse((options as RequestInit).body as string);
      if (body.model === GROQ_MODELS[0].id) {
        return {
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit reached' } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Ho gaya! <action>{"type":"none"}</action>' } }],
        }),
      };
    });

    // Provide a dummy API key in env or let test run
    const dummyState: AppState = defaultAppState;
    vi.stubEnv('VITE_GROQ_API_KEY', 'gsk_test_key_123');

    const res = await askAI('hello', dummyState);

    expect(fetchCount).toBeGreaterThanOrEqual(2);
    expect(res.answer).toBe('Ho gaya!');

    // When task finishes ("jb use na ho"), the selected model should auto-switch to working fallback model
    expect(getSelectedModel()).not.toBe(GROQ_MODELS[0].id);
  });

  it('autoSwitchModelIfIdle does not throw and checks idle state', () => {
    expect(() => autoSwitchModelIfIdle()).not.toThrow();
  });

  it('includes past bills history and detects duplicate bills in system prompt snapshot', async () => {
    const now = Date.now();
    const testState: AppState = {
      ...defaultAppState,
      sales: [
        {
          id: 'sale-1',
          billNumber: 'BILL-0001',
          items: [{ productId: 'p1', name: 'Aata', price: 140, quantity: 2, total: 280 }],
          total: 280,
          type: 'udhaar',
          customerId: 'c1',
          customerName: 'Raju',
          createdAt: now - 5000,
          date: '2026-08-27',
          time: '11:00 PM',
        },
        {
          id: 'sale-2',
          billNumber: 'BILL-0002',
          items: [{ productId: 'p1', name: 'Aata', price: 140, quantity: 2, total: 280 }],
          total: 280,
          type: 'udhaar',
          customerId: 'c1',
          customerName: 'Raju',
          createdAt: now,
          date: '2026-08-27',
          time: '11:00 PM',
        },
      ],
    };

    let sentSystemPrompt = '';
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse((options as RequestInit).body as string);
      sentSystemPrompt = body.messages[0].content;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'BILL-0001 aur BILL-0002 dono me 2 kg Aata hai <action>{"type":"none"}</action>' } }],
        }),
      };
    });

    vi.stubEnv('VITE_GROQ_API_KEY', 'gsk_test_key_123');
    const res = await askAI('BILL-0001 check karo aur batao kya duplicate bill hai', testState);

    expect(sentSystemPrompt).toContain('BILL-0001');
    expect(sentSystemPrompt).toContain('BILL-0002');
    expect(sentSystemPrompt).toContain('SYSTEM DETECTED POTENTIAL DUPLICATE BILLS');
    expect(res.answer).toContain('BILL-0001');
  });
});
