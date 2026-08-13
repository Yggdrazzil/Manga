"""Build a static JSON dataset — the app without a server or a database.

Everything the backend normally does at request time is done here, once, ahead
of time: crawl the enabled sources, extract and normalise each listing, enrich
it with the public Japanese data, detect red flags and score it. The result is
a plain JSON file the frontend reads directly.

That removes the two things a server was needed for:

- **Persistence** → a committed JSON file; personal state (favourites, notes,
  statuses) lives in the browser.
- **Crawling** → runs here, in CI, where cross-origin rules do not apply. The
  browser could never fetch a municipal akiya bank itself.

Every enrichment API used at *display* time (geocoding, hazard maps, exchange
rates) sends ``Access-Control-Allow-Origin: *``, so the published page keeps
working on its own.

Usage::

    python scripts/build_static_dataset.py --sources athome-18202,athome-32528
    python scripts/build_static_dataset.py --prefecture 福井県 --limit-per-source 40

Output: ``frontend/public/data/listings.json`` and ``meta.json``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from urllib.parse import urljoin, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import (  # noqa: E402
    catalog,
    elevation,
    extraction,
    fetcher,
    geocoding,
    hazard,
    hazard_tiles,
    red_flags,
    scoring,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("akiya.static")

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = REPO_ROOT / "frontend" / "public" / "data"

# Same politeness rules as the worker: small municipal sites, personal use.
REQUEST_DELAY_SECONDS = 1.5
DEFAULT_LIMIT_PER_SOURCE = 40

_DETAIL_HINTS = ("bukken", "property", "detail", "estate", "kominka")
_DETAIL_RE = re.compile(r"/\d{2,}")


def _json_safe(value):
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def discover_detail_urls(index_html: str, base_url: str, limit: int) -> list[str]:
    """Find candidate detail-page links on a source's index page."""
    if not index_html:
        return []
    base_host = urlsplit(base_url).netloc
    found: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r'href=["\']([^"\']+)["\']', index_html, re.I):
        href = match.group(1)
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        parts = urlsplit(absolute)
        if parts.scheme not in ("http", "https"):
            continue
        if base_host and parts.netloc and parts.netloc != base_host:
            continue
        path = parts.path.lower()
        if (any(h in path for h in _DETAIL_HINTS) or _DETAIL_RE.search(path)) and (
            absolute not in seen
        ):
            seen.add(absolute)
            found.append(absolute)
            if len(found) >= limit:
                break
    return found


def _stable_id(url: str) -> str:
    return hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]


def build_listing(url: str, entry: catalog.CatalogEntry | None) -> dict | None:
    """Fetch one listing page and produce a fully enriched record."""
    outcome, html = fetcher.fetch_page(url)
    if outcome != "ok" or not html:
        logger.info("  skip %s (%s)", url, outcome)
        return None

    try:
        result = extraction.extract_listing(html, base_url=url)
    except Exception as exc:  # noqa: BLE001 — one bad page never stops the build
        logger.warning("  extraction failed for %s: %s", url, exc)
        return None

    fields = dict(result.fields)
    # A page with no price and no area is an index or an error page, not a listing.
    if fields.get("price_yen") is None and fields.get("land_area_m2") is None:
        logger.info("  skip %s (no usable fields)", url)
        return None

    now = datetime.now(UTC).isoformat()
    listing: dict = {
        "id": _stable_id(url),
        "source_url": url,
        "source_key": entry.key if entry else None,
        "source_name": entry.name if entry else None,
        "listing_status": fields.get("listing_status") or "active",
        "personal_status": "new",
        "favorite": False,
        "rating": None,
        "first_seen_at": now,
        "last_seen_at": now,
        "created_at": now,
        "updated_at": now,
        "data_completeness": result.completeness,
        "field_provenance": result.provenance,
        "notes": [],
        "tasks": [],
        "price_history": [],
        **{k: v for k, v in fields.items() if k != "listing_status"},
    }

    # Geocode, then everything that depends on coordinates.
    address = listing.get("address_text") or " ".join(
        p for p in (listing.get("prefecture"), listing.get("city")) if p
    )
    point = geocoding.geocode(address) if address else None
    if point is not None:
        listing["lat"] = point.lat
        listing["lon"] = point.lon
        listing["geocode_accuracy"] = point.accuracy

        seismic = hazard.fetch_seismic_hazard(point.lat, point.lon)
        tiles = hazard_tiles.fetch_hazard_tiles(point.lat, point.lon)
        if seismic or tiles:
            flood = tiles.worst("flood") if tiles else None
            tsunami = tiles.worst("tsunami") if tiles else None
            surge = tiles.worst("storm_surge") if tiles else None
            slide = (
                tiles.worst("landslide_debris", "landslide_steep", "landslide_slide")
                if tiles
                else None
            )
            listing["hazard_scores"] = [
                {
                    "id": listing["id"] + "-hz",
                    "earthquake_risk": seismic.risk_label if seismic else None,
                    "flood_risk": flood.risk if flood else None,
                    "tsunami_risk": tsunami.risk if tsunami else None,
                    "storm_surge_risk": surge.risk if surge else None,
                    "landslide_risk": slide.risk if slide else None,
                    "source_name": " + ".join(
                        n
                        for n in (
                            seismic.source_name if seismic else None,
                            tiles.source_name if tiles else None,
                        )
                        if n
                    )
                    or None,
                    "raw_json": {
                        "seismic": {
                            "T30_I50_PS": seismic.prob_shindo5_upper_30y,
                            "T30_I60_PS": seismic.prob_shindo6_lower_30y,
                        }
                        if seismic
                        else None,
                        "tiles": tiles.to_json() if tiles else None,
                    },
                    "created_at": now,
                }
            ]
        ground = elevation.fetch_elevation(point.lat, point.lon)
        if ground is not None:
            listing["elevation_m"] = ground.metres
    else:
        listing.setdefault("lat", None)
        listing.setdefault("lon", None)
        listing.setdefault("geocode_accuracy", None)

    listing.setdefault("hazard_scores", [])

    detected = red_flags.detect_flags(
        listing.get("title_original"),
        listing.get("description_original"),
        listing.get("price_text_original"),
        listing.get("remarks"),
    )
    listing["flags"] = [
        {"id": f"{listing['id']}-f{i}", **flag} for i, flag in enumerate(detected)
    ]

    latest_hazard = listing["hazard_scores"][-1] if listing["hazard_scores"] else None
    score = scoring.score_listing(
        {
            "price_yen": listing.get("price_yen"),
            "prefecture": listing.get("prefecture"),
            "city": listing.get("city"),
            "lat": listing.get("lat"),
            "lon": listing.get("lon"),
            "geocode_accuracy": listing.get("geocode_accuracy"),
            "land_area_m2": listing.get("land_area_m2"),
            "building_area_m2": listing.get("building_area_m2"),
            "build_year": listing.get("build_year"),
            "property_type": listing.get("property_type"),
            "listing_status": listing.get("listing_status"),
        },
        flags=[{"flag_code": f["flag_code"], "severity": f["severity"]} for f in detected],
        hazard={**latest_hazard, "elevation_m": listing.get("elevation_m")}
        if latest_hazard
        else None,
    )
    listing["scores"] = [
        {"id": listing["id"] + "-s", "created_at": now, **asdict(score)}
    ]
    # `positives`/`negatives` are already folded into explanation_fr.
    listing["scores"][0].pop("positives", None)
    listing["scores"][0].pop("negatives", None)

    return _json_safe(listing)


