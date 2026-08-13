"""Normalisation of heterogeneous source fields into one canonical shape."""

from decimal import Decimal

from app.services import normalize


def test_canonical_label_prefers_the_longest_match():
    # 建物面積 must not be swallowed by a shorter 面積-style key.
    assert normalize.canonical_label("建物面積") == "building_area"
    assert normalize.canonical_label("土地面積") == "land_area"
    assert normalize.canonical_label("延床面積") == "building_area"
    assert normalize.canonical_label("　所在地　") == "address"
    assert normalize.canonical_label("まったく未知の項目") is None


def test_rent_never_lands_in_the_sale_price():
    sale = normalize.normalize_raw_fields({"価格": "2,250万円", "物件種目": "売戸建"})
    assert sale.fields["price_yen"] == Decimal(22_500_000)
    assert "rent_yen_month" not in sale.fields
    assert sale.fields["transaction_type"] == "sale"

    rent = normalize.normalize_raw_fields({"賃料": "7 万円", "物件種目": "貸戸建住宅"})
    assert rent.fields["rent_yen_month"] == Decimal(70_000)
    assert "price_yen" not in rent.fields
    assert rent.fields["transaction_type"] == "rent"


def test_property_type_uses_a_closed_vocabulary():
    assert normalize.classify_property_type("古民家再生物件") == "kominka"
    assert normalize.classify_property_type("町家") == "machiya"
    assert normalize.classify_property_type("売戸建") == "house"
    assert normalize.classify_property_type("売土地") == "land"
    assert normalize.classify_property_type("中古マンション") == "apartment"
    assert normalize.classify_property_type("") is None
    for text in ("古民家", "売戸建", "売土地"):
        assert normalize.classify_property_type(text) in normalize.PROPERTY_TYPES


def test_transport_parsing_distinguishes_walking_from_driving():
    walk = normalize.parse_transport("えちぜん鉄道三国線 新田塚駅 / 徒歩13分")
    assert walk.station == "新田塚駅"
    assert walk.line == "えちぜん鉄道三国線"
    assert walk.walk_minutes == 13
    assert walk.distance_km is None

    drive = normalize.parse_transport("ハピラインふくい 森田駅 / 車2km")
    assert drive.station == "森田駅"
    assert drive.distance_km == 2.0
    # A 2 km drive must never be reported as a 2-minute walk.
    assert drive.walk_minutes is None

    assert normalize.parse_transport("バス停まで徒歩5分") is None
    assert normalize.parse_transport(None) is None


def test_placeholder_values_are_not_recorded():
    result = normalize.normalize_raw_fields(
        {"価格": "-", "間取り": "なし", "土地面積": "面積不明", "所在地": "福井県敦賀市櫛川"}
    )
    assert "price_yen" not in result.fields
    assert "floor_plan" not in result.fields
    assert "land_area_m2" not in result.fields
    assert result.fields["address_text"] == "福井県敦賀市櫛川"


def test_every_field_keeps_its_source_label_and_text():
    result = normalize.normalize_raw_fields({"価格": "380万円"})
    assert result.provenance["price_yen"] == {"label": "価格", "text": "380万円"}


def test_list_fields_keep_slashed_labels_intact():
    tokens = normalize.parse_list_field("B/T(バストイレ)別室 ・トイレ ・バス")
    assert "B/T(バストイレ)別室" in tokens
    assert normalize.parse_list_field("-") == []


def test_published_date_is_iso_or_nothing():
    assert normalize.parse_published_date("2025年9月29日") == "2025-09-29"
    assert normalize.parse_published_date("近日公開") is None


def test_completeness_reflects_the_comparable_core():
    assert normalize.completeness_score({}) == 0
    rich = normalize.completeness_score(
        {
            "price_yen": Decimal(3_800_000),
            "address_text": "福井県敦賀市櫛川",
            "land_area_m2": Decimal(220),
            "building_area_m2": Decimal(98),
            "build_year": 1973,
            "floor_plan": "5DK",
            "property_type": "kominka",
            "photo_urls": ["https://example.jp/a.jpg"],
            "description_original": "古民家です。",
        }
    )
    assert rich == 100
    sparse = normalize.completeness_score({"price_yen": Decimal(1_000_000)})
    assert 0 < sparse < 40
