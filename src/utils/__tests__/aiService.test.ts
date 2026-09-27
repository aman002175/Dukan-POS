import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getSelectedModel,
  setSelectedModel,
  AI_MODELS,
  isAITaskRunning,
  autoSwitchModelIfIdle,
  askAI
} from '@/utils/aiService';
import type { AppState } from '@/types';
import { defaultAppState } from '@/utils/storage';

describe('aiService — Model Selection & Auto-Switching', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns default model when localStorage is empty', () => {
    expect(getSelectedModel()).toBe(AI_MODELS[0].id);
  });

  it('saves and reads selected model', () => {
    setSelectedModel(AI_MODELS[0].id);
    expect(getSelectedModel()).toBe(AI_MODELS[0].id);
  });

  it('returns default model if saved model is invalid', () => {
    localStorage.setItem('dukaan_pos_ai_model', 'invalid-model');
    expect(getSelectedModel()).toBe(AI_MODELS[0].id);
  });

  it('tracks active AI task running state correctly', () => {
    expect(isAITaskRunning()).toBe(false);
  });

  it('uses mercury model and returns limit message on HTTP 429 rate limit', async () => {
    setSelectedModel(AI_MODELS[0].id); // primary model: mercury-2.5

    // Mock fetch: model returns 429 rate limit
    globalThis.fetch = vi.fn().mockImplementation(async (_url, options) => {
      const body = JSON.parse((options as RequestInit).body as string);
      expect(body.model).toBe('mercury-2.5');
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit reached' } }),
      };
    });

    const dummyState: AppState = defaultAppState;
    vi.stubEnv('VITE_INCEPTION_API_KEY', 'inception_test_key_123');

    const res = await askAI('hello', dummyState);

    expect(res.answer).toContain('limit');
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

    vi.stubEnv('VITE_INCEPTION_API_KEY', 'inception_test_key_123');
    const res = await askAI('BILL-0001 check karo aur batao kya duplicate bill hai', testState);

    expect(sentSystemPrompt).toContain('BILL-0001');
    expect(sentSystemPrompt).toContain('BILL-0002');
    expect(sentSystemPrompt).toContain('SYSTEM DETECTED POTENTIAL DUPLICATE BILLS');
    expect(res.answer).toContain('BILL-0001');
  });
});
