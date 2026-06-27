"""A generic parser for simple municipal akiya-bank detail pages.

Japanese municipal pages commonly present property facts as a label/value table
(``<table><tr><th>所在地</th><td>…</td></tr>``) or a definition list
(``<dl><dt>…</dt><dd>…</dd>``). This adapter extracts those pairs plus a title
and free-text description, then normalizes them with the shared parsers.

It does not fetch over the network in the MVP — feed it fixture HTML.
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

from worker.adapters.base import SourceAdapter
from worker.models import NormalizedListing, RawListing
from worker.parsing import parse_area_m2, parse_build_year, parse_price_yen

# Japanese field labels → our raw_fields keys.
_LABELS = {
    "価格": "price",
    "所在地": "address",
    "土地面積": "land_area",
    "敷地面積": "land_area",
    "建物面積": "building_area",
    "延床面積": "building_area",
    "間取り": "floor_plan",
    "築年": "build_year",
    "築年月": "build_year",
    "建築年": "build_year",
}

_PREF_RE = re.compile(r"(北海道|(?:京都|大阪)府|.{2,3}県|東京都)")


class GenericMunicipalAkiyaAdapter(SourceAdapter):
    source_name = "generic_municipal"

    def can_handle(self, url: str) -> bool:
        return "akiya" in url or "bukken" in url or "空き家" in url

    def parse_detail(self, html: str) -> RawListing:
        soup = BeautifulSoup(html, "html.parser")
        fields: dict[str, str] = {}

        for row in soup.select("table tr"):
            label_cell = row.find(["th", "td"])
            value_cell = label_cell.find_next_sibling(["td", "th"]) if label_cell else None
            if label_cell and value_cell:
                _store(fields, label_cell.get_text(strip=True), value_cell.get_text(strip=True))

        for dt in soup.select("dl dt"):
            dd = dt.find_next_sibling("dd")
            if dd:
                _store(fields, dt.get_text(strip=True), dd.get_text(strip=True))

        title_el = soup.find(["h1", "h2"])
        desc_el = soup.find(class_=re.compile("desc|comment|備考|note", re.I))

        return RawListing(
            source_url="",
            title=title_el.get_text(strip=True) if title_el else None,
            description=desc_el.get_text(strip=True) if desc_el else None,
            price_text=fields.get("price"),
            address_text=fields.get("address"),
            raw_fields=fields,
            raw_html_excerpt=html[:500],
        )

    def normalize(self, raw: RawListing) -> NormalizedListing:
        f = raw.raw_fields
        address = raw.address_text or ""
        pref_match = _PREF_RE.search(address)
        prefecture = pref_match.group(1) if pref_match else None
        city = None
        if prefecture:
            rest = address[address.find(prefecture) + len(prefecture):]
            city_match = re.match(r"(.+?[市区町村])", rest)
            city = city_match.group(1) if city_match else None

        return NormalizedListing(
            source_url=raw.source_url,
            external_id=raw.external_id,
            title_original=raw.title,
            description_original=raw.description,
            price_yen=parse_price_yen(raw.price_text),
            price_text_original=raw.price_text,
            prefecture=prefecture,
            city=city,
            address_text=raw.address_text,
            land_area_m2=parse_area_m2(f.get("land_area")),
            building_area_m2=parse_area_m2(f.get("building_area")),
            floor_plan=f.get("floor_plan"),
            build_year=parse_build_year(f.get("build_year")),
            raw_json={"adapter": self.source_name, "fields": f},
        )


def _store(fields: dict[str, str], label: str, value: str) -> None:
    for jp, key in _LABELS.items():
        if jp in label and key not in fields:
            fields[key] = value
            return
