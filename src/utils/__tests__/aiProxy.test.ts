import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAIProxy, resetRateLimitForTests } from '../../../api/ai';

/**
 * api/ai.ts proxy tests — pentest findings #1/#2/#3 security contract:
 * - key server-side env se aati hai (INCEPTION_API_KEY), kabhi client se nahi
 * - non-browser (curl/bot) requests block (Origin enforcement)
 * - cross-origin browser requests block
 * - per-IP rate limit (denial-of-wallet protection)
 * - model allowlist + param clamps (cost control)
 * - messages sanitize + bounded
 */

const ORIGIN = 'https://dukaan.example';
const HOST = 'dukaan.example';

const base = {
  method: 'POST',
  host: HOST,
  origin: ORIGIN,
  apiKey: 'test_key',
  clientIp: '1.2.3.4',
  now: 1_700_000_000_000,
};

const msg = (content = 'aaj kitni bikri?') => [{ role: 'user', content }];

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: 'Ho gaya!' } }] }),
  });
}

describe('api/ai — server-side AI proxy (security contract)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetRateLimitForTests();
  });

  it('rejects non-POST methods with 405', async () => {
    const res = await handleAIProxy({ ...base, method: 'GET', body: { messages: msg() } });
    expect(res.status).toBe(405);
  });

  it('blocks non-browser requests (curl/script — no Origin) with 403', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      origin: undefined, // curl Origin nahi bhejta
      body: { messages: msg() },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled(); // upstream tak pahunche hi nahi
  });

  it('blocks cross-origin browser requests with 403', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      origin: 'https://evil.example',
      body: { messages: msg() },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows same-origin browser requests and forwards with server-side Bearer key', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      body: { messages: msg() },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.inceptionlabs.ai/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test_key'); // key sirf server-side
    expect(res.payload).toHaveProperty('choices');
  });

  it('returns 500 with guidance when server key is missing', async () => {
    const res = await handleAIProxy({
      ...base,
      apiKey: undefined,
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(res.status).toBe(500);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('INCEPTION_API_KEY');
  });

  // ── Finding #3: denial-of-wallet protection ──
  it('rate limits per-IP: 60/hour then 429 (bot loop blocked)', async () => {
    for (let i = 0; i < 60; i++) {
      const res = await handleAIProxy({
        ...base,
        body: { messages: msg() },
        fetchImpl: okFetch() as unknown as typeof fetch,
      });
      expect(res.status).toBe(200);
    }
    const blocked = await handleAIProxy({
      ...base,
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(blocked.status).toBe(429);
    const payload = blocked.payload as { error?: { message?: string; retryAfterSec?: number } };
    expect(payload.error?.message).toContain('rate limit');
    expect(payload.error?.retryAfterSec).toBeGreaterThan(0);
  });

  it('rate limit is per-IP (ek IP block ho, doosra IP safe)', async () => {
    for (let i = 0; i < 60; i++) {
      await handleAIProxy({
        ...base,
        body: { messages: msg() },
        fetchImpl: okFetch() as unknown as typeof fetch,
      });
    }
    const blocked = await handleAIProxy({
      ...base,
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(blocked.status).toBe(429);

    const otherIp = await handleAIProxy({
      ...base,
      clientIp: '9.9.9.9',
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(otherIp.status).toBe(200);
  });

  it('rate limit window resets after an hour', async () => {
    for (let i = 0; i < 60; i++) {
      await handleAIProxy({
        ...base,
        body: { messages: msg() },
        fetchImpl: okFetch() as unknown as typeof fetch,
      });
    }
    const blocked = await handleAIProxy({
      ...base,
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(blocked.status).toBe(429);

    // 1 ghante baad same IP allowed again
    const afterWindow = await handleAIProxy({
      ...base,
      now: base.now + 61 * 60 * 1000,
      body: { messages: msg() },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(afterWindow.status).toBe(200);
  });

  it('daily ceiling: 500/day per IP blocks even across hour windows', async () => {
    // 9 ghante x 60 = 540 attempts → 500 allow, 501st block
    let allowed = 0;
    let blocked = 0;
    for (let hour = 0; hour < 9; hour++) {
      for (let i = 0; i < 60; i++) {
        const res = await handleAIProxy({
          ...base,
          now: base.now + hour * 61 * 60 * 1000,
          body: { messages: msg() },
          fetchImpl: okFetch() as unknown as typeof fetch,
        });
        if (res.status === 200) allowed++;
        else if (res.status === 429) blocked++;
      }
    }
    expect(allowed).toBe(500);
    expect(blocked).toBe(40);
  });

  it('blocks non-allowlisted models (attacker key se mehnga model nahi chala sakta)', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      body: { messages: msg(), model: 'gpt-4o' },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(400);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('model not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clamps cost params: max_tokens capped, temperature bounded, effort capped', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      body: {
        messages: msg(),
        model: 'mercury-2.5',
        max_tokens: 999999,
        temperature: 5,
        reasoning_effort: 'high',
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.max_tokens).toBe(4000); // capped (was 999999)
    expect(sent.temperature).toBe(1.0); // clamped to Mercury max
    expect(sent.reasoning_effort).toBe('medium'); // 'high' not allowed → default
  });

  it('clamps max_tokens to a sane minimum when attacker sends junk', async () => {
    const fetchMock = okFetch();
    await handleAIProxy({
      ...base,
      body: { messages: msg(), max_tokens: 1 },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.max_tokens).toBe(300); // min floor
  });

  it('sanitizes roles, bounds message count, truncates oversized content', async () => {
    const fetchMock = okFetch();
    const many = Array.from({ length: 40 }, (_, i) => ({ role: 'assistant', content: `msg-${i}` }));
    const res = await handleAIProxy({
      ...base,
      body: { messages: many },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.messages.length).toBeLessThanOrEqual(24); // bounded
    expect(sent.messages.every((m: { role: string }) => m.role === 'assistant')).toBe(true);
    expect(sent.max_tokens).toBe(4000); // default
    expect(sent.model).toBe('mercury-2.5'); // default
  });

  it('maps unknown roles to user and filters empty content', async () => {
    const fetchMock = okFetch();
    const res = await handleAIProxy({
      ...base,
      body: {
        messages: [
          { role: 'hacker-role', content: 'x'.repeat(30000) },
          { role: 'user', content: '' },
        ],
      },
      fetchImpl: fetchMock as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(init.body as string);
    expect(sent.messages.length).toBe(1);
    expect(sent.messages[0].role).toBe('user');
    expect(sent.messages[0].content.length).toBe(24000); // truncated
  });

  it('passes through upstream errors with upstream status', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    }) as unknown as typeof fetch;
    const res = await handleAIProxy({ ...base, body: { messages: msg() } });
    expect(res.status).toBe(429);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('Rate limit');
  });

  it('returns 400 for missing or empty messages', async () => {
    const noMessages = await handleAIProxy({ ...base, body: {}, fetchImpl: okFetch() as unknown as typeof fetch });
    expect(noMessages.status).toBe(400);
    const empty = await handleAIProxy({
      ...base,
      body: { messages: [] },
      fetchImpl: okFetch() as unknown as typeof fetch,
    });
    expect(empty.status).toBe(400);
  });

  it('returns 502 when upstream is unreachable', async () => {
    const res = await handleAIProxy({
      ...base,
      body: { messages: msg() },
      fetchImpl: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch,
    });
    expect(res.status).toBe(502);
    const payload = res.payload as { error?: { message?: string } };
    expect(payload.error?.message).toContain('ECONNREFUSED');
  });
});
