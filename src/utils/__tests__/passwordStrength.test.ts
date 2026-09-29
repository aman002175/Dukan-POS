import { describe, it, expect } from 'vitest';
import {
  scorePassword,
  sanitizeEmail,
  onlyDigits,
  hasUnsafeChars,
} from '@/utils/passwordStrength';

describe('scorePassword', () => {
  it('khaali password = score 0', () => {
    const s = scorePassword('');
    expect(s.score).toBe(0);
    expect(s.percent).toBe(0);
    expect(s.meetsPolicy).toBe(false);
  });

  it('common password turant 0 score (bahut kamzor)', () => {
    const s = scorePassword('password123');
    expect(s.score).toBe(0);
    expect(s.label).toBe('Bahut Kamzor');
    expect(s.feedback.some((f) => f.includes('common'))).toBe(true);
  });

  it('sirf digits (12345678) = common list se score 0, policy pass par weak', () => {
    const s = scorePassword('12345678');
    expect(s.score).toBe(0);
    expect(s.meetsPolicy).toBe(true); // server minimum meet karta hai, par weak
    expect(s.feedback.some((f) => f.includes('common'))).toBe(true);
  });

  it('8 chars + 1 digit = policy pass', () => {
    const s = scorePassword('abcd1234');
    expect(s.meetsPolicy).toBe(true);
  });

  it('kamzor (sirf lowercase+digits, chhota) = score 1-2', () => {
    const s = scorePassword('shop2024');
    expect(s.score).toBeLessThanOrEqual(2);
  });

  it('strong password (mixed classes, 12+) = score 3-4', () => {
    const s = scorePassword('Dukaan@2026#Pos');
    expect(s.score).toBeGreaterThanOrEqual(3);
    expect(s.percent).toBeGreaterThanOrEqual(75);
  });

  it('sequence penalty — abc/123 kamzor karta hai', () => {
    const withSeq = scorePassword('abc12345');
    const withoutSeq = scorePassword('axc12453');
    expect(withSeq.score).toBeLessThanOrEqual(withoutSeq.score);
  });

  it('repeat penalty — aaa/111', () => {
    const s = scorePassword('aaa12345');
    expect(s.feedback.some((f) => f.includes('Same character'))).toBe(true);
  });

  it('percent 0-100 range me hai', () => {
    for (const pw of ['', 'a', 'ab12', 'Abcdef12', 'Str0ng!Pass', 'Xk9$mQ2#vL8pW1']) {
      const s = scorePassword(pw);
      expect(s.percent).toBeGreaterThanOrEqual(0);
      expect(s.percent).toBeLessThanOrEqual(100);
    }
  });

  it('feedback array kabhi empty strings nahi deta', () => {
    const s = scorePassword('weak');
    s.feedback.forEach((f) => expect(f.length).toBeGreaterThan(0));
  });
});

describe('sanitizeEmail', () => {
  it('normal email normalize karta hai (trim + lowercase)', () => {
    expect(sanitizeEmail('  Dukaandar@Example.COM  ')).toBe('dukaandar@example.com');
  });

  it('control chars = reject (header injection block)', () => {
    expect(sanitizeEmail('a@b.com\u0000')).toBeNull();
    expect(sanitizeEmail('a@b.com\n')).toBeNull();
    expect(sanitizeEmail('a@b.com\tc@d.com')).toBeNull();
  });

  it('structurally invalid emails reject', () => {
    expect(sanitizeEmail('nope')).toBeNull();
    expect(sanitizeEmail('a@b')).toBeNull();
    expect(sanitizeEmail('')).toBeNull();
    expect(sanitizeEmail('a b@c.com')).toBeNull();
  });

  it('bahut lamba email reject (RFC 5321: max 254)', () => {
    const long = 'a'.repeat(250) + '@b.com';
    expect(sanitizeEmail(long)).toBeNull();
  });

  it('valid email null nahi hota', () => {
    expect(sanitizeEmail('test@gmail.com')).toBe('test@gmail.com');
  });

  it('do alag emails ka sanitized output alag hai (OTP ek email se bind)', () => {
    const a = sanitizeEmail('Shop@x.com');
    const b = sanitizeEmail('other@x.com');
    expect(a).not.toBe(b);
  });
});

describe('onlyDigits', () => {
  it('non-digits strip + max len clamp', () => {
    expect(onlyDigits('12ab34cd56', 4)).toBe('1234');
    expect(onlyDigits('1234567', 6)).toBe('123456');
  });
});

describe('hasUnsafeChars', () => {
  it('HTML/control chars detect karta hai', () => {
    expect(hasUnsafeChars('<script>')).toBe(true);
    expect(hasUnsafeChars('a\u0001b')).toBe(true);
    expect(hasUnsafeChars('safe-text 123')).toBe(false);
  });

  it('non-string = unsafe', () => {
    expect(hasUnsafeChars(undefined as unknown as string)).toBe(true);
  });
});
