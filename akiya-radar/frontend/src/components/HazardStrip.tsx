import { RISK_LABELS, riskRank, riskTone } from "@/lib/format";
import type { HazardScore } from "@/lib/types";

const LAYERS: { key: keyof HazardScore; label: string; short: string }[] = [
  { key: "flood_risk", label: "Inondation", short: "Inond." },
  { key: "tsunami_risk", label: "Tsunami", short: "Tsunami" },
  { key: "landslide_risk", label: "Glissement de terrain", short: "Glisst." },
  { key: "storm_surge_risk", label: "Submersion marine", short: "Marine" },
];

const SEISMIC_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Modéré",
  high: "Élevé",
  unknown: "Non vérifié",
};

interface Props {
  hazard: HazardScore | undefined;
  /** `compact` fits a card; the full form is for the detail page. */
  variant?: "compact" | "full";
}

/**
 * Measured natural-hazard levels from the national hazard maps.
 *
 * The distinction that matters here is `none` (the layer covers this point and
 * maps no zone) versus `unknown` (we could not check). They are never merged:
 * showing an unverified hazard as clear is the one failure mode that could
 * actually cost the user money.
 */
export function HazardStrip({ hazard, variant = "compact" }: Props) {
  if (!hazard) {
    return variant === "compact" ? null : (
      <p className="text-sm text-ink-mute">
        Risques naturels non encore vérifiés — lancez « Vérifier les risques ».
      </p>
    );
  }

  const readings = LAYERS.map((layer) => ({
    ...layer,
    level: (hazard[layer.key] as string | null) ?? "unknown",
  }));
  const seismic = hazard.earthquake_risk ?? "unknown";

  if (variant === "compact") {
    // On a card, only what changes a decision: the worst mapped zone.
    const worst = [...readings].sort((a, b) => riskRank(b.level) - riskRank(a.level))[0];
    const chips = [];
    if (worst && riskRank(worst.level) >= 1) {
      chips.push(
        <span key="worst" className={`chip border ${riskTone(worst.level)}`}>
          {worst.short} · {RISK_LABELS[worst.level]}
        </span>,
      );
    }
    if (seismic === "high") {
      chips.push(
        <span key="quake" className={`chip border ${riskTone("high")}`}>
          Séisme élevé
        </span>,
      );
    }
    if (chips.length === 0 && readings.every((r) => r.level === "none")) {
      chips.push(
        <span key="clear" className={`chip border ${riskTone("none")}`}>
          Hors zone d'aléa
        </span>,
      );
    }
    return chips.length ? <div className="flex flex-wrap gap-1.5">{chips}</div> : null;
  }

  return (
    <div className="space-y-3">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {readings.map((r) => (
          <li key={r.key} className={`rounded-lg border px-3 py-2 ${riskTone(r.level)}`}>
            <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">
              {r.label}
            </p>
            <p className="mt-0.5 font-display text-lg font-bold">{RISK_LABELS[r.level]}</p>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-soft">
        <span className="font-bold">Risque sismique :</span>{" "}
        {SEISMIC_LABELS[seismic] ?? seismic}
        {hazard.source_name && (
          <span className="ml-2 text-xs text-ink-mute">— {hazard.source_name}</span>
        )}
      </p>
      <p className="text-xs text-ink-mute">
        « Hors zone » signifie que la carte officielle couvre ce point sans y
        cartographier d'aléa. « Non vérifié » signifie que la donnée n'a pas pu
        être consultée — ce n'est pas une absence de risque.
      </p>
    </div>
  );
}
