import { safeDirName } from '@/lib/utils/downloads';

describe('safeDirName — le nom de répertoire vient d’une source distante', () => {
  it('neutralise une traversée de répertoire', () => {
    // chapter-downloads/ est supprimé lors du nettoyage : sortir de ce
    // répertoire permettrait d'effacer le stockage applicatif.
    expect(safeDirName('../RCTAsyncLocalStorage_V1')).not.toContain('..');
    expect(safeDirName('../../etc/passwd')).not.toContain('/');
    expect(safeDirName('..')).not.toMatch(/^\.+$/);
  });

  it('conserve les identifiants légitimes', () => {
    expect(safeDirName('a1b2c3-d4e5')).toBe('a1b2c3-d4e5');
    expect(safeDirName('12345')).toBe('12345');
  });

  it('borne la longueur', () => {
    expect(safeDirName('x'.repeat(500)).length).toBeLessThanOrEqual(120);
  });

  it('ne renvoie jamais de séparateur de chemin', () => {
    for (const evil of ['a/b', 'a\\b', '/abs', 'a\0b', '.hidden']) {
      const out = safeDirName(evil);
      expect(out).not.toMatch(/[/\\]/);
      expect(out.startsWith('.')).toBe(false);
    }
  });
});
