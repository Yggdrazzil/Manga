"""Flood, tsunami and landslide risk from the national Hazard Map Portal.

``disaportaldata.gsi.go.jp`` publishes the official 重ねるハザードマップ layers
as raster tiles — free, key-less, and the same data the government shows the
public. There is no point-query API, so the position is converted to a tile
plus a pixel inside it and that pixel's colour is matched against the published
legend.

This is what finally fills ``flood_risk`` / ``tsunami_risk`` /
``landslide_risk``: until now the columns existed and were always ``None``,
which reads in the UI exactly like "no risk here".

Two honesty rules, because a wrong reassurance is worse than no answer:

- A tile that 404s means *no hazard zone is mapped at this location*, which is
  reported as ``none`` — distinct from ``unknown`` when the network failed.
- The sampled RGBA and the tile URL are kept in the payload so any classification
  can be re-checked against the source.
"""

from __future__ import annotations

import io
import logging
import math
from dataclasses import dataclass, field

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.hazard_tiles")

TILE_BASE = "https://disaportaldata.gsi.go.jp/raster"
ZOOM = 16

# Legend colours (RGB) → (risk label, French description). Sourced from the
# Hazard Map Portal's published legends.
_FLOOD_LEGEND: tuple[tuple[tuple[int, int, int], str, str], ...] = (
    ((247, 245, 169), "low", "moins de 0,5 m"),
    ((255, 216, 192), "medium", "0,5 à 3 m"),
    ((255, 183, 183), "high", "3 à 5 m"),
    ((255, 145, 145), "high", "5 à 10 m"),
    ((242, 133, 201), "very_high", "10 à 20 m"),
    ((220, 122, 220), "very_high", "plus de 20 m"),
)

_LANDSLIDE_LEGEND: tuple[tuple[tuple[int, int, int], str, str], ...] = (
    ((255, 245, 62), "medium", "zone d'alerte (警戒区域)"),
    ((255, 40, 0), "high", "zone d'alerte spéciale (特別警戒区域)"),
    ((230, 0, 18), "high", "zone d'alerte spéciale (特別警戒区域)"),
)

LAYERS: dict[str, dict] = {
    "flood": {
        "path": "01_flood_l2_shinsuishin_data",
        "legend": _FLOOD_LEGEND,
        "label_fr": "Inondation (crue maximale envisagée)",
    },
    "tsunami": {
        "path": "04_tsunami_newlegend_data",
        "legend": _FLOOD_LEGEND,
        "label_fr": "Submersion tsunami",
    },
    "storm_surge": {
        "path": "03_hightide_l2_shinsuishin_data",
        "legend": _FLOOD_LEGEND,
        "label_fr": "Submersion marine (onde de tempête)",
    },
    "landslide_debris": {
        "path": "05_dosekiryukeikaikuiki",
        "legend": _LANDSLIDE_LEGEND,
        "label_fr": "Coulée de débris",
    },
    "landslide_steep": {
        "path": "05_kyukeishakeikaikuiki",
        "legend": _LANDSLIDE_LEGEND,
        "label_fr": "Effondrement de pente raide",
    },
    "landslide_slide": {
        "path": "05_jisuberikeikaikuiki",
        "legend": _LANDSLIDE_LEGEND,
        "label_fr": "Glissement de terrain",
    },
}

_RISK_ORDER = {"unknown": -1, "none": 0, "low": 1, "medium": 2, "high": 3, "very_high": 4}


@dataclass
class LayerReading:
    layer: str
    label_fr: str
    risk: str  # none | low | medium | high | very_high | unknown
    detail_fr: str | None = None
    tile_url: str | None = None
    rgba: tuple[int, int, int, int] | None = None


