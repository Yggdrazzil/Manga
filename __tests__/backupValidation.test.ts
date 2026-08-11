import {
  parseBackup,
  sanitizeComicEntry,
  sanitizeImageUrl,
  sanitizeLibraryEntry,
} from '@/lib/utils/backupValidation';

function validEntry() {
  return {
    mangaId: '30013',
    source: 'anilist',
    status: 'READING',
    progress: 12,
    score: 80,
    addedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    readChapterIds: ['a', 'b'],
    manga: {
      id: '30013',
      title: { userPreferred: 'One Piece' },
      coverImage: 'https://cdn/op.jpg',
      genres: [],
      tags: [],
      authors: [],
    },
  };
}

function validComic() {
  return {
    seriesId: 'thorgal',
    status: 'READING',
    readVolumes: [1, 2],
    addedAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    series: {
      id: 'thorgal',
      title: 'Thorgal',
      authors: [],
      totalVolumes: 2,
      type: 'BD',
      volumes: [
        { num: 1, title: 'T1', authors: [] },
        { num: 2, title: 'T2', authors: [] },
      ],
    },
  };
}

describe('sanitizeImageUrl', () => {
  it('n’accepte que des URL https', () => {
    expect(sanitizeImageUrl('https://cdn/x.jpg')).toBe('https://cdn/x.jpg');
    expect(sanitizeImageUrl('http://cdn/x.jpg')).toBeUndefined();
  });

  it('rejette les schémas dangereux venus d’un fichier tiers', () => {
    expect(sanitizeImageUrl('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeImageUrl('file:///etc/passwd')).toBeUndefined();
    expect(sanitizeImageUrl('data:image/png;base64,AAAA')).toBeUndefined();
  });

  it('rejette les valeurs absurdes', () => {
    expect(sanitizeImageUrl('')).toBeUndefined();
    expect(sanitizeImageUrl(42)).toBeUndefined();
    expect(sanitizeImageUrl(`https://cdn/${'x'.repeat(3000)}`)).toBeUndefined();
  });
});

describe('sanitizeLibraryEntry', () => {
  it('accepte une entrée bien formée', () => {
    expect(sanitizeLibraryEntry(validEntry())?.mangaId).toBe('30013');
  });

  it('écarte ce qui n’est pas exploitable au lieu de planter', () => {
    // Le cas qui faisait échouer l'import à mi-parcours.
    expect(sanitizeLibraryEntry(null)).toBeNull();
    expect(sanitizeLibraryEntry({})).toBeNull();
    expect(sanitizeLibraryEntry([1, 2])).toBeNull();
    expect(sanitizeLibraryEntry({ ...validEntry(), mangaId: '' })).toBeNull();
    expect(sanitizeLibraryEntry({ ...validEntry(), source: 'pirate-site' })).toBeNull();
    expect(sanitizeLibraryEntry({ ...validEntry(), status: 'HACKED' })).toBeNull();
    expect(sanitizeLibraryEntry({ ...validEntry(), manga: { title: {} } })).toBeNull();
  });

  it('neutralise une couverture au schéma hostile sans perdre l’entrée', () => {
    const e = validEntry();
    e.manga.coverImage = 'javascript:alert(1)';
    const clean = sanitizeLibraryEntry(e);
    expect(clean).not.toBeNull();
    expect(clean!.manga.coverImage).toBe('');
  });

  it('borne les valeurs numériques aberrantes', () => {
    const clean = sanitizeLibraryEntry({ ...validEntry(), progress: -5, score: 9999 });
    expect(clean!.progress).toBe(0);
    expect(clean!.score).toBeUndefined();
  });

  it('ignore les identifiants de chapitre non textuels', () => {
    const clean = sanitizeLibraryEntry({ ...validEntry(), readChapterIds: ['ok', null, 3, {}] });
    expect(clean!.readChapterIds).toEqual(['ok']);
  });
});

describe('sanitizeComicEntry', () => {
  it('accepte une entrée bien formée', () => {
    expect(sanitizeComicEntry(validComic())?.seriesId).toBe('thorgal');
  });

  it('écarte une série sans titre ni liste de tomes', () => {
    expect(sanitizeComicEntry({ ...validComic(), series: { title: 'X' } })).toBeNull();
    expect(sanitizeComicEntry({ seriesId: 'x' })).toBeNull();
  });

  it('retire les tomes malformés et recalcule le total', () => {
    const c = validComic();
    (c.series.volumes as unknown[]).push(null, { num: 'trois' });
    const clean = sanitizeComicEntry(c)!;
    expect(clean.series.volumes).toHaveLength(2);
    expect(clean.series.totalVolumes).toBe(2);
  });

  it('ne garde que des numéros de tomes valides', () => {
    const clean = sanitizeComicEntry({ ...validComic(), readVolumes: [1, 'deux', null, 2] })!;
    expect(clean.readVolumes).toEqual([1, 2]);
  });
});

describe('parseBackup', () => {
  it('rejette une enveloppe qui n’est pas une sauvegarde de cette app', () => {
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup({})).toBeNull();
    expect(parseBackup({ version: 2, exportedAt: 'x', entries: [], bdEntries: [] })).toBeNull();
    expect(parseBackup({ version: 1, exportedAt: 'x', entries: {}, bdEntries: [] })).toBeNull();
  });

  it('importe ce qui est valide et compte ce qui a été écarté', () => {
    const parsed = parseBackup({
      version: 1,
      exportedAt: '2026-01-01T00:00:00Z',
      entries: [validEntry(), null, { junk: true }],
      bdEntries: [validComic(), 42],
    })!;
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.bdEntries).toHaveLength(1);
    expect(parsed.rejected).toBe(3);
  });

  it('refuse un fichier démesuré plutôt que de figer l’app', () => {
    const huge = Array.from({ length: 20_001 }, validEntry);
    expect(parseBackup({ version: 1, exportedAt: 'x', entries: huge, bdEntries: [] })).toBeNull();
  });
});
