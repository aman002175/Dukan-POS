import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAIProxy } from '../../../api/ai';

/**
 * api/ai.ts proxy tests — VULN-03 fix ka server-side contract:
 * - key server-side env se aati hai (INCEPTION_API_KEY), kabhi client se nahi
 * - sirf same-origin browser requests allow
 * - messages sanitize + bounded rehte hain
 * - upstream error passthrough hota hai
 */

const BASE = {
  method: 'POST',
  host: 'dukaan.example',
  apiKey: 'test_key',
};

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'Ho gaya!' } }] }),
  }) as unknown as typeof fetch;
}

describe('api/ai — server-side AI proxy (security contract)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await handleAIProxy({ ...BASE, method: 'GET', body: { messages: [{ role: 'user', content: 'hi' }] } });
    expect(res.status).toBe(405);
  });

  it('blocks cross-origin browser requests with 403', async () => {
    const res = await handleAIProxy({
      ...BASE,
      origin: 'https://evil.example',
      body: { messages: [{ role: 'user', content: 'hi' }] },
      fetchImpl: okFetch(),
    });
    expect(res.status).toBe(403);
  });

  it('allows same-origin browser requests and forwards with server-side Bearer key', async () => {
    const fetchMock = okFetch() as ReturnType<typeof vi.fn>;
    const res = await handleAIProxy({
      ...BASE,
      origin: 'https://dukaan.example',
      body: { messages: [{ role: 'user', content: 'aaj kitni bikri?' }] },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.inceptionlabs.ai/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test_key'); // key sirf server-side lagti hai
    expect(res.payload).toHaveProperty('choices');
  });

  it('returns 500 with guidance when server key is missing', async () => {
    const res = await handleAIProxy({
      method: 'POST',
      host: 'dukaan.example',
      apiKey: undefined,
      body: { messages: [{ role: 'user', content: 'hi' }] },
      fetchImpl: okFetch(),
    });
    expect(res.status).toBe(500);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('INCEPTION_API_KEY');
  });

  it('sanitizes roles, bounds message count, caps max_tokens, defaults model', async () => {
    const fetchMock = okFetch() as ReturnType<typeof vi.fn>;
    const many = Array.from({ length: 40 }, (_, i) => ({
      role: 'assistant',
      content: `msg-${i}`,
    }));
    const res = await handleAIProxy({
      ...BASE,
      body: { messages: many, model: '', max_tokens: 999999, temperature: 0.9 },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.messages.length).toBeLessThanOrEqual(24); // bounded
    expect(sent.messages.every((m: { role: string }) => m.role === 'assistant')).toBe(true);
    expect(sent.max_tokens).toBe(8000); // capped
    expect(sent.model).toBe('mercury-2.5'); // defaulted
  });

  it('maps unknown roles to user and strips oversized content', async () => {
    const fetchMock = okFetch() as ReturnType<typeof vi.fn>;
    const res = await handleAIProxy({
      ...BASE,
      body: {
        messages: [
          { role: 'hacker-role', content: 'x'.repeat(30000) },
          { role: 'user', content: '' }, // empty — filtered
        ],
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.messages.length).toBe(1);
    expect(sent.messages[0].role).toBe('user'); // unknown role → user
    expect(sent.messages[0].content.length).toBe(24000); // truncated
  });

  it('passes through upstream errors with upstream status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    }) as unknown as typeof fetch;
    const res = await handleAIProxy({
      ...BASE,
      body: { messages: [{ role: 'user', content: 'hi' }] },
    });
    expect(res.status).toBe(429);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('Rate limit');
  });

  it('returns 400 for missing or empty messages', async () => {
    const noMessages = await handleAIProxy({ ...BASE, body: {}, fetchImpl: okFetch() });
    expect(noMessages.status).toBe(400);
    const empty = await handleAIProxy({ ...BASE, body: { messages: [] }, fetchImpl: okFetch() });
    expect(empty.status).toBe(400);
  });
});
