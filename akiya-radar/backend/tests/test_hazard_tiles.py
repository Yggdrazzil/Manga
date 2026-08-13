"""Hazard-map tile sampling: tile maths, legend matching, never-raise contract.

HTTP is mocked. What matters here is that "no zone mapped" (404) stays clearly
distinct from "we could not find out" (network failure) — reporting the second
as the first would tell the user a flood plain is safe.
"""

import io

import httpx
import pytest

from app.services import hazard_tiles

PIL = pytest.importorskip("PIL")


def _png(rgba: tuple[int, int, int, int]) -> bytes:
    from PIL import Image

    image = Image.new("RGBA", (256, 256), rgba)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


class _FakeResponse:
    def __init__(self, content=b"", status_code=200, content_type="application/octet-stream"):
        self.content = content
        self.status_code = status_code
        self.headers = {"content-type": content_type}


def test_tile_maths_matches_web_mercator():
    # Tsuruga, Fukui at z=16 — verified against the portal's own tile URLs.
    x, y, px, py = hazard_tiles.latlon_to_tile_pixel(35.654671, 136.042694, zoom=16)
    assert (x, y) == (57533, 25812)
    assert 0 <= px < 256 and 0 <= py < 256


def test_transparent_pixel_means_no_zone(monkeypatch):
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(_png((0, 0, 0, 0)))
    )
    report = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("flood",))
    assert report.readings[0].risk == "none"


def test_legend_colour_is_classified_with_its_depth(monkeypatch):
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(_png((255, 145, 145, 255)))
    )
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("flood",)).readings[0]
    assert reading.risk == "high"
    assert reading.detail_fr == "5 à 10 m"
    assert reading.rgba == (255, 145, 145, 255)
    assert reading.tile_url and reading.tile_url.endswith(".png")


def test_deep_water_is_the_worst_class(monkeypatch):
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(_png((220, 122, 220, 255)))
    )
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("flood",)).readings[0]
    assert reading.risk == "very_high"


def test_off_legend_colour_is_not_invented(monkeypatch):
    # Base-map greys and label pixels must not be read as a hazard class.
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(_png((12, 200, 40, 255)))
    )
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("flood",)).readings[0]
    assert reading.risk == "none"


def test_missing_tile_means_no_zone(monkeypatch):
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(b"", status_code=404)
    )
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("tsunami",)).readings[0]
    assert reading.risk == "none"


def test_network_failure_is_unknown_not_safe(monkeypatch):
    def boom(*a, **k):
        raise httpx.ConnectError("down")

    monkeypatch.setattr(hazard_tiles.httpx, "get", boom)
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("tsunami",)).readings[0]
    assert reading.risk == "unknown"


def test_undecodable_tile_is_unknown(monkeypatch):
    monkeypatch.setattr(
        hazard_tiles.httpx, "get", lambda *a, **k: _FakeResponse(b"not a png")
    )
    reading = hazard_tiles.fetch_hazard_tiles(35.65, 136.04, layers=("flood",)).readings[0]
    assert reading.risk == "unknown"


def test_worst_picks_the_highest_of_several_layers(monkeypatch):
    responses = iter(
        [
            _FakeResponse(_png((0, 0, 0, 0))),          # debris: none
            _FakeResponse(_png((255, 40, 0, 255))),     # steep: high
            _FakeResponse(b"", status_code=404),        # slide: none
        ]
    )
    monkeypatch.setattr(hazard_tiles.httpx, "get", lambda *a, **k: next(responses))
    report = hazard_tiles.fetch_hazard_tiles(
        33.19, 131.34,
        layers=("landslide_debris", "landslide_steep", "landslide_slide"),
    )
    worst = report.worst("landslide_debris", "landslide_steep", "landslide_slide")
    assert worst.risk == "high"
    assert report.worst("flood") is None


def test_disabled_or_missing_coordinates_returns_none(monkeypatch):
    assert hazard_tiles.fetch_hazard_tiles(None, None) is None
