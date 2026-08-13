"""Canonical vocabulary and field normalisation for heterogeneous sources.

Akiya listings arrive from ~2 000 different sites: a municipal page written by
hand, an At Home template, a PDF-ish table. Every one of them labels the same
fact differently (価格 / 販売価格 / 譲渡価格, 土地面積 / 敷地面積 / 地積…) and
types it differently ("2,250万円", "応相談", "150万").

This module is the single place where that mess becomes one predictable shape,
so the UI can render every listing with the same components and the score can
compare like with like. Three guarantees:

- **Canonical values.** ``property_type`` and ``transaction_type`` come from a
  closed vocabulary, never raw Japanese.
- **Provenance.** Every normalised field records the original label and text it
  came from, so nothing is silently invented (règle : conserver le texte source).
- **Completeness.** A 0-100 score of how much of the comparable core is known,
  letting the UI say "fiche incomplète" instead of showing convincing blanks.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from decimal import Decimal

from app.services.parsing import (
    parse_area_m2,
    parse_build_year,
    parse_floor_plan,
    parse_price_yen,
)

# --- canonical vocabularies -------------------------------------------------

PROPERTY_TYPES = ("kominka", "machiya", "house", "apartment", "land", "other")
TRANSACTION_TYPES = ("sale", "rent", "unknown")

# Checked in order — the most specific label wins (古民家 before 戸建).
_PROPERTY_PATTERNS: tuple[tuple[str, str], ...] = (
    ("古民家", "kominka"),
    ("古家", "kominka"),
    ("町家", "machiya"),
    ("町屋", "machiya"),
    ("戸建", "house"),
    ("一戸建", "house"),
    ("住宅", "house"),
    ("家屋", "house"),
    ("マンション", "apartment"),
    ("アパート", "apartment"),
    ("共同住宅", "apartment"),
    ("土地", "land"),
    ("宅地", "land"),
    ("農地", "land"),
)

_RENT_PATTERNS = ("貸", "賃貸", "賃料", "家賃")
_SALE_PATTERNS = ("売", "販売", "分譲", "譲渡")

# Raw labels → canonical field name. Longest match wins, so 建物面積 is not
# swallowed by 面積.
LABEL_MAP: dict[str, str] = {
    # price
    "価格": "price",
    "販売価格": "price",
    "売買価格": "price",
    "譲渡価格": "price",
    "希望価格": "price",
    "物件価格": "price",
    "賃料": "rent",
    "家賃": "rent",
    # address
    "所在地": "address",
    "住所": "address",
    "物件所在地": "address",
    "所在": "address",
    # areas
    "土地面積": "land_area",
    "敷地面積": "land_area",
    "地積": "land_area",
    "建物面積": "building_area",
    "延床面積": "building_area",
    "延べ床面積": "building_area",
    "床面積": "building_area",
    "専有面積": "building_area",
    # structure
    "間取り": "floor_plan",
    "間取": "floor_plan",
    "築年": "build_year",
    "築年月": "build_year",
    "建築年": "build_year",
    "建築年月": "build_year",
    "構造": "structure",
    "物件種目": "property_kind",
    "種別": "property_kind",
    "物件種別": "property_kind",
    # context
    "交通": "transport",
    "最寄駅": "transport",
    "用途地域": "zoning",
    "建ぺい率": "building_coverage",
    "容積率": "floor_area_ratio",
    "駐車場": "parking",
    "設備": "utilities",
    "現況": "current_state",
    "土地権利": "land_rights",
    "権利形態": "land_rights",
    "情報公開日": "published_at",
    "登録日": "published_at",
    "備考": "remarks",
    "こだわり条件": "features",
    "建物名": "building_name",
    "建物名・部屋番号": "building_name",
}

# Fields that make a listing comparable, and how much each is worth (total 100).
_COMPLETENESS_WEIGHTS: dict[str, int] = {
    "price_yen": 22,
    "address_text": 14,
    "land_area_m2": 12,
    "building_area_m2": 12,
    "build_year": 12,
    "floor_plan": 8,
    "property_type": 6,
    "photo_urls": 8,
    "description_original": 6,
}


@dataclass
class NormalizedListing:
    """Typed, canonical fields plus where each one came from."""

    fields: dict = field(default_factory=dict)
    provenance: dict[str, dict[str, str]] = field(default_factory=dict)
    raw_fields: dict[str, str] = field(default_factory=dict)

    def record(self, name: str, value, label: str, raw_text: str) -> None:
        if value is None or value == "" or value == []:
            return
        self.fields[name] = value
        self.provenance[name] = {"label": label, "text": raw_text[:200]}


def _nfkc(text: str) -> str:
    return unicodedata.normalize("NFKC", text or "").strip()


def canonical_label(label: str) -> str | None:
    """Map a raw Japanese label to a canonical key (longest match wins)."""
    clean = _nfkc(label).replace(" ", "").replace("　", "")
    if not clean:
        return None
    if clean in LABEL_MAP:
        return LABEL_MAP[clean]
    best: tuple[int, str] | None = None
    for japanese, canonical in LABEL_MAP.items():
        if japanese in clean and (best is None or len(japanese) > best[0]):
            best = (len(japanese), canonical)
    return best[1] if best else None


def classify_property_type(*texts: str | None) -> str | None:
    """Canonical property type from any mix of source labels/titles."""
    blob = _nfkc(" ".join(t for t in texts if t))
    if not blob:
        return None
    for japanese, canonical in _PROPERTY_PATTERNS:
        if japanese in blob:
            return canonical
    return None


def classify_transaction_type(*texts: str | None) -> str:
    """``sale`` / ``rent`` / ``unknown`` from the source's own wording."""
    blob = _nfkc(" ".join(t for t in texts if t))
    if not blob:
        return "unknown"
    # 売 appears inside 売買 and 販売; 貸 inside 貸家 and 賃貸. Rent markers are
    # checked first because "貸戸建住宅" also contains 住宅 but never means sale.
    if any(p in blob for p in _RENT_PATTERNS):
        return "rent"
    if any(p in blob for p in _SALE_PATTERNS):
        return "sale"
    return "unknown"


