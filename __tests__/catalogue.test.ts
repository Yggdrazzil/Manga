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

  it('a majority of catalogue volumes carry a pre-harvested synopsis', () => {
    // Coverage floor — fails loudly if a CI refresh regresses enrichment
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const cat = require('../assets/bd-catalogue.json') as {
      series: Array<{ volumes: Array<{ ds?: string }> }>;
    };
    const volumes = cat.series.flatMap(s => s.volumes);
    const withDs = volumes.filter(v => v.ds).length;
    expect(withDs / volumes.length).toBeGreaterThan(0.5);
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
