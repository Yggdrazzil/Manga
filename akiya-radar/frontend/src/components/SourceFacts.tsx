import { useState } from "react";

import { fmtStation, propertyTypeLabel, transactionTypeLabel } from "@/lib/format";
import type { ListingDetail } from "@/lib/types";

interface Row {
  label: string;
  value: string;
  /** Canonical field name, used to look up where the value came from. */
  field?: string;
}

/**
 * Structured facts harvested from the source page.
 *
 * Sources publish these under a dozen different Japanese labels; they arrive
 * here already normalised. The "voir les libellés source" toggle exposes the
 * original label and text behind each value, so a surprising number can always
 * be traced back rather than taken on faith.
 */
export function SourceFacts({ listing }: { listing: ListingDetail }) {
  const [showSource, setShowSource] = useState(false);

  const station = fmtStation(listing.station_walk_minutes, listing.station_distance_km);
  const rows: Row[] = [
    listing.property_type && {
      label: "Type de bien",
      value: propertyTypeLabel[listing.property_type] ?? listing.property_type,
      field: "property_type",
    },
    listing.transaction_type && {
      label: "Transaction",
      value: transactionTypeLabel[listing.transaction_type] ?? listing.transaction_type,
      field: "transaction_type",
    },
    listing.zoning && { label: "Zonage (用途地域)", value: listing.zoning, field: "zoning" },
    listing.structure && { label: "Structure", value: listing.structure, field: "structure" },
    listing.land_rights && {
      label: "Droits sur le terrain",
      value: listing.land_rights,
      field: "land_rights",
    },
    listing.station_name && {
      label: "Gare la plus proche",
      value: [listing.station_line, listing.station_name, station].filter(Boolean).join(" · "),
      field: "station_name",
    },
    listing.parking && { label: "Stationnement", value: listing.parking, field: "parking" },
    listing.current_state && {
      label: "État d'occupation",
      value: listing.current_state === "空" ? "Vacant (空)" : listing.current_state,
      field: "current_state",
    },
  ].filter(Boolean) as Row[];

  const hasLists = (listing.utilities?.length ?? 0) > 0 || (listing.features?.length ?? 0) > 0;
  if (rows.length === 0 && !hasLists) return null;

  const provenance = listing.field_provenance ?? {};
  const traceable = rows.filter((r) => r.field && provenance[r.field]);

  return (
    <section className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">Caractéristiques du bien</h2>
        {traceable.length > 0 && (
          <button
            className="btn text-sm"
            onClick={() => setShowSource((v) => !v)}
            aria-expanded={showSource}
          >
            {showSource ? "Masquer les libellés source" : "Voir les libellés source"}
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {rows.map((row) => {
            const origin = row.field ? provenance[row.field] : undefined;
            return (
              <div key={row.label} className="border-b border-line pb-2">
                <dt className="text-xs uppercase tracking-wider text-ink-mute">{row.label}</dt>
                <dd className="font-semibold">{row.value}</dd>
                {showSource && origin && (
                  <p className="mt-1 font-mono text-[11px] text-ink-mute animate-fade-in">
                    {origin.label} : {origin.text}
                  </p>
                )}
              </div>
            );
          })}
        </dl>
      )}

      {(listing.utilities?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="label">Équipements</p>
          <ul className="flex flex-wrap gap-1.5">
            {listing.utilities!.map((u) => (
              <li key={u} className="chip border-line text-ink-soft">
                {u}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(listing.source_name || listing.fetch_mode) && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-mute">
          {listing.source_name && <>Source : {listing.source_name}. </>}
          {listing.fetch_mode === "rendered" &&
            "Page reconstituée dans un navigateur (site en JavaScript) — vérifiez la fiche d'origine en cas de doute."}
          {listing.fetch_mode === "static" && "Page lue directement en HTML."}
        </p>
      )}

      {(listing.features?.length ?? 0) > 0 && (
        <div className="mt-4">
          <p className="label">Points forts annoncés</p>
          <ul className="flex flex-wrap gap-1.5">
            {listing.features!.map((f) => (
              <li key={f} className="chip border-indigo/30 bg-indigo/5 text-indigo">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
