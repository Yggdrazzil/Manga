export function episodeCode(season: number, ep: number): string {
  return `S${String(season).padStart(2, '0')} | E${String(ep).padStart(2, '0')}`;
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function shortDateFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function timeHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function watchTime(minutes: number): { months: number; days: number; hours: number } {
  const totalHours = Math.floor(minutes / 60);
  const months = Math.floor(totalHours / (24 * 30));
  const days = Math.floor((totalHours - months * 24 * 30) / 24);
  const hours = totalHours - months * 24 * 30 - days * 24;
  return { months, days, hours };
}

const GROUP_LABELS: Record<string, string> = {
  a_voir: 'À VOIR',
  pas_regarde_depuis_un_moment: 'PAS REGARDÉ DEPUIS UN MOMENT',
  pas_commence: 'PAS COMMENCÉ',
  abandonne: 'ABANDONNÉ',
};
export function queueGroupLabel(group: string): string {
  return GROUP_LABELS[group] ?? group.toUpperCase();
}
