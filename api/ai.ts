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

// ── Rate limit ──
// Do dimensions dono enforce hote hain:
//   per-USER — legit dukaan ka apna budget (multi-store app, ek owner = ek account)
//   per-IP   — fallback/joint layer: ek IP se kai accounts bana ke quota nahi dila sakta
// Auth ke baad lagta hai, aur auth rate limit se PEHLE check hota hai.
interface LimiterSpec {
  perHour: number;
  perDay: number;
}
const USER_LIMIT: LimiterSpec = { perHour: 20, perDay: 200 };
const IP_LIMIT: LimiterSpec = { perHour: 10, perDay: 60 };
const RATE_LIMIT = {
  hourWindowMs: 60 * 60 * 1000,
  dayWindowMs: 24 * 60 * 60 * 1000,
};
// Body size cap — abuse rokne ke liye, par LEGIT use na tode.
// Measured (240-1000 products, 200 customers, 2000 sales, 8 messages): ~27 KB.
// 128KB rakha hai = 4-5x headroom (user lambe text paste kar sakta hai), jabki
// MB-scale flood abhi bhi block hota hai.
// ⚠️ Pehle 20KB tha — wo real prompt (25k+) se chhota tha aur AI har request pe
// "Payload too large" fail ho raha tha. Size se pehle sochna zaroori hai.
const MAX_BODY_BYTES = 128 * 1024;
const MAX_HISTORY_MESSAGES = 8; // system prompt ke saath max messages
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
  /** X-RateLimit-Remaining header ke liye (bache hue requests) */
  remaining: number;
}

/** In-memory fallback — per warm instance (best-effort) */
/** In-memory fallback — per warm instance (best-effort) */
function bumpMemory(key: string, spec: LimiterSpec, now: number): LimitVerdict | null {
  pruneBuckets(now);
  let b = rateBuckets.get(key);
  if (!b) {
    b = {
      hour: { count: 0, resetAt: now + RATE_LIMIT.hourWindowMs },
      day: { count: 0, resetAt: now + RATE_LIMIT.dayWindowMs },
    };
    rateBuckets.set(key, b);
  }
  if (now >= b.hour.resetAt) b.hour = { count: 0, resetAt: now + RATE_LIMIT.hourWindowMs };
  if (now >= b.day.resetAt) b.day = { count: 0, resetAt: now + RATE_LIMIT.dayWindowMs };

  if (b.hour.count >= spec.perHour) {
    return {
      retryAfterSec: Math.ceil((b.hour.resetAt - now) / 1000),
      reason: 'per-hour',
      remaining: 0,
    };
  }
  if (b.day.count >= spec.perDay) {
    return {
      retryAfterSec: Math.ceil((b.day.resetAt - now) / 1000),
      reason: 'per-day',
      remaining: 0,
    };
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

async function bumpRedis(
  redis: RedisLike,
  key: string,
  spec: LimiterSpec
): Promise<LimitVerdict | null> {
  const hourKey = `dukaan:ai:rl:h:${key}`;
  const dayKey = `dukaan:ai:rl:d:${key}`;
  const hourCount = await redis.incr(hourKey);
  if (hourCount === 1) await redis.expire(hourKey, Math.ceil(RATE_LIMIT.hourWindowMs / 1000));
  const dayCount = await redis.incr(dayKey);
  if (dayCount === 1) await redis.expire(dayKey, Math.ceil(RATE_LIMIT.dayWindowMs / 1000));

  const remaining = Math.max(0, Math.min(spec.perHour - hourCount, spec.perDay - dayCount));
  if (hourCount > spec.perHour) {
    return { retryAfterSec: RATE_LIMIT.hourWindowMs / 1000, reason: 'per-hour', remaining };
  }
  if (dayCount > spec.perDay) {
    return { retryAfterSec: RATE_LIMIT.dayWindowMs / 1000, reason: 'per-day', remaining };
  }
  return null;
}

/**
 * Per-user + per-IP dono check. Jo pehle cross kare wahi verdict (stricter wins).
 * @returns allowed null, ya limit hit + bache hue requests
 */
async function checkRateLimit(
  ip: string,
  userId: string | null,
  now: number
): Promise<LimitVerdict | null> {
  // Authenticated user pe user-limit, plus hamesha IP-limit (multi-account abuse rokne ke liye)
  const targets: Array<{ key: string; spec: LimiterSpec }> = [
    { key: `ip:${ip}`, spec: IP_LIMIT },
  ];
  if (userId) targets.unshift({ key: `u:${userId}`, spec: USER_LIMIT });

  const redis = await getRedis();
  for (const t of targets) {
    let verdict: LimitVerdict | null = null;
    if (redis) {
      try {
        verdict = await bumpRedis(redis, t.key, t.spec);
      } catch (err) {
        // Redis down/timeout → fail-open, in-memory pe wapas (availability > strictness)
        console.warn('⚠️  Upstash rate limit fail, in-memory pe fallback:', (err as Error).message);
        verdict = null;
      }
    }
    if (!verdict) verdict = bumpMemory(t.key, t.spec, now);
    if (verdict) return verdict;
  }
  return null;
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
  // ── Rate limit (denial-of-wallet protection) ──
  // Auth ke baad — per-user + per-IP dono guard (multi-account abuse bhi).
  const limited = await checkRateLimit(input.clientIp || 'unknown', userId, now);
  if (limited) {
    return {
      status: 429,
    payload: {
      error: {
        message: `AI rate limit exceeded (${limited.reason}). Thodi der baad try karo.`,
        retryAfterSec: limited.retryAfterSec,
        remaining: limited.remaining,
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
    // Size guard — bada raw payload parse karne se pehle hi 413
    if (raw.length > MAX_BODY_BYTES) {
      return { status: 413, payload: { error: { message: 'Request bahut bada hai — thoda kam bhejo.' } } };
    }
    try {
      raw = JSON.parse(raw);
    } catch {
      return { status: 400, payload: { error: { message: 'Bad Request — invalid JSON body' } } };
    }
  }
  const body = (raw ?? {}) as Record<string, unknown>;

  // Size guard — object form mein bhi check (Vercel already-parsed body deta hai)
  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    return { status: 413, payload: { error: { message: 'Request bahut bada hai — thoda kam bhejo.' } } };
  }

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
  // ⚠️ System prompt hamesha RAKHA jata hai (uske bina AI ka pura behaviour
  // bhool jata hai — dukaan data/ID/action format sab usme hai). Sirf chat
  // history trim hoti hai, taaki prompt-injection se budget blow na ho.
  const firstIsSystem = String((messages[0] as Record<string, unknown>)?.role) === 'system';
  const systemMsg = firstIsSystem ? [messages[0] as Record<string, unknown>] : [];
  const history = (firstIsSystem ? messages.slice(1) : messages).slice(-MAX_HISTORY_MESSAGES);
  const safeMessages = [...systemMsg, ...history]
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
  if (res.setHeader) {
    if (result.status === 429 && typeof retryAfter === 'number') {
      res.setHeader('Retry-After', String(retryAfter));
    }
    const remaining = (result.payload as { error?: { remaining?: number } } | null)?.error?.remaining;
    if (typeof remaining === 'number') {
      res.setHeader('X-RateLimit-Remaining', String(remaining));
    }
  }
  res.status(result.status).json(result.payload);
}
