"""Unit tests for the public-data API clients (GSI, J-SHIS, MLIT).

HTTP is mocked — these verify parsing, accuracy inference, labelling and the
never-raise contract, not the live services.
"""

from decimal import Decimal

import httpx

from app.services import geocoding, hazard, mlit


class _FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise httpx.HTTPStatusError("boom", request=None, response=None)

    def json(self):
        return self._payload


# ---- GSI geocoding ----

GSI_OK = [
    {
        "geometry": {"coordinates": [136.0758, 35.6536], "type": "Point"},
        "type": "Feature",
        "properties": {"addressCode": "", "title": "福井県敦賀市櫛川"},
    }
]


def test_geocode_parses_coordinates(monkeypatch):
    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: _FakeResponse(GSI_OK))
    result = geocoding.geocode("福井県敦賀市櫛川")
    assert result is not None
    assert result.lat == Decimal("35.6536")
    assert result.lon == Decimal("136.0758")
    assert result.accuracy in ("approximate", "exact")


def test_geocode_city_only_match_flagged(monkeypatch):
    payload = [
        {
            "geometry": {"coordinates": [136.05, 35.64], "type": "Point"},
            "properties": {"title": "敦賀市"},
        }
    ]
    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: _FakeResponse(payload))
    result = geocoding.geocode("福井県敦賀市相生町12-34 何とかビル")
    assert result is not None
    assert result.accuracy == "city"


def test_geocode_never_raises(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(geocoding.httpx, "get", boom)
    assert geocoding.geocode("東京都") is None
    assert geocoding.geocode("") is None
    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: _FakeResponse([]))
    assert geocoding.geocode("存在しない住所") is None


# ---- J-SHIS hazard ----

JSHIS_OK = {
    "features": [
        {"properties": {"T30_I50_PS": "0.42", "T30_I60_PS": "0.08", "CODE": "53394506"}}
    ]
}


def test_hazard_high_label(monkeypatch):
    monkeypatch.setattr(hazard.httpx, "get", lambda *a, **k: _FakeResponse(JSHIS_OK))
    result = hazard.fetch_seismic_hazard(35.65, 136.07)
    assert result is not None
    assert result.prob_shindo5_upper_30y == 0.42
    assert result.risk_label == "high"
    assert "J-SHIS" in result.source_name


def test_hazard_labels_thresholds():
    assert hazard._label(0.30) == "high"
    assert hazard._label(0.10) == "medium"
    assert hazard._label(0.01) == "low"
    assert hazard._label(None) == "unknown"


def test_hazard_never_raises(monkeypatch):
    def boom(*a, **k):
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr(hazard.httpx, "get", boom)
    assert hazard.fetch_seismic_hazard(35.0, 135.0) is None
    assert hazard.fetch_seismic_hazard(None, 135.0) is None


# ---- MLIT comps ----

MLIT_OK = {
    "data": [
        {
            "TradePrice": "4500000",
            "Area": "220",
            "UnitPrice": "20454",
            "BuildingYear": "昭和50年",
            "Prefecture": "福井県",
            "Municipality": "敦賀市",
            "DistrictName": "櫛川",
            "Type": "宅地(土地と建物)",
        },
        {
            "TradePrice": "8000000",
            "Area": "150",
            "UnitPrice": "53333",
            "BuildingYear": "平成5年",
            "Prefecture": "福井県",
            "Municipality": "福井市",
            "DistrictName": "中央",
            "Type": "宅地(土地と建物)",
        },
    ]
}


def test_mlit_unconfigured_reports_unavailable():
    result = mlit.fetch_comps("福井県")
    assert result.available is False
    assert "MLIT_API_KEY" in result.reason


def test_mlit_fetch_and_city_filter(monkeypatch):
    monkeypatch.setattr(
        mlit, "get_settings", lambda: type("S", (), {"mlit_api_key": "k", "user_agent": "ua"})()
    )
    monkeypatch.setattr(mlit.httpx, "get", lambda *a, **k: _FakeResponse(MLIT_OK))
    result = mlit.fetch_comps("福井県", city_name="敦賀市")
    assert result.available is True
    assert result.sample_size == 1
    assert result.comps[0].municipality == "敦賀市"
    assert result.comps[0].trade_price_yen == Decimal("4500000")
    assert result.median_unit_price == Decimal("20454")


def test_mlit_unknown_prefecture(monkeypatch):
    monkeypatch.setattr(
        mlit, "get_settings", lambda: type("S", (), {"mlit_api_key": "k", "user_agent": "ua"})()
    )
    result = mlit.fetch_comps("Bretagne")
    assert result.available is False
