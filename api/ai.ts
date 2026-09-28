/**
 * api/ai.ts — Inception Labs serverless proxy (Vercel Function)
 * ──────────────────────────────────────────────────────────────────
 * Security ke kai layers (pentest findings #1/#2/#3 fixes):
 *
 *  VULN-03  Inception key server-side env mein rehti hai (INCEPTION_API_KEY,
 *           no VITE_ prefix) → client bundle mein kabhi nahi jaati.
 *  #3 AUTH  🔐 Valid Supabase session REQUIRED (Authorization: Bearer <token>,
 *           server pe verify). Pehle yahan koi auth nahi tha — AI UI mein login
 *           ke baad dikhta tha, lekin endpoint khula tha, to koi bhi bina login
 *           curl se call kar sakta tha. Origin header jhooth bol sakta hai,
 *           signed JWT nahi — isliye token check kiya jaata hai.
 *  #3       Rate limit (Upstash Redis distributed, per-user) + model allowlist +
 *           server-enforced max_tokens + Origin enforcement →
 *           "denial of wallet" attack band.
 *  #1/#2    Same-origin + auth.uid() RLS policies (supabase/policies.sql) —
 *           yahan proxy key handle karta hai, data RLS lock karta hai.
 *
 * Ye file intentionally self-contained hai: Vercel ise ESM (api/ai.js) compile
 * karta hai aur cross-file extensionless imports runtime pe fail hote hain
 * (ERR_MODULE_NOT_FOUND) — isliye core logic yahin hai.
 *
 * NOTE (rate limit): Upstash Redis configured hone par DISTRIBUTED limiter
 * chalta hai (saare serverless instances share karte hain — real protection).
 * Bina Upstash ke in-memory fallback per-instance hai (best-effort sirf).
 * Hard protection ka teesra paar = Inception Labs dashboard mein spend limit.
 * ──────────────────────────────────────────────────────────────────
 */

// Hobby plan pe default 10s kam pad sakta hai LLM ke liye
export const maxDuration = 30;

const INCEPTION_API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

// Abuse guards — proxy se koi bada payload ya request-flood nahi ho sakta
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 24000;
// Server-enforced cost params (pentest #3: max_tokens client pe control nahi).
// Report ne 300 suggest kiya tha, lekin Dukaan POS ka system prompt + reasoning
// budget ~4000 tokens maangta hai (300 pe jawab khaali aa jayega). Isliye 4000 —
// ye HARD ceiling hai; client isse upar nahi maang sakta, temperature aur
// reasoning_effort bhi server fixed karta hai (0.6 / 'medium').
const MAX_TOKENS_CAP = 4000;
const FIXED_TEMPERATURE = 0.6;
const FIXED_EFFORT = 'medium' as const;
const DEFAULT_MODEL = 'mercury-2.5';
// Model allowlist — attacker apne khud ke kharche model pe key nahi chala sakta
// (Dukaan POS sirf mercury-2.5 use karta hai)
const ALLOWED_MODELS = new Set(['mercury-2.5']);
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

interface LimitVerdict {
  retryAfterSec: number;
  reason: string;
}

/** In-memory fallback — per warm instance (best-effort) */
function checkRateLimitMemory(ip: string, now: number): LimitVerdict | null {
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

// ── Upstash Redis (distributed limiter — saare instances share karte hain) ──
// Env: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
// Fixed-window counter: INCR + pehli request pe EXPIRE. Redis atomic hai, toh
// race condition nahi. Redis down ho toh fail-OPEN (in-memory pe wapas) —
// AI chalta rahe, sirf protection kam ho.
type RedisLike = { incr: (key: string) => Promise<number>; expire: (key: string, s: number) => Promise<unknown> };
let redisClient: RedisLike | null | undefined;

async function getRedis(): Promise<RedisLike | null> {
  if (redisClient !== undefined) return redisClient;
  const url = serverEnv().UPSTASH_REDIS_REST_URL;
  const token = serverEnv().UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    redisClient = null;
    return null;
  }
  try {
    const { Redis } = await import('@upstash/redis');
    const r = new Redis({ url, token });
    redisClient = { incr: (k) => r.incr(k), expire: (k, s) => r.expire(k, s) };
  } catch (err) {
    console.warn('⚠️  Upstash init fail, in-memory rate limit pe fallback:', (err as Error).message);
    redisClient = null;
  }
  return redisClient;
}

async function checkRateLimitRedis(redis: RedisLike, ip: string): Promise<LimitVerdict | null> {
  // Hour bucket + day bucket — dono independently count hote hain
  const hourKey = `dukaan:ai:rl:h:${ip}`;
  const dayKey = `dukaan:ai:rl:d:${ip}`;
  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) await redis.expire(hourKey, Math.ceil(RATE_LIMIT.hourWindowMs / 1000));
  const dayCount = await redis.incr(dayKey);
  if (dayCount === 1) await redis.expire(dayKey, Math.ceil(RATE_LIMIT.dayWindowMs / 1000));

  if (hourCount > RATE_LIMIT.perHour) {
    return { retryAfterSec: RATE_LIMIT.hourWindowMs / 1000, reason: 'per-hour' };
  }
  if (dayCount > RATE_LIMIT.perDay) {
    return { retryAfterSec: RATE_LIMIT.dayWindowMs / 1000, reason: 'per-day' };
  }
  return null;
}

