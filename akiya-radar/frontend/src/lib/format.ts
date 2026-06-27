export const fmtYen = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (v === 0) return "0 ¥ (譲渡)";
  return `${new Intl.NumberFormat("fr-FR").format(v)} ¥`;
};

export const fmtEur = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  return `≈ ${new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v)}`;
};

export const fmtArea = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${v} m²`;

export const scoreColor = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return "text-ink-mute";
  if (score >= 70) return "text-moss";
  if (score >= 50) return "text-gold";
  return "text-vermilion";
};

export const scoreBg = (score: number | null | undefined): string => {
  if (score === null || score === undefined) return "bg-ink-mute";
  if (score >= 70) return "bg-moss";
  if (score >= 50) return "bg-gold";
  return "bg-vermilion";
};

export const accuracyLabel: Record<string, string> = {
  exact: "Localisation exacte",
  approximate: "Localisation approximative",
  city: "Ville uniquement",
};

export const severityRank = (s: string): number =>
  ({ critical: 0, warning: 1, info: 2 })[s] ?? 3;
