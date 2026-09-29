import { describe, it, expect } from 'vitest';
import { normalizePhone, maskEmail } from '@/utils/passwordStrength';

describe('normalizePhone', () => {
  it('10-digit Indian mobile normalize', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
    expect(normalizePhone(' 98765 43210 ')).toBe('9876543210');
  });

  it('+91 / 0 prefix strip', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('invalid prefixes (landline) reject', () => {
    expect(normalizePhone('1234567890')).toBeNull();
    expect(normalizePhone('5123456789')).toBeNull();
  });

  it('galat length reject', () => {
    expect(normalizePhone('987654321')).toBeNull();
    expect(normalizePhone('98765432101')).toBeNull();
    expect(normalizePhone('')).toBeNull();
  });

  it('non-string reject', () => {
    expect(normalizePhone(undefined as unknown as string)).toBeNull();
  });
});

describe('maskEmail', () => {
  it('normal email — pehle 3 chars + stars + domain', () => {
    expect(maskEmail('dukandar@gmail.com')).toMatch(/^duk\*+@gmail\.com$/);
  });

  it('chhota local part — pehla char + stars', () => {
    expect(maskEmail('ab@gmail.com')).toMatch(/^a\*+@gmail\.com$/);
  });

  it('invalid email — placeholder', () => {
    expect(maskEmail('')).toBe('•••@•••');
    expect(maskEmail('nope')).toBe('•••@•••');
  });

  it('do alag emails ka mask alag dikhta hai (user confirmation ke liye)', () => {
    expect(maskEmail('shop@gmail.com')).not.toBe(maskEmail('other@gmail.com'));
  });
});
