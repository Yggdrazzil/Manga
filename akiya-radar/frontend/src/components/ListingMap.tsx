import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { latestScore, type ListingSummary } from "@/lib/types";

// Default marker icons reference asset URLs that don't resolve under bundlers;
// we use lightweight inline divIcons coloured by score instead.
function markerIcon(score: number | null, accurate: boolean): L.DivIcon {
  const color =
    score === null
      ? "hsl(20 6% 50%)"
      : score >= 70
        ? "hsl(140 30% 34%)"
        : score >= 50
          ? "hsl(38 64% 46%)"
          : "hsl(8 74% 48%)";
  const ring = accurate ? "" : "border-style:dashed;";
  return L.divIcon({
    className: "",
    html: `<div style="width:26px;height:26px;border:2px solid #1d1714;${ring}background:${color};color:#f6efe2;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:2px 2px 0 rgba(29,23,20,.6)"><span style="transform:rotate(45deg)">${score ?? "?"}</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

interface Props {
  listings: ListingSummary[];
  height?: string;
  zoom?: number;
  onSelect?: (l: ListingSummary) => void;
}

export function ListingMap({ listings, height = "70vh", zoom = 5, onSelect }: Props) {
  const points = listings.filter((l) => l.lat != null && l.lon != null);
  const center: [number, number] = points.length
    ? [Number(points[0].lat), Number(points[0].lon)]
    : [36.2, 138.2];

  return (
    <div className="panel overflow-hidden" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {points.map((l) => {
          const score = latestScore(l)?.total_score ?? null;
          const accurate = l.geocode_accuracy === "exact";
          return (
            <Marker
              key={l.id}
              position={[Number(l.lat), Number(l.lon)]}
              icon={markerIcon(score, accurate)}
              eventHandlers={{ click: () => onSelect?.(l) }}
            >
              <Popup>
                <div className="space-y-1">
                  <p className="font-bold">{l.title_original ?? l.title_fr}</p>
                  <p>{[l.city, l.prefecture].filter(Boolean).join(" · ")}</p>
                  {!accurate && (
                    <p className="text-xs" style={{ color: "hsl(8 74% 48%)" }}>
                      ⚠ Localisation {l.geocode_accuracy ?? "approximative"} — non exacte
                    </p>
                  )}
                  <a
                    href={`/listings/${l.id}`}
                    style={{ color: "hsl(8 74% 48%)", fontWeight: 700 }}
                  >
                    Voir la fiche →
                  </a>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
