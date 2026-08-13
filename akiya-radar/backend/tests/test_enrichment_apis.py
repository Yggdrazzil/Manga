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
    monkeypatch.setattr(geocoding, "is_on_land", lambda lat, lon: True)
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
    monkeypatch.setattr(geocoding, "is_on_land", lambda lat, lon: True)
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


# ---- Overpass nearest station ----

OVERPASS_OK = {
    "elements": [
        {"lat": 35.644899, "lon": 136.0554, "tags": {"name": "敦賀", "operator": "JR西日本"}},
        {"lat": 35.618117, "lon": 136.031, "tags": {"name": "西敦賀"}},
    ]
}


def test_nearest_station_picks_closest(monkeypatch):
    from app.services import osm

    monkeypatch.setattr(osm.httpx, "post", lambda *a, **k: _FakeResponse(OVERPASS_OK))
    st = osm.find_nearest_station(35.6547, 136.0427)
    assert st is not None
    assert st.name == "敦賀"
    assert 0 < st.distance_km < 3
    assert st.operator == "JR西日本"


def test_nearest_station_never_raises(monkeypatch):
    from app.services import osm

    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(osm.httpx, "post", boom)
    assert osm.find_nearest_station(35.0, 135.0) is None
    assert osm.find_nearest_station(None, None) is None


# ---- Frankfurter FX ----

def test_frankfurter_live_rate_with_fallback(monkeypatch):
    from decimal import Decimal as D

    import httpx as _httpx

    from app.services import providers

    cls = providers.FrankfurterExchangeRateProvider
    cls._cached_rate, cls._cached_at = None, 0.0
    monkeypatch.setattr(
        _httpx, "get", lambda *a, **k: _FakeResponse({"rates": {"EUR": 0.0054}})
    )
    assert cls().jpy_to_eur(D(1_000_000)) == D("5400.00")

    # Network failure → static fallback rate, never an exception.
    cls._cached_rate, cls._cached_at = None, 0.0

    def boom(*a, **k):
        raise _httpx.ConnectError("down")

    monkeypatch.setattr(_httpx, "get", boom)
    fallback = cls().jpy_to_eur(D(1_000_000))
    assert fallback == D("5500.00")  # 0.0055 static fallback rate


def test_geocode_rejects_water_points(monkeypatch):
    monkeypatch.setattr(geocoding.httpx, "get", lambda *a, **k: _FakeResponse(GSI_OK))
    monkeypatch.setattr(geocoding, "is_on_land", lambda lat, lon: False)
    assert geocoding.geocode("福井県敦賀市櫛川") is None
    monkeypatch.setattr(geocoding, "is_on_land", lambda lat, lon: True)
    assert geocoding.geocode("福井県敦賀市櫛川") is not None
