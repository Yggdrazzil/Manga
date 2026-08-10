import { useComicsStore } from '@/lib/store/comics';
import type { BDSeries } from '@/lib/types';

function series(over: Partial<BDSeries> = {}): BDSeries {
  return {
    id: 'thorgal',
    title: 'Thorgal',
    authors: ['Jean Van Hamme'],
    coverImage: 'https://cdn/thorgal.jpg',
    description: 'Synopsis complet de la série.',
    totalVolumes: 3,
    volumes: [
      { num: 1, title: 'Thorgal tome 1', subtitle: 'La Magicienne trahie', description: 'Résumé T1', coverImage: 'c1', authors: [] },
      { num: 2, title: 'Thorgal tome 2', subtitle: "L'Île des mers gelées", coverImage: 'c2', authors: [] },
      { num: 3, title: 'Thorgal tome 3', subtitle: 'Les Trois Vieillards', authors: [] },
    ],
    type: 'BD',
    ...over,
  };
}

beforeEach(() => {
  useComicsStore.setState({ entries: [] });
});

describe('refreshSeries — un rafraîchissement ne doit jamais appauvrir les données', () => {
  it('conserve les tomes absents du payload frais', () => {
    // Réseau dégradé : Wikidata et BnF échouent, seul Google Books répond avec
    // un tome. Sans fusion, l'utilisateur perdrait 2 tomes cochés.
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series(), 3);
    store.refreshSeries(series({ volumes: [series().volumes[0]], totalVolumes: 1 }));

    const entry = useComicsStore.getState().getEntry('thorgal')!;
    expect(entry.series.volumes.map(v => v.num)).toEqual([1, 2, 3]);
    expect(entry.readVolumes).toContain(3);
  });

  it('ne bascule pas la série en TERMINÉ à cause d’un total rétréci', () => {
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series(), 1);
    store.refreshSeries(series({ volumes: [series().volumes[0]], totalVolumes: 1 }));

    const entry = useComicsStore.getState().getEntry('thorgal')!;
    expect(entry.series.totalVolumes).toBe(3);
    expect(entry.status).not.toBe('COMPLETED');
  });

  it('n’écrase pas description et couverture de série par undefined', () => {
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series());
    store.refreshSeries(series({ description: undefined, coverImage: undefined }));

    const entry = useComicsStore.getState().getEntry('thorgal')!;
    expect(entry.series.description).toBe('Synopsis complet de la série.');
    expect(entry.series.coverImage).toBe('https://cdn/thorgal.jpg');
  });

  it('n’écrase pas les détails de tome déjà enrichis', () => {
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series());
    const stripped = series();
    stripped.volumes = stripped.volumes.map(v => ({ ...v, description: undefined, coverImage: undefined }));
    store.refreshSeries(stripped);

    const t1 = useComicsStore.getState().getEntry('thorgal')!.series.volumes.find(v => v.num === 1)!;
    expect(t1.description).toBe('Résumé T1');
    expect(t1.coverImage).toBe('c1');
  });

  it('applique bien les données fraîches quand elles sont meilleures', () => {
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series());
    const richer = series();
    richer.volumes = richer.volumes.map(v =>
      v.num === 3 ? { ...v, description: 'Résumé T3 tout neuf' } : v,
    );
    richer.volumes.push({ num: 4, title: 'Thorgal tome 4', subtitle: 'La Galère noire', authors: [] });
    store.refreshSeries(richer);

    const entry = useComicsStore.getState().getEntry('thorgal')!;
    expect(entry.series.volumes.find(v => v.num === 3)!.description).toBe('Résumé T3 tout neuf');
    expect(entry.series.volumes.map(v => v.num)).toEqual([1, 2, 3, 4]);
    expect(entry.series.totalVolumes).toBe(4);
  });

  it('ignore une série qui ne correspond pas à l’entrée', () => {
    const store = useComicsStore.getState();
    store.addOrUpdateSeries(series());
    store.refreshSeries(series({ id: 'autre-serie', title: 'Autre' }));

    expect(useComicsStore.getState().getEntry('thorgal')!.series.title).toBe('Thorgal');
  });
});
