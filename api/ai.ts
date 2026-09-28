/**
 * api/ai.ts — Inception Labs serverless proxy (Vercel Function)
 * ──────────────────────────────────────────────────────────────────
 * Security ke kai layers (pentest findings #1/#2/#3 fixes):
 *
 *  VULN-03  Inception key server-side env mein rehti hai (INCEPTION_API_KEY,
 *           no VITE_ prefix) → client bundle mein kabhi nahi jaati.
 *  #3       Rate limit (per-IP) + model allowlist + param clamps +
 *           browser-Origin enforcement → "denial of wallet" attack band.
 *  #1/#2    Same-origin + auth.uid() RLS policies (supabase/policies.sql) —
 *           yahan proxy key handle karta hai, data RLS lock karta hai.
 *
 * Ye file intentionally self-contained hai: Vercel ise ESM (api/ai.js) compile
 * karta hai aur cross-file extensionless imports runtime pe fail hote hain
 * (ERR_MODULE_NOT_FOUND) — isliye core logic yahin hai.
 *
 * NOTE (rate limit): in-memory limiter per warm instance hai (serverless
 * ephemeral/multiple instances) — ye best-effort abuse shield hai, hard cap
 * nahi. Hard protection = Inception Labs dashboard mein spend limit +
 * (optional) Upstash Redis distributed limiter jab traffic badhe.
 * ──────────────────────────────────────────────────────────────────
 */

// Hobby plan pe default 10s kam pad sakta hai LLM ke liye
export const maxDuration = 30;

const INCEPTION_API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

// Abuse guards — proxy se koi bada payload ya request-flood nahi ho sakta
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 24000;
const MAX_TOKENS_CAP = 4000; // app ko 4000 chahiye (reasoning budget) — isse zyada nahi
const MIN_TOKENS = 300;
const DEFAULT_MODEL = 'mercury-2.5';
// Model allowlist — attacker apne khud ke kharche model pe key nahi chala sakta
const ALLOWED_MODELS = new Set(['mercury-2.5']);
// Mercury supported temperature range 0.5–1.0
const TEMP_MIN = 0.5;
const TEMP_MAX = 1.0;
// reasoning_effort capped (cost control) — 'high' allow nahi
const ALLOWED_EFFORTS = new Set(['low', 'medium']);
const SAFE_ROLES = new Set(['user', 'assistant', 'system']);

// ── Rate limit (per-IP sliding window, in-memory best-effort) ──
const RATE_LIMIT = {
  perHour: 60, // ek shop-grahak ~60 AI queries/hour se zyada nahi
  perDay: 500, // daily ceiling per IP
  hourWindowMs: 60 * 60 * 1000,
  dayWindowMs: 24 * 60 * 60 * 1000,
};
interface Bucket {
  hour: { count: number; resetAt: number };
  day: { count: number; resetAt: number };
}
const rateBuckets = new Map<string, Bucket>();
let lastPrune = 0;

function pruneBuckets(now: number): void {
  if (now - lastPrune < RATE_LIMIT.hourWindowMs) return;
  lastPrune = now;
  for (const [k, b] of rateBuckets) {
    if (now >= b.day.resetAt && now >= b.hour.resetAt) rateBuckets.delete(k);
  }
}

/** @returns null = allowed, ya { retryAfterSec, reason } = limited */
function checkRateLimit(
  ip: string,
  now: number
): { retryAfterSec: number; reason: string } | null {
  pruneBuckets(now);
  let b = rateBuckets.get(ip);
  if (!b) {
    b = {
      hour: { count: 0, resetAt: now + RATE_LIMIT.hourWindowMs },
      day: { count: 0, resetAt: now + RATE_LIMIT.dayWindowMs },
    };
    rateBuckets.set(ip, b);
  }
  if (now >= b.hour.resetAt) b.hour = { count: 0, resetAt: now + RATE_LIMIT.hourWindowMs };
  if (now >= b.day.resetAt) b.day = { count: 0, resetAt: now + RATE_LIMIT.dayWindowMs };

  if (b.hour.count >= RATE_LIMIT.perHour) {
    return { retryAfterSec: Math.ceil((b.hour.resetAt - now) / 1000), reason: 'per-hour' };
  }
  if (b.day.count >= RATE_LIMIT.perDay) {
    return { retryAfterSec: Math.ceil((b.day.resetAt - now) / 1000), reason: 'per-day' };
  }
  b.hour.count++;
  b.day.count++;
  return null;
}

/** Tests ke liye limiter state reset */
export function resetRateLimitForTests(): void {
  rateBuckets.clear();
  lastPrune = 0;
}

interface ProxyRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface ProxyResponse {
  status(code: number): ProxyResponse & { json(payload: unknown): void };
  setHeader?: (name: string, value: string) => void;
}
interface ProxyResult {
  status: number;
  payload: unknown;
}
export interface AIProxyInput {
  method?: string;
  /** Origin header (browser requests) — server-to-server mein undefined */
  origin?: string;
  /** Host header — is server ka apna host */
  host?: string;
  body?: unknown;
  /** Server-side env se aayi key (INCEPTION_API_KEY) — client se KABHI nahi */
  apiKey?: string;
  /** Per-IP rate limiting ke liye (Vercel x-forwarded-for se aata hai) */
  clientIp?: string;
  /** Test injection ke liye; default global fetch */
  fetchImpl?: typeof fetch;
  /** Test injection — deterministic time */
  now?: number;
}