def resolve_sources(args) -> list[catalog.CatalogEntry]:
    if args.sources:
        keys = [k.strip() for k in args.sources.split(",") if k.strip()]
        entries = [catalog.get(k) for k in keys]
        missing = [k for k, e in zip(keys, entries, strict=True) if e is None]
        if missing:
            raise SystemExit(f"unknown catalogue key(s): {', '.join(missing)}")
        return [e for e in entries if e is not None]

    entries, _ = catalog.search(
        prefecture=args.prefecture,
        adapter="athome_municipal" if args.structured_only else None,
        limit=args.max_sources,
    )
    return [e for e in entries if e.crawlable]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", help="Comma-separated catalogue keys")
    parser.add_argument("--prefecture", help="Take every crawlable source of a prefecture")
    parser.add_argument("--structured-only", action="store_true", default=False)
    parser.add_argument("--max-sources", type=int, default=25)
    parser.add_argument("--limit-per-source", type=int, default=DEFAULT_LIMIT_PER_SOURCE)
    parser.add_argument("--output", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args()

    sources = resolve_sources(args)
    if not sources:
        raise SystemExit("no crawlable source selected — use --sources or --prefecture")

    logger.info("building from %d source(s)", len(sources))
    listings: list[dict] = []
    seen_urls: set[str] = set()
    per_source: list[dict] = []

    for entry in sources:
        logger.info("· %s (%s)", entry.name, entry.url)
        time.sleep(REQUEST_DELAY_SECONDS)
        index_html = fetcher.fetch_html(entry.url)
        if not index_html:
            logger.info("  index unreachable or disallowed — skipped")
            per_source.append({"key": entry.key, "name": entry.name, "listings": 0})
            continue

        urls = discover_detail_urls(index_html, entry.url, args.limit_per_source)
        logger.info("  %d candidate listing(s)", len(urls))
        count = 0
        for url in urls:
            if url in seen_urls:
                continue
            seen_urls.add(url)
            time.sleep(REQUEST_DELAY_SECONDS)
            record = build_listing(url, entry)
            if record is not None:
                listings.append(record)
                count += 1
        logger.info("  → %d listing(s) kept", count)
        per_source.append({"key": entry.key, "name": entry.name, "listings": count})

    args.output.mkdir(parents=True, exist_ok=True)
    (args.output / "listings.json").write_text(
        json.dumps(listings, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    meta = {
        "generated_at": datetime.now(UTC).isoformat(),
        "total": len(listings),
        "sources": per_source,
    }
    (args.output / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    logger.info("wrote %d listing(s) to %s", len(listings), args.output)


if __name__ == "__main__":
    main()
