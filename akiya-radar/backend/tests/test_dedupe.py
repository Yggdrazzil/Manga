from decimal import Decimal

from app.services import dedupe


def test_exact_url_match():
    cand = {"source_url": "https://x.jp/1", "city": "敦賀市"}
    existing = [{"id": "a", "source_url": "https://x.jp/1"}]
    matches = dedupe.find_duplicates(cand, existing)
    assert len(matches) == 1
    assert matches[0].confidence == "exact"
    assert matches[0].reason == "URL identique"


def test_external_id_match():
    cand = {"source_url": "https://x.jp/2", "external_id": "ABC"}
    existing = [{"id": "b", "source_url": "https://y.jp/9", "external_id": "ABC"}]
    matches = dedupe.find_duplicates(cand, existing)
    assert matches and matches[0].confidence == "exact"


def test_content_hash_match():
    cand = {
        "source_url": "https://x.jp/3",
        "title_original": "敦賀 古民家",
        "city": "敦賀市",
        "price_yen": Decimal(3_800_000),
    }
    existing = [
        {
            "id": "c",
            "source_url": "https://other.jp/3",
            "title_original": "敦賀 古民家",
            "city": "敦賀市",
            "price_yen": Decimal(3_800_000),
        }
    ]
    matches = dedupe.find_duplicates(cand, existing)
    assert matches and matches[0].confidence == "high"


def test_geo_proximity_is_possible_not_certain():
    cand = {"source_url": "https://x.jp/4", "lat": 35.6536, "lon": 136.0758}
    existing = [
        {
            "id": "d",
            "source_url": "https://other.jp/4",
            "lat": 35.65361,
            "lon": 136.07581,
        }
    ]
    matches = dedupe.find_duplicates(cand, existing)
    assert matches and matches[0].confidence == "possible"


def test_no_false_positive_on_different_listings():
    cand = {
        "source_url": "https://x.jp/5",
        "title_original": "敦賀 古民家",
        "city": "敦賀市",
        "price_yen": Decimal(3_800_000),
    }
    existing = [
        {
            "id": "e",
            "source_url": "https://other.jp/5",
            "title_original": "札幌 マンション",
            "city": "札幌市",
            "price_yen": Decimal(20_000_000),
        }
    ]
    assert dedupe.find_duplicates(cand, existing) == []


def test_haversine_distance():
    d = dedupe.haversine_m(35.0, 135.0, 35.0, 135.0)
    assert d == 0
    d2 = dedupe.haversine_m(35.0, 135.0, 35.001, 135.0)
    assert 100 < d2 < 120
