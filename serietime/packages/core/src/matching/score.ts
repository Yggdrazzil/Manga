import { normalizeTitle, titleSimilarity } from '../utils/text.js';

export type MatchCandidate = {
  mediaId?: string;
  tmdbId?: string;
  tvdbId?: string;
  imdbId?: string;
  title: string;
  originalTitle?: string;
  localizedTitle?: string;
  year?: number;
};

export type MatchTarget = {
  title: string;
  year?: number;
  tvdbId?: string;
  tmdbId?: string;
  imdbId?: string;
};

// Spec §15.6: 100 exact external id, 90 exact title + exact year,
// 80 exact title + year ±1, 70 close title + exact year, 50 close title without year.
export function scoreMatch(target: MatchTarget, candidate: MatchCandidate): number {
  if (target.tvdbId && candidate.tvdbId && target.tvdbId === candidate.tvdbId) return 100;
  if (target.tmdbId && candidate.tmdbId && target.tmdbId === candidate.tmdbId) return 100;
  if (target.imdbId && candidate.imdbId && target.imdbId === candidate.imdbId) return 100;

  const titles = [candidate.title, candidate.originalTitle, candidate.localizedTitle].filter(
    (t): t is string => !!t,
  );
  const targetNorm = normalizeTitle(target.title);
  const exact = titles.some((t) => normalizeTitle(t) === targetNorm);
  const bestSimilarity = Math.max(...titles.map((t) => titleSimilarity(target.title, t)), 0);
  const close = bestSimilarity >= 0.75;

  if (exact) {
    if (target.year !== undefined && candidate.year !== undefined) {
      if (target.year === candidate.year) return 90;
      if (Math.abs(target.year - candidate.year) <= 1) return 80;
      return 55;
    }
    return 75;
  }
  if (close) {
    if (target.year !== undefined && candidate.year !== undefined && target.year === candidate.year) return 70;
    return 50;
  }
  return Math.round(bestSimilarity * 40);
}

export type MatchDecision = 'auto' | 'auto_flagged' | 'manual';

export function decideMatch(score: number): MatchDecision {
  if (score >= 90) return 'auto';
  if (score >= 70) return 'auto_flagged';
  return 'manual';
}

export function bestCandidate(
  target: MatchTarget,
  candidates: MatchCandidate[],
): { candidate: MatchCandidate; score: number } | null {
  let best: { candidate: MatchCandidate; score: number } | null = null;
  for (const candidate of candidates) {
    const score = scoreMatch(target, candidate);
    if (!best || score > best.score) best = { candidate, score };
  }
  return best;
}
