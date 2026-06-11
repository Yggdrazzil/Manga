import { normalizeTitle } from '@/lib/api/readingFallback';

describe('normalizeTitle', () => {
  it('lowercases and strips non-alphanumerics', () => {
    expect(normalizeTitle('One Piece')).toBe('onepiece');
    expect(normalizeTitle('ONE PIECE!')).toBe('onepiece');
    expect(normalizeTitle('Solo Leveling')).toBe('sololeveling');
  });

  it('strips diacritics via NFKD', () => {
    expect(normalizeTitle('Café Détective')).toBe('cafedetective');
  });

  it('keeps spin-offs distinct from the main series', () => {
    expect(normalizeTitle('One Piece: Ace Story')).not.toBe(normalizeTitle('One Piece'));
    expect(normalizeTitle('Solo Leveling: Ragnarok')).not.toBe(normalizeTitle('Solo Leveling'));
  });

  it('handles empty and undefined input', () => {
    expect(normalizeTitle('')).toBe('');
    expect(normalizeTitle(undefined)).toBe('');
  });
});
