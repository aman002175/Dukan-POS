/**
 * api/ai.ts — Inception Labs serverless proxy (Vercel Function) — VULN-03 fix
 * ──────────────────────────────────────────────────────────────────
 * Vercel env var (bina VITE_ prefix — client bundle mein embed NAHI hoti):
 *   INCEPTION_API_KEY      → recommended
 *   VITE_INCEPTION_API_KEY → fallback (purani config; hata do jab ho sake)
 *
 * Ye file intentionally self-contained hai: Vercel ise ESM (`api/ai.js`)
 * compile karta hai aur cross-file extensionless imports runtime pe fail
 * hote hain (ERR_MODULE_NOT_FOUND). Isiliye core logic yahin hai.
 * ──────────────────────────────────────────────────────────────────
 */

// Hobby plan pe default 10s kam pad sakta hai LLM ke liye
export const maxDuration = 30;

const INCEPTION_API_URL = 'https://api.inceptionlabs.ai/v1/chat/completions';

// Abuse guards — proxy se koi bada payload ya request-flood nahi ho sakta
const MAX_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 24000;
const MAX_TOKENS_CAP = 8000;
const DEFAULT_MODEL = 'mercury-2.5';
const SAFE_ROLES = new Set(['user', 'assistant', 'system']);

interface ProxyRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface ProxyResponse {
  status(code: number): { json(payload: unknown): void };
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
  /** Test injection ke liye; default global fetch */
  fetchImpl?: typeof fetch;
}

// @types/node app tsconfig mein typed nahi — globalThis pattern (aiService.ts wala)
function serverEnv(): Record<string, string | undefined> {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

/**
 * Proxy ka core: validate → sanitize → Inception ko forward.
 * Same-origin browser requests allow; cross-origin 403 (abuse protection).
 */
export async function handleAIProxy(input: AIProxyInput): Promise<ProxyResult> {
  const { fetchImpl = fetch } = input;

  if (input.method !== 'POST') {
    return { status: 405, payload: { error: { message: 'Method Not Allowed — sirf POST' } } };
  }

  // Same-origin guard: browser request ka origin host == is server ka host hona chahiye.
  // Cross-origin browser calls (kisi aur site se) 403. Server-to-server (no Origin) allowed.
  if (input.origin && input.host) {
    try {
      if (new URL(input.origin).host !== input.host) {
        return { status: 403, payload: { error: { message: 'Forbidden — cross-origin request blocked' } } };
      }
    } catch {
      return { status: 400, payload: { error: { message: 'Bad Request — invalid Origin' } } };
    }
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

  const payload = {
    model: typeof body.model === 'string' && body.model ? body.model : DEFAULT_MODEL,
    messages: safeMessages,
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.6,
    max_tokens:
      typeof body.max_tokens === 'number'
        ? Math.min(Math.max(1, body.max_tokens), MAX_TOKENS_CAP)
        : 4000,
    reasoning_effort: typeof body.reasoning_effort === 'string' ? body.reasoning_effort : 'medium',
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
  });
  res.status(result.status).json(result.payload);
}
