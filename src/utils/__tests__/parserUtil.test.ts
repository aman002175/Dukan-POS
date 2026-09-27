import { describe, it, expect } from 'vitest';
import {
  devanagariToRoman,
  parseVoiceCommand,
  formatParsedCommand,
  resolveDisplayUnit,
} from '@/utils/parserUtil';

describe('devanagariToRoman', () => {
  it('converts Devanagari digits to ASCII', () => {
    expect(devanagariToRoman('२')).toBe('2');
    expect(devanagariToRoman('१२३')).toBe('123');
  });

  it('converts common Hindi number words', () => {
    expect(devanagariToRoman('चार')).toBe('char');
    expect(devanagariToRoman('दो')).toBe('do');
    expect(devanagariToRoman('आधा')).toBe('aadha');
    expect(devanagariToRoman('डेढ़')).toBe('dedh');
  });

  it('converts unit words', () => {
    expect(devanagariToRoman('किलो')).toBe('kilo');
    expect(devanagariToRoman('पैकेट')).toBe('packet');
    expect(devanagariToRoman('लीटर')).toBe('litre');
  });

  it('converts grocery brand names', () => {
    expect(devanagariToRoman('मैगी')).toBe('maggi');
    expect(devanagariToRoman('किटकैट')).toBe('kitkat');
    expect(devanagariToRoman('अमूल')).toBe('amul');
  });

  it('passes English text unchanged', () => {
    expect(devanagariToRoman('2 kilo aata')).toBe('2 kilo aata');
    expect(devanagariToRoman('hello world')).toBe('hello world');
  });

  it('handles mixed Hindi-English', () => {
    const result = devanagariToRoman('2 किलो aata');
    expect(result).toContain('kilo');
    expect(result).toContain('aata');
    expect(result).toContain('2');
  });

  it('converts full sentence', () => {
    const result = devanagariToRoman('चार चॉकलेट');
    expect(result).toBe('char chocolate');
  });
});

describe('parseVoiceCommand', () => {
  it('extracts numeric quantity', () => {
    const result = parseVoiceCommand('2 maggi');
    expect(result.quantity).toBe(2);
    expect(result.quantityExplicit).toBe(true);
    expect(result.searchTerm).toContain('maggi');
  });

  it('extracts Hindi word quantity', () => {
    const result = parseVoiceCommand('चार चॉकलेट');
    expect(result.quantity).toBe(4);
    expect(result.quantityExplicit).toBe(true);
    expect(result.searchTerm).toContain('chocolate');
  });

  it('defaults quantity to 1 when none spoken', () => {
    const result = parseVoiceCommand('maggi');
    expect(result.quantity).toBe(1);
    expect(result.quantityExplicit).toBe(false);
  });

  it('extracts unit (kilo)', () => {
    const result = parseVoiceCommand('2 kilo aata');
    expect(result.unit).toBe('kg');
  });

  it('extracts unit (packet)', () => {
    const result = parseVoiceCommand('3 packet maggi');
    expect(result.unit).toBe('packet');
  });

  it('handles fraction aadha', () => {
    const result = parseVoiceCommand('aadha kilo dahi');
    expect(result.quantity).toBe(0.5);
    expect(result.unit).toBe('kg');
    expect(result.searchTerm).toContain('dahi');
  });

  it('strips filler words', () => {
    const result = parseVoiceCommand('do maggi dena');
    expect(result.quantity).toBe(2);
    expect(result.searchTerm).toContain('maggi');
    expect(result.searchTerm).not.toContain('dena');
  });

  it('handles pure Devanagari input', () => {
    const result = parseVoiceCommand('दो किलो चावल');
    expect(result.quantity).toBe(2);
    expect(result.unit).toBe('kg');
    expect(result.searchTerm).toContain('chawal');
  });

  it('handles "dedh" (1.5)', () => {
    const result = parseVoiceCommand('dedh kilo chawal');
    expect(result.quantity).toBe(1.5);
    expect(result.unit).toBe('kg');
  });

  it('handles single digit followed by unit', () => {
    const result = parseVoiceCommand('1 litre doodh');
    expect(result.quantity).toBe(1);
    expect(result.unit).toBe('litre');
    expect(result.searchTerm).toContain('doodh');
  });

  it('returns normalised transcript', () => {
    const result = parseVoiceCommand('  DO  MAGGI  ');
    expect(result.normalised).toBe('do maggi');
  });
});

describe('formatParsedCommand', () => {
  it('formats with unit', () => {
    const result = formatParsedCommand({
      quantity: 2, unit: 'kg', searchTerm: 'aata',
      normalised: '', quantityExplicit: true,
    });
    expect(result).toBe('2 kg – aata');
  });

  it('formats without unit', () => {
    const result = formatParsedCommand({
      quantity: 1, unit: null, searchTerm: 'maggi',
      normalised: '', quantityExplicit: false,
    });
    expect(result).toBe('1 – maggi');
  });
});

describe('resolveDisplayUnit', () => {
  it('returns voice unit when present', () => {
    expect(resolveDisplayUnit('kg', 'piece')).toBe('kg');
  });

  it('falls back to product unit', () => {
    expect(resolveDisplayUnit(null, 'piece')).toBe('piece');
  });

  it('returns empty string when both null', () => {
    expect(resolveDisplayUnit(null, '')).toBe('');
  });
});
