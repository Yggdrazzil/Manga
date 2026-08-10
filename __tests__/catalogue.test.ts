import {
  findCatalogueEntry,
  findParentSeriesInCatalogue,
  searchCatalogue,
  subtitleMatchWeight,
} from '@/lib/catalogue';

// These tests run against the real bundled catalogue (assets/bd-catalogue.json),
// so they double as a regression check on the weekly CI refresh: if a canonical
// series like Tintin ever drops out of the build, they fail loudly.

describe('searchCatalogue', () => {
  it('finds canonical series case- and accent-insensitively', () => {
    expect(searchCatalogue('tintin').some(e => e.title === 'Les Aventures de Tintin')).toBe(true);
    expect(searchCatalogue('asterix').some(e => e.title === 'Astérix')).toBe(true);
  });

  it('returns empty for blank queries', () => {
    expect(searchCatalogue('')).toEqual([]);
    expect(searchCatalogue('   ')).toEqual([]);
  });
});

describe('findCatalogueEntry', () => {
  it('matches exact titles ignoring case and accents', () => {
    const entry = findCatalogueEntry('les aventures de tintin');
    expect(entry?.title).toBe('Les Aventures de Tintin');
    expect(entry?.volumes.length).toBeGreaterThanOrEqual(24);
  });

  it('returns null for unknown series', () => {
    expect(findCatalogueEntry('Une série qui n’existe pas du tout')).toBeNull();
  });
});

describe('subtitleMatchWeight', () => {
  it('matches a subtitle whose tokens are scattered in a long original title', () => {
    const weight = subtitleMatchWeight(
      'Tintin au pays des Soviets',
      'Les aventures de Tintin, reporter du "Petit Vingtième", au pays des Soviets',
    );
    expect(weight).toBeGreaterThan(0);
  });

  it('rejects subtitles with tokens missing from the title', () => {
    expect(subtitleMatchWeight('Tintin au Tibet', 'Tintin en Amérique')).toBe(0);
  });

  it('rejects matches too short to trust', () => {
    expect(subtitleMatchWeight('Le retour', 'Le grand retour de la vengeance')).toBe(0);
  });
});

describe('per-volume enrichment', () => {
  it('the Blake et Mortimer tome 12 compound subtitle has a harvested synopsis', () => {
    // Regression for the "Résumé non disponible" report: the article is
    // titled "Les Trois Formules…" while the subtitle says "Les 3 Formules…"
    const bm = findCatalogueEntry('Blake et Mortimer');
    const t12 = bm?.volumes.find(v => v.n === 12);
    expect(t12?.ds).toBeTruthy();
  });

  it('volume synopsis coverage never regresses below the floor', () => {
    // Wikipedia covers ~20% of volumes (only albums with dedicated articles);
    // the weekly CI run adds Google Books results on top. The floor guards
    // against a refresh silently wiping the harvest — raise it as coverage grows.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const cat = require('../assets/bd-catalogue.json') as {
      series: Array<{ volumes: Array<{ ds?: string }> }>;
    };
    const volumes = cat.series.flatMap(s => s.volumes);
    const withDs = volumes.filter(v => v.ds).length;
    expect(withDs / volumes.length).toBeGreaterThan(0.15);
  });
});

describe('findParentSeriesInCatalogue', () => {
  it('resolves the long original Soviets title to the Tintin series', () => {
    expect(
      findParentSeriesInCatalogue(
        'Les aventures de Tintin, reporter du "Petit Vingtième", au pays des Soviets',
      ),
    ).toBe('Les Aventures de Tintin');
  });

  it('resolves a plain album title to its series', () => {
    expect(findParentSeriesInCatalogue('Tintin en Amérique')).toBe('Les Aventures de Tintin');
  });

  it('returns null for titles matching nothing', () => {
    expect(findParentSeriesInCatalogue('xyzzy plugh frobozz')).toBeNull();
  });
});

describe('homonymes', () => {
  it('choisit la série la mieux garnie quand deux portent le même titre', () => {
    // Le catalogue contient deux « Clifton » ; la plus complète doit gagner.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const cat = require('../assets/bd-catalogue.json') as {
      series: Array<{ title: string; volumes: unknown[] }>;
    };
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

    const groups = new Map<string, Array<{ title: string; volumes: unknown[] }>>();
    for (const s of cat.series) {
      const k = norm(s.title);
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    const dupes = [...groups.values()].filter(g => g.length > 1);
    if (dupes.length === 0) return; // rien à départager dans ce build

    for (const group of dupes) {
      const richest = Math.max(...group.map(s => s.volumes.length));
      const picked = findCatalogueEntry(group[0].title);
      expect(picked?.volumes.length).toBe(richest);
    }
  });

  it('refuse de trancher un sous-titre partagé par deux séries', () => {
    // Mieux vaut laisser le pipeline réseau décider que rattacher l'album
    // à une œuvre sans rapport.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const cat = require('../assets/bd-catalogue.json') as {
      series: Array<{ title: string; volumes: Array<{ s?: string }> }>;
    };
    const owners = new Map<string, Set<string>>();
    for (const s of cat.series) {
      for (const v of s.volumes) {
        if (!v.s) continue;
        const k = v.s.toLowerCase();
        owners.set(k, (owners.get(k) ?? new Set()).add(s.title));
      }
    }
    const shared = [...owners.entries()].find(
      ([sub, set]) => set.size > 1 && sub.replace(/[^a-z0-9]/g, '').length >= 10,
    );
    if (!shared) return; // aucune collision dans ce build
    expect(findParentSeriesInCatalogue(shared[0])).toBeNull();
  });
});
