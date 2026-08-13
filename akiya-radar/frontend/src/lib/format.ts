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

/** Yen per m² of land — the only way to compare plots of different sizes. */
export const pricePerM2 = (
  priceYen: number | null | undefined,
  landM2: number | null | undefined,
): number | null =>
  priceYen && landM2 && landM2 > 0 ? Math.round(priceYen / landM2) : null;

export const fmtPricePerM2 = (v: number | null): string =>
  v === null ? "—" : `${new Intl.NumberFormat("fr-FR").format(v)} ¥/m²`;

export const fmtRent = (v: number | null | undefined): string =>
  v === null || v === undefined
    ? "—"
    : `${new Intl.NumberFormat("fr-FR").format(v)} ¥ / mois`;

export const propertyTypeLabel: Record<string, string> = {
  kominka: "Kominka",
  machiya: "Machiya",
  house: "Maison",
  apartment: "Appartement",
  land: "Terrain",
  other: "Autre",
};

export const transactionTypeLabel: Record<string, string> = {
  sale: "Vente",
  rent: "Location",
  unknown: "Non précisé",
};

export const listingStatusLabel: Record<string, string> = {
  active: "Disponible",
  unknown: "Statut inconnu",
  gone: "Annonce retirée",
  sold: "Vendu",
  under_negotiation: "En négociation",
  paused: "Suspendu",
};

// --- natural hazards --------------------------------------------------------

export const RISK_LABELS: Record<string, string> = {
  none: "Hors zone",
  low: "Faible",
  medium: "Modéré",
  high: "Élevé",
  very_high: "Très élevé",
  unknown: "Non vérifié",
};

/** Ink-on-paper palette classes per risk level. `unknown` stays deliberately
 *  neutral: an unchecked hazard must never read as a clean bill of health. */
export const riskTone = (level: string | null | undefined): string => {
  switch (level) {
    case "very_high":
    case "high":
      return "bg-vermilion/12 text-vermilion border-vermilion/30";
    case "medium":
      return "bg-gold/12 text-gold border-gold/30";
    case "low":
      return "bg-gold/8 text-gold/90 border-gold/25";
    case "none":
      return "bg-moss/10 text-moss border-moss/25";
    default:
      return "bg-paper-2 text-ink-mute border-line";
  }
};

export const riskRank = (level: string | null | undefined): number =>
  ({ very_high: 4, high: 3, medium: 2, low: 1, none: 0 })[level ?? ""] ?? -1;

export const fmtElevation = (v: number | null | undefined): string =>
  v === null || v === undefined ? "—" : `${Number(v).toFixed(1)} m`;

/** Distance to the nearest station, using whatever the source actually gave. */
export const fmtStation = (
  walkMinutes: number | null | undefined,
  distanceKm: number | null | undefined,
): string | null => {
  if (walkMinutes !== null && walkMinutes !== undefined) return `${walkMinutes} min à pied`;
  if (distanceKm !== null && distanceKm !== undefined) return `${distanceKm} km`;
  return null;
};

// --- data completeness ------------------------------------------------------

export const completenessLabel = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "Complétude inconnue";
  if (v >= 80) return "Fiche complète";
  if (v >= 50) return "Fiche partielle";
  return "Fiche très incomplète";
};

export const completenessTone = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "text-ink-mute";
  if (v >= 80) return "text-moss";
  if (v >= 50) return "text-gold";
  return "text-vermilion";
};
