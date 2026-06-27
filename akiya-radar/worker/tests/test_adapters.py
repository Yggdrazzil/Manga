from decimal import Decimal
from pathlib import Path

import pytest

from worker.adapters import (
    GenericMunicipalAkiyaAdapter,
    LifullAkiyaBankAdapter,
    ManualUrlAdapter,
    TsurugaAkiyaAdapter,
    select_adapter,
)
from worker.runner import process_html, process_many

FIXTURE = (Path(__file__).parent.parent / "fixtures" / "municipal_sample.html").read_text(
    encoding="utf-8"
)


def test_select_adapter_routes_by_domain():
    assert isinstance(
        select_adapter("https://akiya.tsuruga.example.jp/bukken/1"), TsurugaAkiyaAdapter
    )
    assert isinstance(
        select_adapter("https://www.homes.example.co.jp/akiyabank/1"),
        LifullAkiyaBankAdapter,
    )


def test_process_many_isolates_failures():
    # Second item has no usable content but must not crash the batch.
    results = process_many(
        [
            ("https://akiya.tsuruga.example.jp/bukken/0001", FIXTURE),
            ("https://manual.example.org/x", ""),
        ]
    )
    assert len(results) == 2
    assert results[0].price_yen is not None


def test_manual_adapter_is_universal_fallback():
    adapter = select_adapter("https://totally-unknown.example.org/x")
    assert isinstance(adapter, ManualUrlAdapter)
    assert adapter.can_handle("anything")


def test_parse_and_normalize_fixture():
    adapter = GenericMunicipalAkiyaAdapter()
    raw = adapter.parse_detail(FIXTURE)
    assert raw.title and "古民家" in raw.title
    assert raw.raw_fields["price"] == "380万円"

    normalized = adapter.normalize(raw)
    assert normalized.price_yen == Decimal(3_800_000)
    assert normalized.prefecture == "福井県"
    assert normalized.city == "敦賀市"
    assert normalized.land_area_m2 == Decimal("220.5")
    assert normalized.building_area_m2 == Decimal("98.2")
    assert normalized.floor_plan == "5DK"
    assert normalized.build_year == 1973


def test_process_html_pipeline_sets_url():
    result = process_html("https://akiya.tsuruga.example.jp/bukken/0001", FIXTURE)
    assert result.source_url == "https://akiya.tsuruga.example.jp/bukken/0001"
    assert result.price_yen == Decimal(3_800_000)


def test_fetch_detail_not_enabled_in_mvp():
    with pytest.raises(NotImplementedError):
        GenericMunicipalAkiyaAdapter().fetch_detail("https://x.jp")