_STATION_RE = re.compile(
    r"(?P<line>[^\s/／]*?線)?\s*(?P<station>[^\s/／]{1,12}駅)\s*[/／]?\s*"
    r"(?P<mode>徒歩|車|バス)?\s*(?P<value>[\d.]+)\s*(?P<unit>分|km|m|ｍ)?"
)


@dataclass
class TransportInfo:
    station: str | None = None
    line: str | None = None
    walk_minutes: int | None = None
    distance_km: float | None = None


def parse_transport(text: str | None) -> TransportInfo | None:
    """Parse a 交通 field such as ``ハピラインふくい 森田駅 / 車2km``.

    Returns walking time when the source gives minutes on foot, and a distance
    when it gives kilometres — never both invented from one another.
    """
    if not text:
        return None
    clean = _nfkc(re.sub(r"\s+", " ", text))
    match = _STATION_RE.search(clean)
    if not match:
        station = re.search(r"([^\s/／]{1,12}駅)", clean)
        return TransportInfo(station=station.group(1)) if station else None

    info = TransportInfo(station=match.group("station"), line=match.group("line") or None)
    value, unit, mode = match.group("value"), match.group("unit"), match.group("mode")
    if value:
        try:
            number = float(value)
        except ValueError:
            return info
        if unit == "分" and mode == "徒歩":
            info.walk_minutes = int(number)
        elif unit == "km":
            info.distance_km = number
        elif unit in ("m", "ｍ"):
            info.distance_km = number / 1000
    return info


def parse_list_field(text: str | None, limit: int = 20) -> list[str]:
    """Split a 設備 / こだわり条件 blob into clean tokens."""
    if not text:
        return []
    clean = _nfkc(re.sub(r"\s+", " ", text))
    if clean in ("-", "—", "なし", ""):
        return []
    # "/" is not a separator here — equipment labels embed it ("B/T別室").
    parts = re.split(r"[・、,\s]+", clean)
    return [p for p in (p.strip() for p in parts) if p and p not in ("-", "—")][:limit]


def parse_published_date(text: str | None) -> str | None:
    """Return an ISO date from ``2025年9月29日`` style text."""
    if not text:
        return None
    match = re.search(r"(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日", _nfkc(text))
    if not match:
        return None
    year, month, day = (int(g) for g in match.groups())
    if not (1900 <= year <= 2100 and 1 <= month <= 12 and 1 <= day <= 31):
        return None
    return f"{year:04d}-{month:02d}-{day:02d}"