async function checkRateLimit(ip: string, now: number): Promise<LimitVerdict | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      return await checkRateLimitRedis(redis, ip);
    } catch (err) {
      // Redis down/timeout → fail-open, in-memory pe wapas (availability > strictness)
      console.warn('⚠️  Upstash rate limit fail, in-memory pe fallback:', (err as Error).message);
    }
  }
  return checkRateLimitMemory(ip, now);
}

/** Tests ke liye limiter state reset */
export function resetRateLimitForTests(): void {
  rateBuckets.clear();
  lastPrune = 0;
  redisClient = undefined;
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
  /**
   * 🔐 Supabase access token (Authorization: Bearer <token>) — ye PROVE karta hai
   * ki request asli logged-in user se aayi hai. Origin header jhooth bol sakta hai,
   * signed JWT nahi bol sakta. Bina iske AI koi bhi curl call kar sakta tha.
   */
  authToken?: string;
  /** Supabase project URL + anon key (token verify karne ke liye; dono public-by-design) */
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  /** Test injection ke liye; default global fetch */
  fetchImpl?: typeof fetch;
  /** Test injection — deterministic time */
  now?: number;
}

/**
 * 🔐 Supabase token verify (introspection) — GET {SUPABASE_URL}/auth/v1/user
 * Bearer <user access token> ke saath.
 * @returns user id ya null (invalid/expired/missing token)
 */
async function verifySupabaseToken(
  token: string,
  url: string,
  anonKey: string,
  fetchImpl: typeof fetch
): Promise<string | null> {
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return json.id ?? null;
  } catch {
    return null;
  }
}

// @types/node app tsconfig mein typed nahi — globalThis pattern (aiService.ts wala)
function serverEnv(): Record<string, string | undefined> {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

/**
 * Proxy core: origin → auth → rate-limit → sanitize → Inception ko forward.
 * - Browser-origin enforcement: POST ke liye browser hamesha Origin bhejta hai,
 *   isliye missing/cross-origin Origin = non-browser (curl/bot) → block.
 * - Same-origin browser requests allow; cross-origin 403 (clickjacking/CSRF abuse).
 * - 🔐 Valid Supabase session required (pehle layer nahi thi).
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

  // ── 🔐 AUTH: valid Supabase session required ──
  // Rate limit se PEHLE — warna anonymous spam legit user ka quota kha jayega.
  const { supabaseUrl, supabaseAnonKey } = input;
  const authConfigured = Boolean(supabaseUrl && supabaseAnonKey);
  let userId: string | null = null;
  if (authConfigured) {
    if (!input.authToken) {
      return {
        status: 401,
        payload: { error: { message: 'Login required — AI sirf logged-in dukaan ke liye hai.' } },
      };
    }
    userId = await verifySupabaseToken(input.authToken, supabaseUrl!, supabaseAnonKey!, fetchImpl);
    if (!userId) {
      return {
        status: 401,
        payload: { error: { message: 'Session expire/invalid — dobara login karo.' } },
      };
    }
  }

  // ── Rate limit (denial-of-wallet protection) ──
  // Auth ke baad — logged-in user pe count hota hai (fair: dukaan mobile IP pe
  // ho to bhi doosre dukaan wale ko block na kare), warna IP pe.
  const limitKey = userId ? `u:${userId}` : `ip:${input.clientIp || 'unknown'}`;
  const limited = await checkRateLimit(limitKey, now);
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
  // Server-enforced cost params — client ki marzi se upar nahi ja sakte.
  // max_tokens: client value bilkul ignore, hamesha MAX_TOKENS_CAP (hard ceiling).
  // 300 rakhne se app ka reasoning budget nahi bhar paata (jawab khaali aa jayega) —
  // isliye 4000 ceiling + 'medium' effort cap = cost ke liye safe.
  const temperature = FIXED_TEMPERATURE;
  const maxTokens = MAX_TOKENS_CAP;
  const reasoningEffort = FIXED_EFFORT;

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

/** "Bearer <token>" → "<token>" */
function bearerToken(headers: Record<string, string | string[] | undefined>): string {
  const raw = firstHeader(headers, 'authorization') ?? '';
  return raw.replace(/^Bearer\s+/i, '').trim();
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
    // 🔐 User ka Supabase session — yehi prove karta hai ki request legit user se hai
    authToken: bearerToken(req.headers),
    // Supabase URL + anon key dono public-by-design hain (RLS hi asli protection hai),
    // isliye VITE_ wale reuse kar lete hain — naye env vars add karne ki zaroorat nahi.
    supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY,
  });
  const retryAfter = (result.payload as { error?: { retryAfterSec?: number } } | null)?.error?.retryAfterSec;
  if (result.status === 429 && typeof retryAfter === 'number' && res.setHeader) {
    res.setHeader('Retry-After', String(retryAfter));
  }
  res.status(result.status).json(result.payload);
}
