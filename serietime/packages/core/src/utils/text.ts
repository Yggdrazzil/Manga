export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function titleSimilarity(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.startsWith(nb) || nb.startsWith(na)) {
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
  }
  const ta = new Set(na.split(' '));
  const tb = new Set(nb.split(' '));
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return (2 * common) / (ta.size + tb.size);
}

export function parseIntSafe(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const m = value.match(/-?\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return undefined;
}

export function parseFloatSafe(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value.replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function parseDateSafe(value: unknown): string | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'number' && value > 0) {
    const ms = value > 1e12 ? value : value * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    const s = value.trim();
    const d = new Date(s.includes('T') || s.includes(' ') ? s.replace(' ', 'T') : s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

export function parseBoolSafe(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const s = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'oui'].includes(s)) return true;
    if (['false', '0', 'no', 'n', 'non'].includes(s)) return false;
  }
  return undefined;
}
