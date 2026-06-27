import { Link } from "react-router-dom";

import { fmtArea, fmtEur, fmtYen, severityRank } from "@/lib/format";
import { latestScore, type ListingSummary } from "@/lib/types";

import { FlagBadge } from "./FlagBadge";
import { ScoreBadge } from "./ScoreBadge";
import { StatusPill } from "./StatusPill";

interface Props {
  listing: ListingSummary;
  onToggleFavorite?: (l: ListingSummary) => void;
}

export function ListingCard({ listing, onToggleFavorite }: Props) {
  const score = latestScore(listing);
  const title = listing.title_original ?? listing.title_fr ?? "Annonce sans titre";
  const flags = [...listing.flags].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  return (
    <article className="panel group flex flex-col p-4 transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill status={listing.personal_status} />
            {listing.listing_status && listing.listing_status !== "active" && (
              <span className="chip border-ink/30 text-ink-mute">
                {listing.listing_status}
              </span>
            )}
          </div>
          <Link to={`/listings/${listing.id}`} className="mt-2 block">
            <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug group-hover:text-vermilion">
              {title}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-ink-soft">
            {[listing.city, listing.prefecture].filter(Boolean).join(" · ") || "Lieu inconnu"}
          </p>
        </div>
        <div className="flex flex-col items-center gap-2">
          <ScoreBadge score={score?.total_score} confidence={score?.confidence_score} />
          <button
            type="button"
            aria-label={listing.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            aria-pressed={listing.favorite}
            onClick={() => onToggleFavorite?.(listing)}
            className="text-2xl leading-none transition-transform active:scale-90"
          >
            <span className={listing.favorite ? "text-vermilion" : "text-ink/25"}>
              {listing.favorite ? "★" : "☆"}
            </span>
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-xl font-semibold">{fmtYen(listing.price_yen)}</span>
        <span className="text-sm text-ink-mute">{fmtEur(listing.price_eur)}</span>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-xs">
        <div>
          <dt className="text-ink-mute">Terrain</dt>
          <dd className="font-semibold">{fmtArea(listing.land_area_m2)}</dd>
        </div>
        <div>
          <dt className="text-ink-mute">Bâti</dt>
          <dd className="font-semibold">{fmtArea(listing.building_area_m2)}</dd>
        </div>
        <div>
          <dt className="text-ink-mute">Année</dt>
          <dd className="font-semibold">{listing.build_year ?? "—"}</dd>
        </div>
      </dl>

      {listing.summary_fr && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-soft">{listing.summary_fr}</p>
      )}

      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {flags.slice(0, 4).map((f) => (
            <FlagBadge key={f.id} flag={f} />
          ))}
          {flags.length > 4 && (
            <span className="chip border-ink/30 text-ink-mute">+{flags.length - 4}</span>
          )}
        </div>
      )}
    </article>
  );
}
