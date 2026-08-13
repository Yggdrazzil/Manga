"""Bundled catalogue of real akiya-bank sources.

The catalogue is generated from two official directories (see
``scripts/build_source_catalog.py``) and shipped as JSON so the app never
depends on those pages being up at runtime. It covers the 47 prefectures:

- ``athome_municipal`` entries are per-municipality sites hosted by At Home.
  They all render the *same* template, which is what makes reliable structured
  ingestion possible — these are the ones worth enabling first.
- ``generic`` entries are the municipality's own akiya-bank page. Layouts vary
  wildly, so ingestion falls back to the tolerant generic extractor.

Nothing here is crawled automatically: a catalogue entry only becomes a live
source once the user registers it, and crawling stays opt-in per source.
"""

from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[1] / "data" / "source_catalog.json"


@dataclass(frozen=True)
class CatalogEntry:
    key: str
    name: str
    source_type: str
    url: str
    prefecture: str | None
    municipality: str | None
    adapter: str
    crawlable: bool
    muni_code: str | None = None
    notes_fr: str | None = None
    # "national" (whole country) | "prefectural" (one portal, many communes)
    # | "municipal" (a single town)
    scope: str = "municipal"

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "name": self.name,
            "source_type": self.source_type,
            "url": self.url,
            "prefecture": self.prefecture,
            "municipality": self.municipality,
            "adapter": self.adapter,
            "crawlable": self.crawlable,
            "muni_code": self.muni_code,
            "notes_fr": self.notes_fr,
            "scope": self.scope,
        }


def _normalize(text: str) -> str:
    """Fold width/case so a search for 'fukui' or 'ﾌｸｲ' behaves the same."""
    return unicodedata.normalize("NFKC", text).casefold().strip()


@lru_cache(maxsize=1)
def load_catalog() -> tuple[CatalogEntry, ...]:
    if not CATALOG_PATH.exists():
        return ()
    payload = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    entries: list[CatalogEntry] = []

    for raw in payload.get("national", []):
        entries.append(
            CatalogEntry(
                key=raw["key"],
                name=raw.get("name_fr") or raw["name"],
                source_type=raw["source_type"],
                url=raw["url"],
                prefecture=raw.get("prefecture"),
                municipality=raw.get("municipality"),
                adapter=raw.get("adapter", "generic"),
                crawlable=bool(raw.get("crawlable", False)),
                notes_fr=raw.get("notes_fr"),
                scope="national",
            )
        )

    for raw in payload.get("municipal", []):
        entries.append(
            CatalogEntry(
                key=raw["key"],
                name=raw["name"],
                source_type=raw["source_type"],
                url=raw["url"],
                prefecture=raw.get("prefecture"),
                municipality=raw.get("municipality"),
                adapter=raw.get("adapter", "generic"),
                crawlable=bool(raw.get("crawlable", True)),
                muni_code=raw.get("muni_code"),
                scope=raw.get("scope", "municipal"),
            )
        )
    return tuple(entries)


_SCOPE_ORDER = {"national": 0, "prefectural": 1, "municipal": 2}


def search(
    query: str | None = None,
    prefecture: str | None = None,
    adapter: str | None = None,
    limit: int = 60,
    offset: int = 0,
) -> tuple[list[CatalogEntry], int]:
    """Filter the catalogue. Returns ``(page, total_matches)``.

    Entries backed by a structured adapter rank first: they are the ones that
    yield complete, comparable listings rather than a bare URL.
    """
    entries = list(load_catalog())

    if prefecture:
        entries = [e for e in entries if e.prefecture == prefecture]
    if adapter:
        entries = [e for e in entries if e.adapter == adapter]
    if query:
        needle = _normalize(query)
        entries = [
            e
            for e in entries
            if needle in _normalize(
                f"{e.name} {e.municipality or ''} {e.prefecture or ''} {e.url}"
            )
        ]

    # Broadest coverage first (a prefecture portal beats one town), then the
    # sources that yield structured listings.
    entries.sort(
        key=lambda e: (_SCOPE_ORDER.get(e.scope, 3), e.adapter != "athome_municipal")
    )
    return entries[offset : offset + limit], len(entries)


def prefectures() -> list[dict]:
    """Per-prefecture counts, for the catalogue's browse-by-region UI."""
    buckets: dict[str, dict] = {}
    for entry in load_catalog():
        if entry.prefecture is None:
            continue
        bucket = buckets.setdefault(
            entry.prefecture, {"prefecture": entry.prefecture, "total": 0, "structured": 0}
        )
        bucket["total"] += 1
        if entry.adapter == "athome_municipal":
            bucket["structured"] += 1
    return sorted(buckets.values(), key=lambda b: -b["total"])


def get(key: str) -> CatalogEntry | None:
    for entry in load_catalog():
        if entry.key == key:
            return entry
    return None


def adapter_for_url(url: str) -> str:
    """Pick the ingestion adapter for an arbitrary URL.

    Used by the import flow so a hand-pasted At Home URL still benefits from
    the structured parser without the user registering the source first.
    """
    if ".akiya-athome.jp" in (url or ""):
        return "athome_municipal"
    return "generic"
