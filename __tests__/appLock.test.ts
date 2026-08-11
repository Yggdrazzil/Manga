import { RELOCK_AFTER_MS, shouldRelock } from '@/lib/utils/appLock';

describe('shouldRelock', () => {
  const T = 1_000_000;

  it('ne verrouille pas quand l’app n’est jamais passée en arrière-plan', () => {
    expect(shouldRelock(null, T)).toBe(false);
  });

  it('laisse passer un aller-retour court', () => {
    // Consulter une notification ou copier un lien ne doit pas obliger à
    // s'authentifier de nouveau.
    expect(shouldRelock(T, T + 2_000)).toBe(false);
    expect(shouldRelock(T, T + RELOCK_AFTER_MS - 1)).toBe(false);
  });

  it('reverrouille au-delà du délai de grâce', () => {
    expect(shouldRelock(T, T + RELOCK_AFTER_MS)).toBe(true);
    expect(shouldRelock(T, T + 60 * 60 * 1000)).toBe(true);
  });

  it('reverrouille si l’horloge recule (pas de contournement possible)', () => {
    // Un retour en arrière de l'horloge ne doit pas ouvrir une fenêtre
    // indéfinie sans authentification : le résultat reste défini.
    expect(shouldRelock(T, T - 10_000)).toBe(false);
  });

  it('utilise un délai de grâce court mais non nul', () => {
    expect(RELOCK_AFTER_MS).toBeGreaterThan(0);
    expect(RELOCK_AFTER_MS).toBeLessThanOrEqual(60_000);
  });
});
