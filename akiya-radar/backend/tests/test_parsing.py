from decimal import Decimal

import pytest

from app.services import parsing


@pytest.mark.parametrize(
    "text,expected",
    [
        ("380万円", Decimal(3_800_000)),
        ("1,250万円", Decimal(12_500_000)),
        ("1億2000万円", Decimal(120_000_000)),
        ("1億円", Decimal(100_000_000)),
        ("500,000円", Decimal(500_000)),
        ("0円（譲渡）", Decimal(0)),
        ("３８０万円", Decimal(3_800_000)),  # full-width digits
    ],
)
def test_parse_price_yen(text, expected):
    assert parsing.parse_price_yen(text) == expected


def test_parse_price_yen_unparseable():
    assert parsing.parse_price_yen("応相談") is None
    assert parsing.parse_price_yen(None) is None
    assert parsing.parse_price_yen("") is None


@pytest.mark.parametrize(
    "text,expected",
    [
        ("220.5㎡", Decimal("220.5")),
        ("100 m²", Decimal("100")),
        ("76平米", Decimal("76")),
    ],
)
def test_parse_area_m2(text, expected):
    assert parsing.parse_area_m2(text) == expected


def test_parse_area_tsubo_converts():
    result = parsing.parse_area_m2("30坪")
    assert result == (Decimal(30) * parsing.TSUBO_TO_M2).quantize(Decimal("0.01"))
    assert Decimal("99") < result < Decimal("100")


@pytest.mark.parametrize(
    "text,expected",
    [
        ("3LDK", "3LDK"),
        ("間取り：2DK", "2DK"),
        ("1K のアパート", "1K"),
        ("広い 5DK です", "5DK"),
    ],
)
def test_parse_floor_plan(text, expected):
    assert parsing.parse_floor_plan(text) == expected


def test_parse_floor_plan_none():
    assert parsing.parse_floor_plan("ワンルーム") is None
    assert parsing.parse_floor_plan(None) is None


@pytest.mark.parametrize(
    "text,expected",
    [
        ("築昭和48年", 1973),
        ("平成10年築", 1998),
        ("令和元年", 2019),
        ("2010年建築", 2010),
        ("昭和元年", 1926),
    ],
)
def test_parse_build_year(text, expected):
    assert parsing.parse_build_year(text) == expected


def test_parse_build_year_none():
    assert parsing.parse_build_year("築年数不明") is None
    assert parsing.parse_build_year(None) is None
