"""Turn a fetched listing page into canonical, comparable fields.

The pipeline is the same for every source, which is what keeps ~2 000 wildly
different sites renderable by one set of UI components:

1. **Harvest** raw ``{label: value}`` pairs plus title/description/photos. This
   is layout-driven (tables, definition lists) and deliberately tolerant.
2. **Normalise** those pairs into canonical typed fields via
   :mod:`app.services.normalize` — closed vocabularies, real ``Decimal``
   prices, provenance for every field.
3. **Score completeness** so the UI can distinguish "cheap" from "we barely
   know anything about this one".

Source-specific quirks live in small adapters rather than in the shared path:
an unknown layout still yields whatever the generic pass could find, never an
exception (règle : un import ne doit jamais échouer complètement).
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup

from app.services.normalize import (
    NormalizedListing,
    classify_property_type,
    classify_transaction_type,
    completeness_score,
    normalize_raw_fields,
)

MAX_PHOTOS = 12

# Filename fragments that are almost never property photos.
_PHOTO_EXCLUDE = re.compile(
    r"logo|icon|banner|btn|button|spacer|arrow|bullet|header|footer|sprite|blank|noimage",
    re.I,
)
_PHOTO_EXT = re.compile(r"\.(jpe?g|png|webp|avif)(\?|$)", re.I)
# Dedicated image hosts serve extension-less URLs (At Home's img.akiya-athome.jp
# uses an opaque ``?v=`` token). Rejecting those cost us every photo on the
# largest structured source, so the host itself is treated as the signal.
_PHOTO_HOST = re.compile(r"^(img|imgs|image|images|photo|photos|media|cdn|static)\d*\.", re.I)

_TITLE_NOISE = re.compile(r"\s*[-|｜]\s*(物件詳細|トップページ).*$")


@dataclass
class ExtractionResult:
    """Canonical fields plus everything needed to explain where they came from."""

    fields: dict = field(default_factory=dict)
    provenance: dict[str, dict[str, str]] = field(default_factory=dict)
    raw_fields: dict[str, str] = field(default_factory=dict)
    completeness: int = 0
    adapter: str = "generic"

    def get(self, key: str, default=None):
        return self.fields.get(key, default)


def _clean_text(node) -> str:
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def harvest_pairs(soup: BeautifulSoup) -> dict[str, str]:
    """Collect ``{label: value}`` from tables and definition lists.

    Later occurrences never overwrite earlier ones: listing pages usually put
    the summary table first and repeat fields in a denser spec table below.
    """
    pairs: dict[str, str] = {}

    for row in soup.select("table tr"):
        cells = row.find_all(["th", "td"])
        # Walk cells pairwise so 4-column spec tables (label|value|label|value)
        # yield both pairs instead of only the first.
        for index in range(0, len(cells) - 1, 2):
            label = _clean_text(cells[index])
            value = _clean_text(cells[index + 1])
            if label and value and label not in pairs:
                pairs[label] = value

    for dt in soup.select("dl dt"):
        dd = dt.find_next_sibling("dd")
        if dd:
            label, value = _clean_text(dt), _clean_text(dd)
            if label and value and label not in pairs:
                pairs[label] = value

    pairs.update(_harvest_div_pairs(soup, pairs))
    return pairs


# Class names that mark the label half of a label/value pair. Single-page apps
# rarely emit tables — they emit two <div>s or <span>s side by side — so a
# table-only harvester finds nothing on a rendered page.
_LABEL_CLASS = re.compile(r"(^|[-_ ])(label|term|key|head|title|name|dt)([-_ ]|$)", re.I)
_VALUE_CLASS = re.compile(r"(^|[-_ ])(value|data|desc|detail|content|body|dd)([-_ ]|$)", re.I)


def _harvest_div_pairs(soup: BeautifulSoup, existing: dict[str, str]) -> dict[str, str]:
    """Collect label/value pairs expressed as adjacent elements."""
    found: dict[str, str] = {}
    for node in soup.find_all(class_=_LABEL_CLASS):
        if node.name in ("th", "dt"):
            continue  # already harvested with better structure
        label = _clean_text(node)
        # Only Japanese field labels are of interest, and they are short.
        if not label or len(label) > 16 or not re.search(r"[ぁ-んァ-ヶ一-龠]", label):
            continue
        if label in existing or label in found:
            continue
        sibling = node.find_next_sibling()
        if sibling is None:
            continue
        classes = " ".join(sibling.get("class") or [])
        if classes and not _VALUE_CLASS.search(classes) and sibling.name not in ("dd", "td"):
            continue
        value = _clean_text(sibling)
        if value and len(value) < 500:
            found[label] = value
    return found


def extract_json_ld(soup: BeautifulSoup) -> dict[str, str]:
    """Pull listing facts out of schema.org JSON-LD blocks.

    Property sites that render client-side very often still emit JSON-LD for
    search engines, which is cleaner and more reliable than their DOM.
    """
    pairs: dict[str, str] = {}

    def absorb(node) -> None:
        if isinstance(node, list):
            for item in node:
                absorb(item)
            return
        if not isinstance(node, dict):
            return
        for key, japanese in (
            ("name", "建物名"),
            ("description", "備考"),
        ):
            value = node.get(key)
            if isinstance(value, str) and value.strip() and japanese not in pairs:
                pairs[japanese] = value.strip()

        offers = node.get("offers")
        if isinstance(offers, dict):
            price = offers.get("price")
            currency = offers.get("priceCurrency", "JPY")
            if price not in (None, "") and currency in ("JPY", "¥") and "価格" not in pairs:
                pairs["価格"] = f"{price}円"

        address = node.get("address")
        if isinstance(address, dict) and "所在地" not in pairs:
            parts = [
                address.get(k)
                for k in ("addressRegion", "addressLocality", "streetAddress")
                if isinstance(address.get(k), str)
            ]
            if parts:
                pairs["所在地"] = "".join(parts)
        elif isinstance(address, str) and "所在地" not in pairs:
            pairs["所在地"] = address

        size = node.get("floorSize")
        if isinstance(size, dict) and "建物面積" not in pairs:
            value = size.get("value")
            if value not in (None, ""):
                pairs["建物面積"] = f"{value}㎡"

        for key, japanese in (("numberOfRooms", "間取り"), ("yearBuilt", "築年")):
            value = node.get(key)
            if value not in (None, "") and japanese not in pairs:
                pairs[japanese] = str(value)

        for nested in ("mainEntity", "itemOffered", "@graph"):
            if nested in node:
                absorb(node[nested])

    for script in soup.find_all("script", type="application/ld+json"):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            absorb(json.loads(raw))
        except (ValueError, TypeError):
            continue
    return pairs


def extract_photos(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Collect likely property-photo URLs (og:image first, then content images)."""
    urls: list[str] = []
    seen: set[str] = set()

    def add(src: str | None, trusted: bool = False) -> None:
        if not src or len(urls) >= MAX_PHOTOS:
            return
        candidate = src.strip()
        if candidate.startswith("data:"):
            return
        # Protocol-relative sources ("//img.example.jp/x") resolve against the
        # page's scheme; urljoin handles that once the base is absolute.
        absolute = urljoin(base_url or "https://", candidate)
        parts = urlsplit(absolute)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            return
        if _PHOTO_EXCLUDE.search(absolute):
            return
        if not trusted and not _PHOTO_EXT.search(absolute) and not _PHOTO_HOST.search(parts.netloc):
            return
        if absolute not in seen:
            seen.add(absolute)
            urls.append(absolute)

    for meta in soup.select('meta[property="og:image"], meta[name="og:image"]'):
        add(meta.get("content"), trusted=True)
    for img in soup.find_all("img"):
        add(img.get("src") or img.get("data-src") or img.get("data-original"))
    return urls