// @types/node app tsconfig mein typed nahi — globalThis pattern (aiService.ts wala)
function serverEnv(): Record<string, string | undefined> {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

/**
 * Proxy core: validate → rate-limit → sanitize → Inception ko forward.
 * - Browser-origin enforcement: POST ke liye browser hamesha Origin bhejta hai,
 *   isliye missing/cross-origin Origin = non-browser (curl/bot) → block.
 * - Same-origin browser requests allow; cross-origin 403 (clickjacking/CSRF abuse).
 */
export async function handleAIProxy(input: AIProxyInput): Promise<ProxyResult> {
  const { fetchImpl = fetch, now = Date.now() } = input;

  if (input.method !== 'POST') {
    return { status: 405, payload: { error: { message: 'Method Not Allowed — sirf POST' } } };
  }

  // ── Origin enforcement (anti-bot: curl/script requests Origin nahi bhejte) ──
  if (!input.origin) {
    return {
      status: 403,
      payload: { error: { message: 'Forbidden — browser origin required' } },
    };
  }
  if (input.host) {
    try {
      if (new URL(input.origin).host !== input.host) {
        return { status: 403, payload: { error: { message: 'Forbidden — cross-origin request blocked' } } };
      }
    } catch {
      return { status: 400, payload: { error: { message: 'Bad Request — invalid Origin' } } };
    }
  }

  // ── Rate limit (denial-of-wallet protection) ──
  const limited = checkRateLimit(input.clientIp || 'unknown', now);
  if (limited) {
    return {
      status: 429,
      payload: {
        error: {
          message: `AI rate limit exceeded (${limited.reason}). Thodi der baad try karo.`,
          retryAfterSec: limited.retryAfterSec,
        },
      },
    };
  }

  const apiKey = input.apiKey || '';
  if (!apiKey) {
    return {
      status: 500,
      payload: {
        error: {
          message:
            'AI server key configured nahi hai — Vercel → Environment Variables mein INCEPTION_API_KEY add karo',
        },
      },
    };
  }

  // Body parse (Vercel kabhi-kabhi string deta hai)
  let raw = input.body;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { status: 400, payload: { error: { message: 'Bad Request — invalid JSON body' } } };
    }
  }
  const body = (raw ?? {}) as Record<string, unknown>;

  // ── Model allowlist (key se arbitrary model call nahi chalega) ──
  const requestedModel = typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL;
  if (!ALLOWED_MODELS.has(requestedModel)) {
    return {
      status: 400,
      payload: { error: { message: `Bad Request — model not allowed (allowed: ${[...ALLOWED_MODELS].join(', ')})` } },
    };
  }

  // Messages sanitize — sirf known roles + bounded content forward karo
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { status: 400, payload: { error: { message: 'Bad Request — messages array required' } } };
  }
  const safeMessages = (messages as Array<Record<string, unknown>>)
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: SAFE_ROLES.has(String(m?.role)) ? String(m?.role) : 'user',
      content: String(m?.content ?? '').slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.content.length > 0);
  if (safeMessages.length === 0) {
    return { status: 400, payload: { error: { message: 'Bad Request — khaali messages' } } };
  }

  // ── Param clamps (cost control — attacker high max_tokens/effort nahi bhej sakta) ──
  const requestedTemp = typeof body.temperature === 'number' ? body.temperature : 0.6;
  const temperature = Math.min(TEMP_MAX, Math.max(TEMP_MIN, requestedTemp));
  const requestedTokens = typeof body.max_tokens === 'number' ? body.max_tokens : MAX_TOKENS_CAP;
  const maxTokens = Math.min(MAX_TOKENS_CAP, Math.max(MIN_TOKENS, requestedTokens));
  const requestedEffort = typeof body.reasoning_effort === 'string' ? body.reasoning_effort : 'medium';
  const reasoningEffort = ALLOWED_EFFORTS.has(requestedEffort) ? requestedEffort : 'medium';

  const payload = {
    model: requestedModel,
    messages: safeMessages,
    temperature,
    max_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
  };

  try {
    const upstream = await fetchImpl(INCEPTION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`, // 🔒 key sirf yahan — server-side
      },
      body: JSON.stringify(payload),
    });

    const data = (await upstream.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    if (!upstream.ok) {
      return {
        status: upstream.status,
        payload: { error: { message: data?.error?.message || 'Upstream AI error' } },
      };
    }

    // Success — Inception ka response seedha client ko (client parser unchanged)
    return { status: 200, payload: data };
  } catch (err) {
    return {
      status: 502,
      payload: { error: { message: `AI proxy upstream error: ${(err as Error).message}` } },
    };
  }
}

function firstHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: ProxyRequest, res: ProxyResponse): Promise<void> {
  const env = serverEnv();
  const result = await handleAIProxy({
    method: req.method,
    origin: firstHeader(req.headers, 'origin'),
    host: firstHeader(req.headers, 'host'),
    body: req.body,
    apiKey: env.INCEPTION_API_KEY || env.VITE_INCEPTION_API_KEY || '',
    // Vercel x-forwarded-for set karta hai (pehla hop = client IP)
    clientIp: firstHeader(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() || firstHeader(req.headers, 'x-real-ip'),
  });
  const retryAfter = (result.payload as { error?: { retryAfterSec?: number } } | null)?.error?.retryAfterSec;
  if (result.status === 429 && typeof retryAfter === 'number' && res.setHeader) {
    res.setHeader('Retry-After', String(retryAfter));
  }
  res.status(result.status).json(result.payload);
}
