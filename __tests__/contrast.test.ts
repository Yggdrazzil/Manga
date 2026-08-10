import { contrastRatio, meetsAA, readableInk, relativeLuminance } from '@/lib/utils/contrast';
import { THEMES } from '@/constants/themes';

describe('relativeLuminance', () => {
  it('encadre le noir et le blanc', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('accepte les formes courtes et rgba', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('rgba(255, 255, 255, 0.5)')).toBeCloseTo(1, 5);
  });

  it('retourne null sur une valeur non analysable', () => {
    expect(relativeLuminance('transparent')).toBeNull();
  });
});

describe('contrastRatio', () => {
  it('donne 21 pour noir sur blanc', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('est symétrique', () => {
    expect(contrastRatio('#FBBF24', '#0B0908')).toBeCloseTo(
      contrastRatio('#0B0908', '#FBBF24')!, 5,
    );
  });
});

describe('readableInk', () => {
  it('choisit l’encre sombre sur l’ambre vif — le cas qui échouait', () => {
    // #FBBF24 (warning du thème Néo-Tokyo) avec un texte clair donnait 1,41:1.
    const ink = readableInk('#FBBF24');
    expect(meetsAA(ink, '#FBBF24')).toBe(true);
    expect(contrastRatio(ink, '#FBBF24')!).toBeGreaterThan(10);
  });

  it('choisit l’encre claire sur un fond sombre', () => {
    expect(readableInk('#0B0908')).toBe('#FFFFFF');
  });

  it('retombe sur l’encre sombre si la couleur est inconnue', () => {
    expect(readableInk('linear-gradient(...)')).toBe('#0B0908');
  });
});

describe('badges de tous les thèmes', () => {
  // Garde-fou : ajouter un thème dont un fond de badge serait illisible fait
  // échouer ce test au lieu de partir en production.
  const BADGE_KEYS = ['warning', 'success', 'statusCompleted', 'accent', 'cyan', 'error'] as const;

  it('readableInk atteint AA sur chaque fond de badge de chaque thème', () => {
    const failures: string[] = [];
    for (const [name, theme] of Object.entries(THEMES)) {
      const colors = theme.colors as unknown as Record<string, string>;
      for (const key of BADGE_KEYS) {
        const bg = colors[key];
        if (!bg || relativeLuminance(bg) === null) continue;
        const ink = readableInk(bg);
        if (!meetsAA(ink, bg)) {
          failures.push(`${name}.${key} (${bg}) → ${contrastRatio(ink, bg)!.toFixed(2)}:1`);
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
