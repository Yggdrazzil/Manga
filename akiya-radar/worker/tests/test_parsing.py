from decimal import Decimal

import pytest

from worker import parsing


@pytest.mark.parametrize(
    "text,expected",
    [
        ("380万円", Decimal(3_800_000)),
        ("1億2000万円", Decimal(120_000_000)),
        ("500,000円", Decimal(500_000)),
        ("応相談", None),
    ],
)
def test_parse_price(text, expected):
    assert parsing.parse_price_yen(text) == expected


def test_parse_area_tsubo():
    assert parsing.parse_area_m2("30坪") == (Decimal(30) * parsing.TSUBO_TO_M2).quantize(
        Decimal("0.01")
    )


def test_parse_build_year_era():
    assert parsing.parse_build_year("昭和48年") == 1973
    assert parsing.parse_build_year("令和元年") == 2019
