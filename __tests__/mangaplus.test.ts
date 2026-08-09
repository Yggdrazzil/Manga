import { parseDailyReleases, type MangaPlusRelease } from '../lib/api/mangaplus';

// Representative web-home fixture (shape matches the documented MangaPlus web
// API; the live endpoint can't be reached from CI — datacenter IPs are banned —
// so this exercises the parser, while on-device verification confirms the shape).
const webHomeFixture = {
  success: {
    webHomeViewV4: {
      groups: [
        {
          title: "Today's update",
          titleGroups: [
            {
              titleGroupName: 'Shonen Jump',
              titles: [
                {
                  titleUpdateStatus: 'UPDATED',
                  title: {
                    titleId: 100191,
                    name: 'One Piece',
                    author: 'Eiichiro Oda',
                    portraitImageUrl: 'https://mp/op.png',
                    language: undefined,
                    viewCount: 445000,
                  },
                  chapter: { titleId: 100191, chapterId: 1, name: '#1052', subTitle: 'New Dawn', startTimeStamp: 1_700_000_000 },
                },
                {
                  // No update marker → featured/ranked tile, must be dropped.
                  title: { titleId: 200, name: 'Featured Only', language: undefined },
                },
                {
                  // Spanish title → filtered out (en/fr only).
                  titleUpdateStatus: 'UPDATED',
                  title: { titleId: 300, name: 'Solo Español', language: 'SPANISH' },
                  chapter: { titleId: 300, chapterId: 9, name: '#5' },
                },
              ],
            },
          ],
        },
        {
          title: 'Brand new',
          titles: [
            {
              updateStatus: 'NEW',
              title: { titleId: 100191, name: 'One Piece DUPLICATE', language: 'ENGLISH' },
            },
            {
              titleUpdateStatus: 'NEW',
              title: { titleId: 555, name: 'Fresh Series', language: 'FRENCH' },
              latestChapter: { titleId: 555, chapterId: 2, name: '#1', subTitle: 'Pilot', startTimeStamp: 1_700_086_400 },
            },
          ],
        },
      ],
    },
  },
};

describe('parseDailyReleases', () => {
  let releases: MangaPlusRelease[];
  beforeAll(() => { releases = parseDailyReleases(webHomeFixture); });

  it('keeps only updated/new en+fr titles', () => {
    const ids = releases.map(r => r.manga.id);
    expect(ids).toContain('100191'); // One Piece (UPDATED)
    expect(ids).toContain('555');    // Fresh Series (NEW, fr)
    expect(ids).not.toContain('200'); // no update marker
    expect(ids).not.toContain('300'); // spanish
  });

  it('de-duplicates a title that appears in two groups', () => {
    expect(releases.filter(r => r.manga.id === '100191')).toHaveLength(1);
  });

  it('maps chapter label, subtitle and timestamp', () => {
    const op = releases.find(r => r.manga.id === '100191')!;
    expect(op.chapterLabel).toBe('1052');
    expect(op.chapterSubtitle).toBe('New Dawn');
    expect(op.publishAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(op.viewCount).toBe(445000);
    expect(op.isNew).toBe(false);
  });

  it('flags brand-new series and reads latestChapter when chapter is absent', () => {
    const fresh = releases.find(r => r.manga.id === '555')!;
    expect(fresh.isNew).toBe(true);
    expect(fresh.chapterLabel).toBe('1');
    expect(fresh.manga.title.userPreferred).toBe('Fresh Series');
  });

  it('returns [] on an error payload or unknown shape', () => {
    expect(parseDailyReleases({ error: { popups: [{ subject: 'Account Banned' }] } })).toEqual([]);
    expect(parseDailyReleases({})).toEqual([]);
    expect(parseDailyReleases({ success: {} })).toEqual([]);
  });
});

import { xorDecrypt } from '../lib/api/mangaplus';

describe('xorDecrypt', () => {
  it('returns the buffer unchanged when no key is given', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    expect(Array.from(xorDecrypt(bytes))).toEqual([1, 2, 3, 4]);
    expect(Array.from(xorDecrypt(new Uint8Array([9]), ''))).toEqual([9]);
  });

  it('is an involution: decrypting twice with the same key restores the input', () => {
    const original = new Uint8Array([0x00, 0xff, 0x42, 0x13, 0x99]);
    const key = 'a1b2c3';
    const once = xorDecrypt(original.slice(), key);
    expect(Array.from(once)).not.toEqual(Array.from(original));
    const twice = xorDecrypt(once, key);
    expect(Array.from(twice)).toEqual(Array.from(original));
  });

  it('cycles the key when shorter than the data', () => {
    // key 0xff XORs every byte; longer data than key forces the modulo cycle
    const bytes = new Uint8Array([0x00, 0x0f, 0xf0, 0xff]);
    const out = xorDecrypt(bytes, 'ff');
    expect(Array.from(out)).toEqual([0xff, 0xf0, 0x0f, 0x00]);
  });

  it('applies multi-byte keys positionally', () => {
    const bytes = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
    // key bytes: [0x01, 0x02] → XOR [0x01,0x02,0x01,0x02]
    const out = xorDecrypt(bytes, '0102');
    expect(Array.from(out)).toEqual([0x11, 0x22, 0x31, 0x42]);
  });
});

// ── getDailyReleases : distinguer « injoignable » de « aucune sortie » ────────

import { getDailyReleases } from '../lib/api/mangaplus';

describe('getDailyReleases', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  const mockJson = (body: unknown, ok = true, status = 200) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok, status, json: async () => body,
    }) as unknown as typeof fetch;
  };

  it('remonte une erreur quand l’API répond 200 avec un corps d’erreur', async () => {
    // Cas réel : MANGA Plus renvoie 200 + « Account Banned » aux IP de
    // datacenter. Renvoyer [] ici afficherait « revenez plus tard » à tort.
    mockJson({ error: { englishPopup: { subject: 'Account Banned', body: '…' } } });
    await expect(getDailyReleases()).rejects.toThrow('Account Banned');
  });

  it('remonte aussi la variante `popups` du corps d’erreur', async () => {
    mockJson({ error: { popups: [{ subject: 'Maintenance' }] } });
    await expect(getDailyReleases()).rejects.toThrow('Maintenance');
  });

  it('propage une panne réseau au lieu de l’avaler', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
    await expect(getDailyReleases()).rejects.toThrow();
  });

  it('renvoie une liste vide — sans erreur — quand le feed n’a rien à annoncer', async () => {
    mockJson({ success: { webHomeViewV4: { groups: [] } } });
    await expect(getDailyReleases()).resolves.toEqual([]);
  });

  it('renvoie les sorties analysées quand tout va bien', async () => {
    mockJson({
      success: {
        webHomeViewV4: {
          groups: [{
            titles: [{
              titleUpdateStatus: 'UPDATED',
              title: { titleId: 42, name: 'Test Title', language: 'ENGLISH' },
              chapter: { titleId: 42, chapterId: 1, name: '#7' },
            }],
          }],
        },
      },
    });
    const out = await getDailyReleases();
    expect(out).toHaveLength(1);
    expect(out[0].chapterLabel).toBe('7');
  });
});
