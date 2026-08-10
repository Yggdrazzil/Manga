import { getChaptersForLibrary } from '@/lib/api/mangadex';

// MangaDex renvoie un enregistrement par langue ET par groupe de scantrad :
// le même chapitre remonte donc plusieurs fois dans le flux de la bibliothèque.

function chapter(id: string, mangaId: string, num: string, lang: string) {
  return {
    id,
    attributes: {
      chapter: num,
      title: `T${num}`,
      translatedLanguage: lang,
      publishAt: '2026-02-12T10:00:00Z',
      pages: 20,
      externalUrl: null,
    },
    relationships: [{ id: mangaId, type: 'manga' }],
  };
}

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

function mockFeed(data: unknown[]) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data, limit: 100, offset: 0, total: data.length }),
  }) as unknown as typeof fetch;
}

describe('getChaptersForLibrary', () => {
  it('ne renvoie qu’une entrée par chapitre malgré les doublons langue/groupe', async () => {
    mockFeed([
      chapter('en-groupe-a', 'op', '1152', 'en'),
      chapter('en-groupe-b', 'op', '1152', 'en'),
      chapter('fr-groupe-c', 'op', '1152', 'fr'),
    ]);
    const out = await getChaptersForLibrary(['op'], ['fr', 'en']);
    expect(out).toHaveLength(1);
    // La langue préférée (première du tableau) doit l'emporter.
    expect(out[0].translatedLanguage).toBe('fr');
  });

  it('conserve les chapitres distincts et les séries distinctes', async () => {
    mockFeed([
      chapter('a', 'op', '1152', 'en'),
      chapter('b', 'op', '1153', 'en'),
      chapter('c', 'jjk', '1152', 'en'),
    ]);
    const out = await getChaptersForLibrary(['op', 'jjk'], ['en']);
    expect(out).toHaveLength(3);
  });

  it('renvoie une liste vide sans appeler le réseau quand aucune série n’est suivie', async () => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    await expect(getChaptersForLibrary([])).resolves.toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