def _extract_title(soup: BeautifulSoup) -> str | None:
    for selector in ("h1", "h2"):
        node = soup.find(selector)
        if node and _clean_text(node):
            return _clean_text(node)[:300]
    if soup.title and soup.title.get_text(strip=True):
        return _TITLE_NOISE.sub("", _clean_text(soup.title))[:300]
    return None


def _extract_description(soup: BeautifulSoup, pairs: dict[str, str]) -> str | None:
    """Prefer the source's own remarks field, then a description-ish block."""
    for label in ("備考", "物件の特徴", "コメント", "PRポイント", "紹介文"):
        value = pairs.get(label)
        if value and len(value) > 4:
            return value[:4000]
    node = soup.find(class_=re.compile("desc|comment|note|remark|catch|pr-", re.I))
    if node:
        text = _clean_text(node)
        if len(text) > 8:
            return text[:4000]
    meta = soup.select_one('meta[name="description"], meta[property="og:description"]')
    if meta and meta.get("content"):
        return str(meta["content"])[:4000]
    return None


_PREF_RE = re.compile(r"(東京都|北海道|(?:京都|大阪)府|(?:神奈川|和歌山|鹿児島)県|.{2}県)")
# 郡 is a rural county, not a municipality: 島根県隠岐郡隠岐の島町 must resolve to
# 隠岐の島町, not 隠岐郡. The county prefix is therefore consumed and discarded.
_CITY_RE = re.compile(r"^(?:.{1,6}郡)?(.{1,8}?[市区町村])")


def split_address(address: str) -> tuple[str | None, str | None]:
    """Split a Japanese address into ``(prefecture, municipality)``."""
    if not address:
        return None, None
    pref_match = _PREF_RE.search(address)
    if not pref_match:
        return None, None
    prefecture = pref_match.group(1)
    rest = address[pref_match.end() :]
    city_match = _CITY_RE.match(rest.strip())
    return prefecture, city_match.group(1) if city_match else None


# --- source adapters --------------------------------------------------------


# The At Home template ships its gallery as a JS array literal rather than
# <img> tags — the only <img> elements on the page are municipal banners, so
# scraping the DOM yields a town logo where the house should be.
_ATHOME_GALLERY_RE = re.compile(
    r"image_tile_carousel_image_s\s*=\s*(\[.*?\])\s*;", re.S
)
# Floor plans are genuinely useful but must not become the cover photo.
_ATHOME_PLAN_HINT = re.compile(r"間取|平面図")


