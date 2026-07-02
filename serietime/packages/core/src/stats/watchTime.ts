export type WatchTimeBreakdown = { months: number; days: number; hours: number };

const DEFAULT_EPISODE_RUNTIME_MIN = 40;
const DEFAULT_MOVIE_RUNTIME_MIN = 110;

export function minutesToBreakdown(totalMinutes: number): WatchTimeBreakdown {
  const totalHours = Math.floor(totalMinutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const days = Math.floor((totalHours - months * 24 * 30) / 24);
  const hours = totalHours - months * 24 * 30 - days * 24;
  return { months, days, hours };
}

export function episodesWatchTimeMinutes(runtimes: (number | null | undefined)[]): number {
  return runtimes.reduce<number>((sum, r) => sum + (r && r > 0 ? r : DEFAULT_EPISODE_RUNTIME_MIN), 0);
}

export function moviesWatchTimeMinutes(runtimes: (number | null | undefined)[]): number {
  return runtimes.reduce<number>((sum, r) => sum + (r && r > 0 ? r : DEFAULT_MOVIE_RUNTIME_MIN), 0);
}
