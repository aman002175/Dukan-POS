/**
 * api/ai.ts — Inception Labs serverless proxy (Vercel Function) — VULN-03 fix
 * ──────────────────────────────────────────────────────────────────
 * Vercel env var (bina VITE_ prefix — client bundle mein embed NAHI hoti):
 *   INCEPTION_API_KEY      → recommended
 *   VITE_INCEPTION_API_KEY → fallback (purani config; hata do jab ho sake)
 *
 * Core logic src/lib/aiProxyCore.ts mein hai (wahi tested hai) — ye file
 * sirf Vercel req/res adapter hai.
 * ──────────────────────────────────────────────────────────────────
 */
import { handleAIProxy } from '../src/lib/aiProxyCore';

// Hobby plan pe default 10s kam pad sakta hai LLM ke liye
export const maxDuration = 30;

interface VercelReq {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}
interface VercelRes {
  status(code: number): { json(payload: unknown): void };
}

function firstHeader(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name];
  return Array.isArray(v) ? v[0] : v;
}

// @types/node app tsconfig mein typed nahi — aiService.ts wala globalThis pattern
function serverEnv(): Record<string, string | undefined> {
  const g = globalThis as unknown as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env ?? {};
}

export default async function handler(req: VercelReq, res: VercelRes): Promise<void> {
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
