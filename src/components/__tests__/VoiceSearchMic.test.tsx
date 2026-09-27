import { describe, it, expect } from 'vitest';
import { cleanVoiceSearchText } from '@/components/VoiceSearchMic';

describe('cleanVoiceSearchText — voice search cleanup', () => {
  it('trims plain words', () => {
    expect(cleanVoiceSearchText('  chini  ')).toBe('chini');
  });

  it('strips Hindi danda and punctuation', () => {
    expect(cleanVoiceSearchText('chini।')).toBe('chini');
    expect(cleanVoiceSearchText('Raju?')).toBe('Raju');
    expect(cleanVoiceSearchText('"maggi",')).toBe('maggi');
  });

  it('converts Devanagari digits to ASCII', () => {
    expect(cleanVoiceSearchText('९८७६५४३२१०')).toBe('9876543210');
  });

  it('keeps phone digits usable', () => {
    expect(cleanVoiceSearchText('98765 43210')).toBe('98765 43210');
  });

  it('returns empty for empty input', () => {
    expect(cleanVoiceSearchText('   ')).toBe('');
    expect(cleanVoiceSearchText('।')).toBe('');
  });
});
