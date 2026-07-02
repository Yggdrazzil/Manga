"""Generic extraction of listing fields from fetched HTML.

Japanese akiya/agency pages commonly expose facts as label/value tables
(``<table><tr><th>価格</th><td>…</td></tr>``) or definition lists. This parser
pulls those pairs plus a title and free-text description, then types them with
the shared parsers. It is deliberately tolerant: unknown layouts yield an empty
dict and the import simply keeps its editable stub.
"""

from __future__ import annotations

import re
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from app.services.parsing import (
    parse_area_m2,
    parse_build_year,
    parse_floor_plan,
    parse_price_yen,
)

_LABELS = {
    "価格": "price",
    "所在地": "address",
    "住所": "address",
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


def _store(fields: dict[str, str], label: str, value: str) -> None:
    for jp, key in _LABELS.items():
        if jp in label and key not in fields:
            fields[key] = value
            return


def _split_address(address: str) -> tuple[str | None, str | None]:
    pref_match = _PREF_RE.search(address)
    if not pref_match:
        return None, None
    prefecture = pref_match.group(1)
    rest = address[address.find(prefecture) + len(prefecture):]
    city_match = re.match(r"(.+?[市区町村])", rest)
    city = city_match.group(1) if city_match else None
    return prefecture, city


# Filename fragments that are almost never property photos.
_PHOTO_EXCLUDE = re.compile(r"logo|icon|banner|btn|button|spacer|arrow|bullet|header|footer", re.I)
_PHOTO_EXT = re.compile(r"\.(jpe?g|png|webp)(\?|$)", re.I)
MAX_PHOTOS = 10


def extract_photos(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Collect likely property-photo URLs (og:image first, then content <img>)."""
    urls: list[str] = []
    seen: set[str] = set()

    def add(src: str | None) -> None:
        if not src or src.startswith("data:") or len(urls) >= MAX_PHOTOS:
            return
        absolute = urljoin(base_url, src.strip())
        parts = urlsplit(absolute)
        if parts.scheme not in ("http", "https"):
            return
        if not _PHOTO_EXT.search(absolute) or _PHOTO_EXCLUDE.search(absolute):
            return
        if absolute not in seen:
            seen.add(absolute)
            urls.append(absolute)

    for meta in soup.select('meta[property="og:image"], meta[name="og:image"]'):
        add(meta.get("content"))
    for img in soup.find_all("img"):
        add(img.get("src") or img.get("data-src"))
    return urls


def extract_listing_fields(html: str, base_url: str = "") -> dict:
    """Return a dict of typed listing fields extracted from ``html``.

    Only keys with a confidently-parsed value are included, so callers can
    merge them without clobbering existing data.
    """
    if not html:
        return {}
    soup = BeautifulSoup(html, "html.parser")
    raw: dict[str, str] = {}

    for row in soup.select("table tr"):
        label_cell = row.find(["th", "td"])
        value_cell = label_cell.find_next_sibling(["td", "th"]) if label_cell else None
        if label_cell and value_cell:
            _store(raw, label_cell.get_text(strip=True), value_cell.get_text(strip=True))

    for dt in soup.select("dl dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            _store(raw, dt.get_text(strip=True), dd.get_text(strip=True))

    title_el = soup.find(["h1", "h2"]) or soup.find("title")
    desc_el = soup.find(class_=re.compile("desc|comment|note|備考", re.I))

    result: dict = {}
    if title_el:
        result["title_original"] = title_el.get_text(strip=True)
    if desc_el:
        result["description_original"] = desc_el.get_text(" ", strip=True)

    if raw.get("price"):
        result["price_text_original"] = raw["price"]
        price = parse_price_yen(raw["price"])
        if price is not None:
            result["price_yen"] = price
    if raw.get("address"):
        result["address_text"] = raw["address"]
        prefecture, city = _split_address(raw["address"])
        if prefecture:
            result["prefecture"] = prefecture
        if city:
            result["city"] = city
    if raw.get("land_area"):
        area = parse_area_m2(raw["land_area"])
        if area is not None:
            result["land_area_m2"] = area
    if raw.get("building_area"):
        area = parse_area_m2(raw["building_area"])
        if area is not None:
            result["building_area_m2"] = area
    if raw.get("floor_plan"):
        plan = parse_floor_plan(raw["floor_plan"]) or raw["floor_plan"]
        result["floor_plan"] = plan
    if raw.get("build_year"):
        year = parse_build_year(raw["build_year"])
        if year is not None:
            result["build_year"] = year

    photos = extract_photos(soup, base_url)
    if photos:
        result["photo_urls"] = photos

    result["_raw_fields"] = raw
    return result
