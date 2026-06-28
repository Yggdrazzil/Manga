import { Link } from "react-router-dom";

import { fmtYen } from "@/lib/format";
import type { Duplicate } from "@/lib/types";

const confidenceLabel: Record<string, string> = {
  exact: "Doublon certain",
  high: "Doublon probable",
  possible: "Doublon possible",
};

const confidenceTone: Record<string, string> = {
  exact: "border-vermilion bg-vermilion-soft",
  high: "border-gold bg-gold/10",
  possible: "border-ink/40 bg-paper-2",
};

export function DuplicateBanner({ duplicates }: { duplicates: Duplicate[] }) {
  if (!duplicates || duplicates.length === 0) return null;
  return (
    <div role="alert" className="space-y-2">
      <p className="font-display text-lg font-bold text-vermilion">
        ⚠ {duplicates.length} doublon(s) potentiel(s) détecté(s)
      </p>
      <p className="text-sm text-ink-soft">
        Aucune fusion automatique n'est effectuée. Vérifiez avant de continuer.
      </p>
      <ul className="space-y-2">
        {duplicates.map((d) => (
          <li
            key={d.listing_id}
            className={`flex flex-wrap items-center justify-between gap-2 border-2 p-3 ${
              confidenceTone[d.confidence] ?? confidenceTone.possible
            }`}
          >
            <div className="min-w-0">
              <span className="chip border-ink/50">{confidenceLabel[d.confidence]}</span>
              <p className="mt-1 truncate font-bold">{d.title ?? "Annonce existante"}</p>
              <p className="text-xs text-ink-soft">
                {[d.city, fmtYen(d.price_yen)].filter(Boolean).join(" · ")} — {d.reason}
              </p>
            </div>
            <Link to={`/listings/${d.listing_id}`} className="btn py-1 text-sm">
              Voir le bien existant →
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