def _is_placeholder(text: str) -> bool:
    return _nfkc(text) in ("", "-", "—", "‐", "なし", "不明", "面積不明", "非公開")


def normalize_raw_fields(raw: dict[str, str]) -> NormalizedListing:
    """Turn a source's ``{label: text}`` pairs into canonical typed fields."""
    result = NormalizedListing(raw_fields=dict(raw))
    canonical: dict[str, tuple[str, str]] = {}

    for label, text in raw.items():
        if not text or _is_placeholder(text):
            continue
        key = canonical_label(label)
        if key and key not in canonical:
            canonical[key] = (label, text)

    def take(key: str):
        return canonical.get(key)

    # A monthly rent must never land in ``price_yen``: ¥70 000/month would rank
    # as the cheapest purchase on the board and poison every price comparison.
    sale_price, rent_price = take("price"), take("rent")
    price = sale_price or rent_price
    if price:
        label, text = price
        result.record("price_text_original", _nfkc(text), label, text)
        parsed = parse_price_yen(text)
        if parsed is not None:
            target = "price_yen" if sale_price else "rent_yen_month"
            result.record(target, parsed, label, text)

    if (entry := take("address")) is not None:
        label, text = entry
        cleaned = re.sub(r"\s*周辺情報を調べる\s*$", "", _nfkc(text)).strip()
        result.record("address_text", cleaned, label, text)

    for source_key, target, parser in (
        ("land_area", "land_area_m2", parse_area_m2),
        ("building_area", "building_area_m2", parse_area_m2),
        ("build_year", "build_year", parse_build_year),
        ("floor_plan", "floor_plan", parse_floor_plan),
    ):
        if (entry := take(source_key)) is not None:
            label, text = entry
            parsed = parser(text)
            if parsed is not None:
                result.record(target, parsed, label, text)

    if (entry := take("zoning")) is not None:
        label, text = entry
        result.record("zoning", _nfkc(text), label, text)

    if (entry := take("transport")) is not None:
        label, text = entry
        info = parse_transport(text)
        if info and info.station:
            result.record("station_name", info.station, label, text)
            if info.line:
                result.record("station_line", info.line, label, text)
            if info.walk_minutes is not None:
                result.record("station_walk_minutes", info.walk_minutes, label, text)
            if info.distance_km is not None:
                result.record("station_distance_km", round(info.distance_km, 2), label, text)

    if (entry := take("published_at")) is not None:
        label, text = entry
        if iso := parse_published_date(text):
            result.record("published_at", iso, label, text)

    for source_key, target in (("utilities", "utilities"), ("features", "features")):
        if (entry := take(source_key)) is not None:
            label, text = entry
            tokens = parse_list_field(text)
            if tokens:
                result.record(target, tokens, label, text)

    for source_key, target in (
        ("parking", "parking"),
        ("current_state", "current_state"),
        ("land_rights", "land_rights"),
        ("structure", "structure"),
        ("building_coverage", "building_coverage"),
        ("floor_area_ratio", "floor_area_ratio"),
        ("remarks", "remarks"),
    ):
        if (entry := take(source_key)) is not None:
            label, text = entry
            result.record(target, _nfkc(text)[:400], label, text)

    kind = canonical.get("property_kind")
    kind_text = kind[1] if kind else None
    building_name = canonical.get("building_name")

    property_type = classify_property_type(kind_text, building_name[1] if building_name else None)
    if property_type:
        result.record("property_type", property_type, kind[0] if kind else "種別", kind_text or "")

    transaction = classify_transaction_type(kind_text, price[0] if price else None)
    if transaction != "unknown":
        result.record(
            "transaction_type", transaction, kind[0] if kind else "種別", kind_text or ""
        )

    return result


def completeness_score(values: dict) -> int:
    """0-100 measure of how much of the comparable core a listing actually has."""
    earned = 0
    for name, weight in _COMPLETENESS_WEIGHTS.items():
        value = values.get(name)
        if value is None or value == "" or value == []:
            continue
        if isinstance(value, Decimal) and value <= 0:
            continue
        earned += weight
    return min(100, earned)
