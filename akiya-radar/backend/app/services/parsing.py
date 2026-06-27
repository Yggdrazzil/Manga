"""Parsing helpers for Japanese real-estate listing text.

Pure functions, no I/O — easy to unit-test against fixtures. Everything is
defensive: unparseable input returns ``None`` rather than raising.
"""

from __future__ import annotations

import re
from decimal import Decimal

TSUBO_TO_M2 = Decimal("3.305785")

_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９．，", "0123456789.,")

# Japanese era → first Gregorian year (year 1 of the era).
_ERA_START = {
    "明治": 1868,
    "大正": 1912,
    "昭和": 1926,
    "平成": 1989,
    "令和": 2019,
}


def _normalize(text: str) -> str:
    return text.translate(_FULLWIDTH_DIGITS)


def parse_price_yen(text: str | None) -> Decimal | None:
    """Parse a Japanese price string into yen.

    Handles 万円 (×10,000), 億円 (×100,000,000), 円, plain numbers and
    thousands separators. Returns ``None`` for "ask/free/-" style values.
    """
    if not text:
        return None
    s = _normalize(text).strip()
    if any(token in s for token in ("応相談", "要相談", "お問い合わせ", "問合せ")):
        return None

    oku_match = re.search(r"([\d,]+(?:\.\d+)?)\s*億", s)
    man_match = re.search(r"([\d,]+(?:\.\d+)?)\s*万", s)

    total = Decimal(0)
    matched = False
    if oku_match:
        total += Decimal(oku_match.group(1).replace(",", "")) * Decimal(100_000_000)
        matched = True
    if man_match:
        total += Decimal(man_match.group(1).replace(",", "")) * Decimal(10_000)
        matched = True
    if matched:
        return total

    yen_match = re.search(r"([\d,]+)\s*円", s)
    if yen_match:
        return Decimal(yen_match.group(1).replace(",", ""))

    plain = re.fullmatch(r"[\d,]+", s)
    if plain:
        return Decimal(s.replace(",", ""))
    return None


def parse_area_m2(text: str | None) -> Decimal | None:
    """Parse an area string into square metres (handles 坪/tsubo and ㎡/m²)."""
    if not text:
        return None
    s = _normalize(text).strip()

    tsubo_match = re.search(r"([\d,]+(?:\.\d+)?)\s*坪", s)
    if tsubo_match:
        tsubo = Decimal(tsubo_match.group(1).replace(",", ""))
        return (tsubo * TSUBO_TO_M2).quantize(Decimal("0.01"))

    m2_match = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:㎡|m²|m2|平米|平方メートル)", s)
    if m2_match:
        return Decimal(m2_match.group(1).replace(",", ""))

    plain = re.fullmatch(r"[\d,]+(?:\.\d+)?", s)
    if plain:
        return Decimal(s.replace(",", ""))
    return None


_FLOOR_PLAN_RE = re.compile(r"\b(\d{1,2})\s*([SLDK]{1,4})\b", re.IGNORECASE)


def parse_floor_plan(text: str | None) -> str | None:
    """Extract a Japanese floor plan code such as ``3LDK`` or ``1K``."""
    if not text:
        return None
    s = _normalize(text).upper()
    match = _FLOOR_PLAN_RE.search(s)
    if not match:
        return None
    rooms, layout = match.group(1), match.group(2)
    # Keep only valid layout letters in canonical order of appearance.
    if not all(c in "SLDK" for c in layout):
        return None
    return f"{rooms}{layout}"


def parse_build_year(text: str | None) -> int | None:
    """Parse a build year from Western (西暦) or Japanese era (和暦) notation."""
    if not text:
        return None
    s = _normalize(text)

    for era, start in _ERA_START.items():
        m = re.search(rf"{era}\s*(元|\d{{1,2}})\s*年", s)
        if m:
            raw = m.group(1)
            year_in_era = 1 if raw == "元" else int(raw)
            return start + year_in_era - 1

    m = re.search(r"(19|20)\d{2}\s*年?", s)
    if m:
        year = int(m.group(0).replace("年", "").strip())
        if 1850 <= year <= 2100:
            return year
    return None
