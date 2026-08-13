import { useState } from "react";
import { Link } from "react-router-dom";

import {
  fmtArea,
  fmtPricePerM2,
  fmtRent,
  fmtStation,
  fmtYen,
  listingStatusLabel,
  pricePerM2,
  propertyTypeLabel,
  severityRank,
} from "@/lib/format";
import { latestScore, type ListingSummary } from "@/lib/types";
import { useCurrency } from "@/lib/useCurrency";

import { CompletenessMeter } from "./CompletenessMeter";
import { FlagBadge } from "./FlagBadge";
import { HazardStrip } from "./HazardStrip";
import { ScoreBadge } from "./ScoreBadge";
import { StatusPill } from "./StatusPill";

interface Props {
  listing: ListingSummary;
  onToggleFavorite?: (l: ListingSummary) => void;
}

export function ListingCard({ listing, onToggleFavorite }: Props) {
  const money = useCurrency();
  const score = latestScore(listing);
  const title = listing.title_original ?? listing.title_fr ?? "Annonce sans titre";
  const flags = [...listing.flags].sort(
    (a, b) => severityRank(a.severity) - severityRank(b.severity),
  );

  const [photoBroken, setPhotoBroken] = useState(false);
  const photo = !photoBroken && listing.photo_urls?.[0];
  const isRental = listing.transaction_type === "rent";
  const unitPrice = pricePerM2(listing.price_yen, listing.land_area_m2);
  const station = fmtStation(listing.station_walk_minutes, listing.station_distance_km);
  const retired = listing.listing_status === "gone" || listing.listing_status === "sold";
  const hazard = listing.hazard_scores?.[listing.hazard_scores.length - 1];

  return (
    <article
      className={`panel group flex flex-col overflow-hidden transition-all duration-200 ease-out-expo hover:-translate-y-0.5 hover:shadow-lift ${
        retired ? "opacity-70" : ""
      }`}
    >
      {/* Fixed aspect ratio reserves the space before the image loads, so a
          grid of cards never reflows as photos arrive. */}
      <Link
        to={`/listings/${listing.id}`}
        tabIndex={-1}
        aria-hidden
        className="relative block aspect-[16/10] overflow-hidden bg-paper-2"
      >
        {photo ? (
          <img
            src={photo}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-[1.03]"
            onError={() => setPhotoBroken(true)}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center font-display text-4xl text-ink/10">
            空
          </span>
        )}
        {listing.property_type && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/75 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-paper backdrop-blur-sm">
            {propertyTypeLabel[listing.property_type] ?? listing.property_type}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={listing.personal_status} />
              {listing.listing_status && listing.listing_status !== "active" && (
                <span className="chip border-ink/30 text-ink-mute">
                  {listingStatusLabel[listing.listing_status] ?? listing.listing_status}
                </span>
              )}
            </div>
            <Link to={`/listings/${listing.id}`} className="mt-2 block">
              <h3 className="line-clamp-2 font-display text-lg font-bold leading-snug transition-colors group-hover:text-vermilion">
                {title}
              </h3>
            </Link>
            <p className="mt-1 truncate text-sm text-ink-soft">
              {[listing.city, listing.prefecture].filter(Boolean).join(" · ") || "Lieu inconnu"}
              {station && <span className="text-ink-mute"> · {station}</span>}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreBadge score={score?.total_score} confidence={score?.confidence_score} />
            <button
              type="button"
              aria-label={listing.favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
              aria-pressed={listing.favorite}
              onClick={() => onToggleFavorite?.(listing)}
              className="flex h-11 w-11 items-center justify-center text-2xl leading-none transition-transform duration-150 hover:scale-110 active:scale-90"
            >
              <span className={listing.favorite ? "text-vermilion" : "text-ink/25"}>
                {listing.favorite ? "★" : "☆"}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {isRental ? (
            <span className="font-mono text-xl font-semibold">
              {fmtRent(listing.rent_yen_month)}
            </span>
          ) : (
            <>
              <span className="font-mono text-xl font-semibold">{fmtYen(listing.price_yen)}</span>
              {money.format(listing.price_yen) && (
                <span className="text-sm text-ink-mute">
                  ≈ {money.format(listing.price_yen)}
                </span>
              )}
            </>
          )}
          {unitPrice !== null && (
            <span className="ml-auto font-mono text-xs text-ink-mute">
              {fmtPricePerM2(unitPrice)}
            </span>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-4 gap-2 border-t border-line pt-3 text-xs">
          <div>
            <dt className="text-ink-mute">Terrain</dt>
            <dd className="font-semibold">{fmtArea(listing.land_area_m2)}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Bâti</dt>
            <dd className="font-semibold">{fmtArea(listing.building_area_m2)}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Plan</dt>
            <dd className="font-semibold">{listing.floor_plan ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-mute">Année</dt>
            <dd className="font-semibold">{listing.build_year ?? "—"}</dd>
          </div>
        </dl>

        <div className="mt-3 empty:mt-0">
          <HazardStrip hazard={hazard} />
        </div>

        {flags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {flags.slice(0, 3).map((f) => (
              <FlagBadge key={f.id} flag={f} />
            ))}
            {flags.length > 3 && (
              <span className="chip border-ink/30 text-ink-mute">+{flags.length - 3}</span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <CompletenessMeter value={listing.data_completeness} />
        </div>
      </div>
    </article>
  );
}