def _athome_gallery(html: str, base_url: str) -> list[str]:
    """Pull full-size photo URLs out of the At Home carousel payload."""
    match = _ATHOME_GALLERY_RE.search(html)
    if not match:
        return []
    try:
        items = json.loads(match.group(1))
    except (ValueError, TypeError):
        return []

    photos: list[tuple[int, str]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        url = item.get("image_url_fullsize") or item.get("image_url_thumbnail")
        if not url:
            continue
        absolute = urljoin(base_url or "https://", str(url))
        if not absolute.startswith(("http://", "https://")):
            continue
        rank = 1 if _ATHOME_PLAN_HINT.search(str(item.get("title", ""))) else 0
        photos.append((rank, absolute))

    photos.sort(key=lambda p: p[0])
    seen: set[str] = set()
    ordered: list[str] = []
    for _, url in photos:
        if url not in seen:
            seen.add(url)
            ordered.append(url)
    return ordered[:MAX_PHOTOS]


def _athome_adapter(
    soup: BeautifulSoup, html: str, base_url: str, result: NormalizedListing
) -> None:
    """At Home municipal template (``*.akiya-athome.jp``).

    Identical across the 842 municipalities it hosts, so its quirks are worth
    handling precisely: the gallery lives in JavaScript, the building name
    carries the source's own reference, and 現況「空」 confirms the property is
    genuinely vacant rather than merely listed.
    """
    gallery = _athome_gallery(html, base_url)
    if gallery:
        result.fields["photo_urls"] = gallery
        result.provenance["photo_urls"] = {
            "label": "galerie",
            "text": f"{len(gallery)} image(s) (carrousel At Home)",
        }
    else:
        # Only banners were found — better no photo than a town logo.
        result.fields.pop("photo_urls", None)
        result.provenance.pop("photo_urls", None)

    raw = result.raw_fields
    building_name = raw.get("建物名") or raw.get("建物名・部屋番号")
    if building_name:
        reference = re.search(r"[（(]([0-9A-Za-z\-]{4,})[)）]", building_name)
        if reference:
            result.record("external_id", reference.group(1), "建物名", building_name)

    state = raw.get("現況")
    if state and "空" in state:
        result.fields.setdefault("listing_status", "active")


ADAPTERS = {"athome_municipal": _athome_adapter}


def detect_adapter(url: str) -> str:
    if ".akiya-athome.jp" in (url or ""):
        return "athome_municipal"
    return "generic"


# --- public entry point -----------------------------------------------------


def extract_listing(html: str, base_url: str = "", adapter: str | None = None) -> ExtractionResult:
    """Full harvest → normalise → score pipeline for one listing page."""
    if not html:
        return ExtractionResult()

    adapter = adapter or detect_adapter(base_url)
    soup = BeautifulSoup(html, "html.parser")
    pairs = harvest_pairs(soup)
    # The page's own markup wins; JSON-LD fills what it did not express.
    for label, value in extract_json_ld(soup).items():
        pairs.setdefault(label, value)

    normalized = normalize_raw_fields(pairs)

    title = _extract_title(soup)
    if title:
        normalized.record("title_original", title, "title", title)
    description = _extract_description(soup, pairs)
    if description:
        normalized.record("description_original", description, "備考", description)

    photos = extract_photos(soup, base_url)
    if photos:
        normalized.record("photo_urls", photos, "img", f"{len(photos)} image(s)")

    if hook := ADAPTERS.get(adapter):
        hook(soup, html, base_url, normalized)

    # Prefecture/city are derived, not read: the address is the single source of
    # truth so a mislabelled column can't put a listing in the wrong region.
    address = normalized.fields.get("address_text")
    if address:
        prefecture, city = split_address(address)
        if prefecture:
            normalized.record("prefecture", prefecture, "所在地", address)
        if city:
            normalized.record("city", city, "所在地", address)

    # Fall back to the title when the source has no explicit type column.
    if "property_type" not in normalized.fields:
        inferred = classify_property_type(title, description)
        if inferred:
            normalized.record("property_type", inferred, "titre", title or "")
    if "transaction_type" not in normalized.fields:
        inferred_tx = classify_transaction_type(title, base_url)
        if inferred_tx != "unknown":
            normalized.record("transaction_type", inferred_tx, "titre", title or "")

    return ExtractionResult(
        fields=normalized.fields,
        provenance=normalized.provenance,
        raw_fields=normalized.raw_fields,
        completeness=completeness_score(normalized.fields),
        adapter=adapter,
    )


def extract_listing_fields(html: str, base_url: str = "") -> dict:
    """Backwards-compatible dict view of :func:`extract_listing`."""
    result = extract_listing(html, base_url=base_url)
    if not result.fields and not result.raw_fields:
        return {}
    fields = dict(result.fields)
    fields["_raw_fields"] = result.raw_fields
    return fields