@dataclass
class HazardTileReport:
    readings: list[LayerReading] = field(default_factory=list)
    source_name: str = "重ねるハザードマップ (国土地理院)"

    def worst(self, *layers: str) -> LayerReading | None:
        candidates = [r for r in self.readings if r.layer in layers]
        if not candidates:
            return None
        return max(candidates, key=lambda r: _RISK_ORDER.get(r.risk, -1))

    def to_json(self) -> dict:
        return {
            "source": self.source_name,
            "layers": [
                {
                    "layer": r.layer,
                    "label_fr": r.label_fr,
                    "risk": r.risk,
                    "detail_fr": r.detail_fr,
                    "tile_url": r.tile_url,
                    "rgba": list(r.rgba) if r.rgba else None,
                }
                for r in self.readings
            ],
        }


def latlon_to_tile_pixel(lat: float, lon: float, zoom: int = ZOOM) -> tuple[int, int, int, int]:
    """Web-Mercator position → ``(tile_x, tile_y, px, py)`` with px/py in 0-255."""
    n = 1 << zoom
    lat_rad = math.radians(lat)
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n
    tile_x, tile_y = int(x), int(y)
    return tile_x, tile_y, int((x - tile_x) * 256), int((y - tile_y) * 256)


def _classify(rgba: tuple[int, int, int, int], legend) -> tuple[str, str | None]:
    """Nearest legend colour, or ``none`` when the pixel is transparent/blank."""
    r, g, b, a = rgba
    if a < 24:
        return "none", None
    best: tuple[float, str, str] | None = None
    for (lr, lg, lb), risk, detail in legend:
        distance = math.dist((r, g, b), (lr, lg, lb))
        if best is None or distance < best[0]:
            best = (distance, risk, detail)
    if best is None or best[0] > 60:
        # Coloured, but not a legend colour (labels, boundaries, base map).
        return "none", None
    return best[1], best[2]


def _sample_layer(layer: str, lat: float, lon: float, timeout: float) -> LayerReading:
    spec = LAYERS[layer]
    tile_x, tile_y, px, py = latlon_to_tile_pixel(lat, lon)
    url = f"{TILE_BASE}/{spec['path']}/{ZOOM}/{tile_x}/{tile_y}.png"
    reading = LayerReading(
        layer=layer, label_fr=spec["label_fr"], risk="unknown", tile_url=url
    )
    try:
        resp = httpx.get(
            url, headers={"User-Agent": get_settings().user_agent}, timeout=timeout
        )
    except Exception as exc:  # noqa: BLE001 — enrichment must never break callers
        logger.info("hazard tile %s unreachable: %s", url, exc)
        return reading

    if resp.status_code == 404:
        # No tile published for this area = the layer maps no zone here.
        reading.risk = "none"
        return reading
    # Content-type is unreliable here — the portal serves valid PNG tiles as
    # ``application/octet-stream``. Let the decoder be the judge.
    if resp.status_code != 200:
        return reading

    try:
        from PIL import Image

        with Image.open(io.BytesIO(resp.content)) as image:
            rgba = image.convert("RGBA").getpixel((px, py))
    except Exception as exc:  # noqa: BLE001 — a broken tile is not an app error
        logger.info("hazard tile %s unreadable: %s", url, exc)
        return reading

    pixel = (int(rgba[0]), int(rgba[1]), int(rgba[2]), int(rgba[3]))
    risk, detail = _classify(pixel, spec["legend"])
    reading.risk, reading.detail_fr, reading.rgba = risk, detail, pixel
    return reading


def fetch_hazard_tiles(lat, lon, layers: tuple[str, ...] | None = None) -> HazardTileReport | None:
    """Sample every hazard layer at ``(lat, lon)``. ``None`` if disabled/no point."""
    settings = get_settings()
    if not settings.hazard_enabled or lat is None or lon is None:
        return None
    report = HazardTileReport()
    for layer in layers or tuple(LAYERS):
        report.readings.append(
            _sample_layer(layer, float(lat), float(lon), settings.import_fetch_timeout)
        )
    return report
