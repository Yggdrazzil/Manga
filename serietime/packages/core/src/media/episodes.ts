export type EpisodeRef = {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  airDate?: string | null;
  watched: boolean;
};

export function compareEpisodes(a: EpisodeRef, b: EpisodeRef): number {
  if (a.seasonNumber !== b.seasonNumber) return a.seasonNumber - b.seasonNumber;
  return a.episodeNumber - b.episodeNumber;
}

// Next episode to watch: first unwatched aired episode, specials (S0) last.
export function nextEpisodeToWatch(episodes: EpisodeRef[], now = new Date()): EpisodeRef | null {
  const aired = episodes
    .filter((e) => e.seasonNumber > 0)
    .filter((e) => !e.watched)
    .filter((e) => e.airDate && new Date(e.airDate) <= now)
    .sort(compareEpisodes);
  return aired[0] ?? null;
}

export function remainingAiredCount(episodes: EpisodeRef[], now = new Date()): number {
  return episodes.filter(
    (e) => e.seasonNumber > 0 && !e.watched && e.airDate && new Date(e.airDate) <= now,
  ).length;
}

export function showProgress(episodes: EpisodeRef[]): { watched: number; total: number } {
  const regular = episodes.filter((e) => e.seasonNumber > 0);
  return { watched: regular.filter((e) => e.watched).length, total: regular.length };
}

export function formatEpisodeCode(seasonNumber: number, episodeNumber: number): string {
  const s = String(seasonNumber).padStart(2, '0');
  const e = String(episodeNumber).padStart(2, '0');
  return `S${s} | E${e}`;
}
