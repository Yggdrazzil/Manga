/**
 * Standalone unit tests for pure logic (no test runner needed).
 * Run: npx tsx scripts/test-units.ts — exits 1 on any failure.
 */
import { chapterNumber, compareChapters, maxChapterProgress } from '../lib/utils/chapter';
import { extractVolumeNumber, seriesKeyFromTitle, seriesTitleFromFull } from '../lib/api/openlib';
import { parseBnFTitle } from '../lib/api/bnf';
import type { MangaChapter } from '../lib/types';

let passed = 0;
let failed = 0;

function eq<T>(label: string, actual: T, expected: T) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; return; }
  failed++;
  console.error(`✗ ${label}\n    attendu: ${JSON.stringify(expected)}\n    obtenu : ${JSON.stringify(actual)}`);
}

// ── chapterNumber ─────────────────────────────────────────────────────────────
eq('chapterNumber "12"', chapterNumber('12'), 12);
eq('chapterNumber "10.5" décimal', chapterNumber('10.5'), 10.5);
eq('chapterNumber "Oneshot" → NaN', Number.isNaN(chapterNumber('Oneshot')), true);
eq('chapterNumber "" → NaN', Number.isNaN(chapterNumber('')), true);
eq('chapterNumber null → NaN', Number.isNaN(chapterNumber(null)), true);
eq('chapterNumber undefined → NaN', Number.isNaN(chapterNumber(undefined)), true);

// ── compareChapters ───────────────────────────────────────────────────────────
const ch = (c: string | null): MangaChapter => ({ id: c ?? 'x', chapter: c, title: null, volume: null, publishAt: '', pages: 0, translatedLanguage: 'fr', mangaId: 'm' } as unknown as MangaChapter);
eq('sort numérique', [ch('2'), ch('10'), ch('1')].sort(compareChapters).map(c => c.chapter), ['1', '2', '10']);
eq('décimaux intercalés', [ch('11'), ch('10.5'), ch('10')].sort(compareChapters).map(c => c.chapter), ['10', '10.5', '11']);
eq('non-numériques en fin', [ch('Oneshot'), ch('3'), ch('1')].sort(compareChapters).map(c => c.chapter), ['1', '3', 'Oneshot']);

// ── maxChapterProgress ────────────────────────────────────────────────────────
eq('progress monte', maxChapterProgress(3, '5'), 5);
eq('progress ne descend pas', maxChapterProgress(8, '5'), 8);
eq('décimal arrondi bas', maxChapterProgress(0, '10.5'), 10);
eq('Oneshot ne pollue pas', maxChapterProgress(7, 'Oneshot'), 7);

// ── extractVolumeNumber ───────────────────────────────────────────────────────
eq('tome 8', extractVolumeNumber('Lanfeust de Troy, tome 8'), 8);
eq('T01', extractVolumeNumber('Thorgal T01'), 1);
eq('t. 3', extractVolumeNumber('Astérix t. 3'), 3);
eq('vol. 2', extractVolumeNumber('Naruto vol. 2'), 2);
eq('#5', extractVolumeNumber('Blacksad #5'), 5);
eq('(1) final', extractVolumeNumber('Le Chat du Rabbin (1)'), 1);
eq('trailing "- 4"', extractVolumeNumber('Les Tours de Bois-Maury - 4'), 4);
eq('pas de numéro', extractVolumeNumber('Le Chat du Rabbin'), undefined);
eq('année non capturée comme tome', extractVolumeNumber('Astérix tome 12'), 12);

// ── seriesKeyFromTitle / seriesTitleFromFull ──────────────────────────────────
eq('clé stable avec/sans tome', seriesKeyFromTitle('Lanfeust de Troy, tome 8'), seriesKeyFromTitle('Lanfeust de Troy'));
eq('clé accents normalisés', seriesKeyFromTitle('Astérix'), 'asterix');
eq('clé apostrophe', seriesKeyFromTitle("L'Incal T2"), 'l-incal');
eq('titre série depuis tome', seriesTitleFromFull('Thorgal, tome 12'), 'Thorgal');
eq('titre série sans suffixe inchangé', seriesTitleFromFull('Blacksad'), 'Blacksad');

// ── parseBnFTitle ─────────────────────────────────────────────────────────────
eq('BnF num + épisode', parseBnFTitle('Lanfeust de Troy. 8, La bête fabuleuse'), { num: 8, episode: 'La bête fabuleuse' });
eq('BnF sans num', parseBnFTitle('Lanfeust de Troy').num, undefined);

// ── Résultat ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} OK, ${failed} KO`);
if (failed > 0) process.exit(1);
