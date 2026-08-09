import {
  formatShortDateFr,
  formatTimeHHMM,
  isRecentRelease,
  isToday,
  releaseGroupLabel,
  releaseGroupRank,
} from '@/lib/utils/dates';

// Référence fixe : mercredi 12 février 2026, 10h00 heure locale.
const NOW = new Date(2026, 1, 12, 10, 0, 0);

function at(year: number, month: number, day: number, h = 12, m = 0): string {
  return new Date(year, month, day, h, m, 0).toISOString();
}

describe('releaseGroupLabel', () => {
  it('regroupe par jour calendaire, pas par écart de 24 h', () => {
    // Le vrai bug corrigé : publié hier à 23h, consulté aujourd'hui à 10h.
    // L'écart est de 11 h (< 24 h) mais c'est bien HIER.
    expect(releaseGroupLabel(at(2026, 1, 11, 23, 0), NOW)).toBe('HIER');
    // Et publié aujourd'hui à 00h30 → 9h30 d'écart, AUJOURD'HUI.
    expect(releaseGroupLabel(at(2026, 1, 12, 0, 30), NOW)).toBe("AUJOURD'HUI");
  });

  it('nomme les trois premiers jours puis le jour de la semaine', () => {
    expect(releaseGroupLabel(at(2026, 1, 12, 9), NOW)).toBe("AUJOURD'HUI");
    expect(releaseGroupLabel(at(2026, 1, 11), NOW)).toBe('HIER');
    expect(releaseGroupLabel(at(2026, 1, 10), NOW)).toBe('AVANT-HIER');
    expect(releaseGroupLabel(at(2026, 1, 9), NOW)).toBe('LUNDI');
    expect(releaseGroupLabel(at(2026, 1, 7), NOW)).toBe('SAMEDI');
  });

  it('bascule sur une date absolue au-delà d’une semaine', () => {
    expect(releaseGroupLabel(at(2026, 1, 5), NOW)).toBe('5 FÉVR. 2026');
    expect(releaseGroupLabel(at(2025, 11, 25), NOW)).toBe('25 DÉC. 2025');
  });

  it('rattache une date future à AUJOURD’HUI plutôt qu’à une section « demain »', () => {
    expect(releaseGroupLabel(at(2026, 1, 13), NOW)).toBe("AUJOURD'HUI");
  });

  it('gère les entrées vides ou invalides sans planter', () => {
    expect(releaseGroupLabel('', NOW)).toBe('DATE INCONNUE');
    expect(releaseGroupLabel('pas-une-date', NOW)).toBe('DATE INCONNUE');
  });
});

describe('releaseGroupRank', () => {
  it('ordonne les sections de la plus récente à la plus ancienne', () => {
    const today = releaseGroupRank(at(2026, 1, 12), NOW);
    const yesterday = releaseGroupRank(at(2026, 1, 11), NOW);
    const lastWeek = releaseGroupRank(at(2026, 1, 3), NOW);
    expect(today).toBeLessThan(yesterday);
    expect(yesterday).toBeLessThan(lastWeek);
  });

  it('relègue les dates inconnues en fin de liste', () => {
    expect(releaseGroupRank('', NOW)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('ne produit jamais de rang négatif pour une date future', () => {
    expect(releaseGroupRank(at(2026, 1, 20), NOW)).toBe(0);
  });
});

describe('isToday / isRecentRelease', () => {
  it('isToday suit le jour calendaire', () => {
    expect(isToday(at(2026, 1, 12, 23, 59), NOW)).toBe(true);
    expect(isToday(at(2026, 1, 11, 23, 59), NOW)).toBe(false);
  });

  it('isRecentRelease couvre aujourd’hui et hier, de façon stable dans la journée', () => {
    expect(isRecentRelease(at(2026, 1, 12, 1), NOW)).toBe(true);
    expect(isRecentRelease(at(2026, 1, 11, 1), NOW)).toBe(true);
    expect(isRecentRelease(at(2026, 1, 10, 23), NOW)).toBe(false);
    expect(isRecentRelease('', NOW)).toBe(false);
  });
});

describe('formatage', () => {
  it('formate une date courte en français', () => {
    expect(formatShortDateFr(at(2026, 1, 12))).toBe('12 févr. 2026');
    expect(formatShortDateFr('')).toBe('');
  });

  it('formate une heure sur deux chiffres', () => {
    expect(formatTimeHHMM(at(2026, 1, 12, 17, 5))).toBe('17:05');
    expect(formatTimeHHMM(at(2026, 1, 12, 9, 0))).toBe('09:00');
    expect(formatTimeHHMM('invalide')).toBe('');
  });
});
