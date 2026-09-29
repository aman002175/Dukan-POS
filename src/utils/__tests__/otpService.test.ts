import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendOtp, verifyOtp, isOtpEnabled, resetPasswordWithOtp } from '@/utils/otpService';

const URL = 'https://proj.supabase.co';
const ANON = 'anon-key-public-by-design';

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('otpService — signup OTP client', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', URL);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', ANON);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('is enabled jab supabase env set hai', () => {
    expect(isOtpEnabled()).toBe(true);
  });

  it('disabled hai aur signup fail nahi hota jab env missing hai', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    expect(isOtpEnabled()).toBe(false);
    const res = await sendOtp('a@b.com');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('setup nahi hai');
  });

  it('sendOtp success par ok + message deta hai', async () => {
    mockFetch(200, { success: true, message: 'OTP bhej diya gaya.' });
    const res = await sendOtp('dukaandar@example.com');
    expect(res.ok).toBe(true);
    expect(res.message).toBe('OTP bhej diya gaya.');
  });

  it('429 par friendly minutes-wala message deta hai (raw error nahi)', async () => {
    mockFetch(429, { success: false, error: 'rate limited', retryAfterSec: 900 });
    const res = await sendOtp('dukaandar@example.com');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('15 minute');
    expect(res.retryAfterSec).toBe(900);
  });

  it('500/502 par "service taiyar nahi" message (Brevo down hone par)', async () => {
    mockFetch(502, { success: false, error: 'Email nahi ja paya' });
    const res = await sendOtp('dukaandar@example.com');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('taiyar nahi');
  });

  it('400 par server ka error message forward karta hai', async () => {
    mockFetch(400, { success: false, error: 'Code galat ya expire ho gaya. Dobara mangwao.' });
    const res = await verifyOtp('dukaandar@example.com', '000000');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Code galat');
  });

  it('network failure par crash nahi hota', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const res = await sendOtp('dukaandar@example.com');
    expect(res.ok).toBe(false);
    expect(res.message).toContain('Network error');
  });

  it('verifyOtp email + code + purpose bhejta hai', async () => {
    const fn = mockFetch(200, { success: true, verified: true });
    await verifyOtp('dukaandar@example.com', '123456');
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL}/functions/v1/verify-otp`);
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'dukaandar@example.com',
      code: '123456',
      purpose: 'signup',
    });
  });

  it('resetPasswordWithOtp purpose=reset + new_password bhejta hai', async () => {
    const fn = mockFetch(200, { success: true, message: 'Password badal diya gaya.', password_reset: true });
    const res = await resetPasswordWithOtp('dukaandar@example.com', '654321', 'NayaPass123');
    expect(res.ok).toBe(true);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${URL}/functions/v1/verify-otp`);
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'dukaandar@example.com',
      code: '654321',
      purpose: 'reset',
      new_password: 'NayaPass123',
    });
  });

  it('sendOtp with purpose=reset wo purpose forward karta hai', async () => {
    const fn = mockFetch(200, { success: true, message: 'OTP bhej diya gaya.' });
    await sendOtp('dukaandar@example.com', 'reset');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'dukaandar@example.com',
      purpose: 'reset',
    });
  });

  it('sendOtp with purpose=password_change wo purpose forward karta hai (settings OTP-only flow)', async () => {
    const fn = mockFetch(200, { success: true, message: 'OTP bhej diya gaya.' });
    await sendOtp('dukaandar@example.com', 'password_change');
    const [, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      email: 'dukaandar@example.com',
      purpose: 'password_change',
    });
  });
});
