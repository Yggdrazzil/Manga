"""Parsing helpers for the worker (mirrors the backend's pure parsers).

Kept as a small standalone copy so the worker container has no dependency on the
backend package. Behaviour is intentionally identical and covered by tests.
"""

from __future__ import annotations

import re
from decimal import Decimal

TSUBO_TO_M2 = Decimal("3.305785")
_FW = str.maketrans("０１２３４５６７８９．，", "0123456789.,")
_ERA_START = {"明治": 1868, "大正": 1912, "昭和": 1926, "平成": 1989, "令和": 2019}


def _norm(text: str) -> str:
    return text.translate(_FW)


def parse_price_yen(text: str | None) -> Decimal | None:
    if not text:
        return None
    s = _norm(text).strip()
    if any(t in s for t in ("応相談", "要相談", "お問い合わせ", "問合せ")):
        return None
    oku = re.search(r"([\d,]+(?:\.\d+)?)\s*億", s)
    man = re.search(r"([\d,]+(?:\.\d+)?)\s*万", s)
    total = Decimal(0)
    matched = False
    if oku:
        total += Decimal(oku.group(1).replace(",", "")) * Decimal(100_000_000)
        matched = True
    if man:
        total += Decimal(man.group(1).replace(",", "")) * Decimal(10_000)
        matched = True
    if matched:
        return total
    yen = re.search(r"([\d,]+)\s*円", s)
    if yen:
        return Decimal(yen.group(1).replace(",", ""))
    if re.fullmatch(r"[\d,]+", s):
        return Decimal(s.replace(",", ""))
    return None


def parse_area_m2(text: str | None) -> Decimal | None:
    if not text:
        return None
    s = _norm(text).strip()
    tsubo = re.search(r"([\d,]+(?:\.\d+)?)\s*坪", s)
    if tsubo:
        return (Decimal(tsubo.group(1).replace(",", "")) * TSUBO_TO_M2).quantize(Decimal("0.01"))
    m2 = re.search(r"([\d,]+(?:\.\d+)?)\s*(?:㎡|m²|m2|平米|平方メートル)", s)
    if m2:
        return Decimal(m2.group(1).replace(",", ""))
    if re.fullmatch(r"[\d,]+(?:\.\d+)?", s):
        return Decimal(s.replace(",", ""))
    return None


def parse_build_year(text: str | None) -> int | None:
    if not text:
        return None
    s = _norm(text)
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
