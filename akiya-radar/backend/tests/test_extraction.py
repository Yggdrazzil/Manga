from decimal import Decimal

from app.services.extraction import extract_listing, extract_listing_fields, split_address

HTML = """
<html><body>
  <h1>長野県 飯山市 雪国の古民家 6K</h1>
  <table>
    <tr><th>価格</th><td>250万円</td></tr>
    <tr><th>所在地</th><td>長野県飯山市大字一山</td></tr>
    <tr><th>土地面積</th><td>330㎡</td></tr>
    <tr><th>建物面積</th><td>120㎡</td></tr>
    <tr><th>間取り</th><td>6K</td></tr>
    <tr><th>築年</th><td>昭和40年</td></tr>
  </table>
  <p class="note">傾きが見られます。大規模修繕が必要。</p>
</body></html>
"""


def test_extracts_typed_fields():
    fields = extract_listing_fields(HTML)
    assert fields["title_original"].startswith("長野県")
    assert fields["price_yen"] == Decimal(2_500_000)
    assert fields["price_text_original"] == "250万円"
    assert fields["prefecture"] == "長野県"
    assert fields["city"] == "飯山市"
    assert fields["land_area_m2"] == Decimal("330")
    assert fields["building_area_m2"] == Decimal("120")
    assert fields["floor_plan"] == "6K"
    assert fields["build_year"] == 1965
    assert "大規模修繕" in fields["description_original"]


def test_empty_html_returns_empty():
    assert extract_listing_fields("") == {}


def test_unknown_layout_is_tolerant():
    fields = extract_listing_fields("<html><body><p>hello</p></body></html>")
    # No crash; may contain a title only.
    assert "price_yen" not in fields


def test_dl_layout_supported():
    html = "<dl><dt>価格</dt><dd>1,200万円</dd><dt>間取り</dt><dd>3LDK</dd></dl>"
    fields = extract_listing_fields(html)
    assert fields["price_yen"] == Decimal(12_000_000)
    assert fields["floor_plan"] == "3LDK"


def test_extracts_photos_absolutized_and_filtered():
    html = """
    <html><head><meta property="og:image" content="/photos/main.jpg"></head><body>
      <img src="https://cdn.example.jp/bukken/1.jpg">
      <img src="/img/logo.png">
      <img src="icons/arrow.jpg">
      <img src="data:image/gif;base64,xyz">
      <img data-src="/photos/2.webp">
      <img src="/photos/plan.pdf">
    </body></html>
    """
    fields = extract_listing_fields(html, base_url="https://akiya.example.jp/bukken/9")
    photos = fields["photo_urls"]
    assert photos[0] == "https://akiya.example.jp/photos/main.jpg"
    assert "https://cdn.example.jp/bukken/1.jpg" in photos
    assert "https://akiya.example.jp/photos/2.webp" in photos
    assert all("logo" not in p and "arrow" not in p and "pdf" not in p for p in photos)


def test_no_photos_key_when_none_found():
    fields = extract_listing_fields("<html><body><p>text</p></body></html>", base_url="https://x.jp")
    assert "photo_urls" not in fields


# ---- source-shape handling (the reason listings from ~2 000 sites look alike) ----


def test_county_prefix_is_not_mistaken_for_the_municipality():
    # 島根県隠岐郡隠岐の島町 → the town, never the county (郡).
    assert split_address("島根県隠岐郡隠岐の島町都万") == ("島根県", "隠岐の島町")
    assert split_address("福井県敦賀市櫛川") == ("福井県", "敦賀市")
    assert split_address("東京都八王子市") == ("東京都", "八王子市")
    assert split_address("北海道函館市") == ("北海道", "函館市")
    assert split_address("京都府京都市北区") == ("京都府", "京都市")
    assert split_address("") == (None, None)


def test_extension_less_urls_on_image_hosts_are_kept():
    # At Home serves every photo from img.akiya-athome.jp with an opaque token
    # and no file extension; requiring one dropped 100% of them.
    html = """
    <html><body>
      <img src="//img.akiya-athome.jp/?v=TOKEN123">
      <img src="https://static.example.jp/?v=OTHER">
      <img src="https://www.example.jp/tracking?v=1">
    </body></html>
    """
    fields = extract_listing_fields(html, base_url="https://akiya.example.jp/bukken/9")
    photos = fields["photo_urls"]
    assert "https://img.akiya-athome.jp/?v=TOKEN123" in photos
    assert "https://static.example.jp/?v=OTHER" in photos
    # A non-image host without an extension stays out.
    assert all("tracking" not in p for p in photos)


ATHOME_HTML = """
<html><head>
<title>高木北2丁目（2509-009） - 物件詳細 - 福井県福井市空き家バンクサイト</title>
</head>
<body>
  <a><img src="//img.akiya-athome.jp/?v=BANNER" alt="福井市空き家情報バンク"></a>
  <table>
    <tr><th>物件種目</th><td>売戸建</td></tr>
    <tr><th>価格</th><td>2,250万円</td></tr>
    <tr><th>所在地周辺情報を調べる</th><td>福井県福井市高木北２丁目 周辺情報を調べる</td></tr>
    <tr><th>間取り</th><td>4LDK</td></tr>
    <tr><th>土地面積</th><td>165.29㎡</td></tr>
    <tr><th>築年月</th><td>1989年9月(築36年)</td></tr>
    <tr><th>用途地域</th><td>1種住居</td></tr>
    <tr><th>交通</th><td>ハピラインふくい 森田駅 / 車2km</td></tr>
    <tr><th>建物名</th><td>高木北2丁目（2509-009）</td></tr>
    <tr><th>現況</th><td>空</td></tr>
  </table>
  <script>var image_tile_carousel_image_s = [
    {"image_url_thumbnail":"\\/\\/img.akiya-athome.jp\\/?v=PLANTHUMB","image_url_fullsize":"\\/\\/img.akiya-athome.jp\\/?v=PLAN","title":"\\u9593\\u53d6\\u56f3(\\u5e73\\u9762\\u56f3)"},
    {"image_url_thumbnail":"\\/\\/img.akiya-athome.jp\\/?v=EXTTHUMB","image_url_fullsize":"\\/\\/img.akiya-athome.jp\\/?v=EXTERIOR","title":"\\u5916\\u89b3"}
  ];</script>
</body></html>
"""


def test_athome_template_yields_a_complete_normalized_listing():
    result = extract_listing(
        ATHOME_HTML, base_url="https://fukui-c18201.akiya-athome.jp/bukken/detail/buy/x-42213"
    )
    assert result.adapter == "athome_municipal"
    fields = result.fields
    assert fields["price_yen"] == Decimal(22_500_000)
    assert fields["property_type"] == "house"
    assert fields["transaction_type"] == "sale"
    assert fields["land_area_m2"] == Decimal("165.29")
    assert fields["build_year"] == 1989
    assert fields["floor_plan"] == "4LDK"
    assert fields["zoning"] == "1種住居"
    assert fields["station_name"] == "森田駅"
    assert fields["station_distance_km"] == 2.0
    assert fields["external_id"] == "2509-009"
    # Full-width digits in the address must not defeat geocoding downstream.
    assert fields["address_text"] == "福井県福井市高木北2丁目"
    assert (fields["prefecture"], fields["city"]) == ("福井県", "福井市")
    assert result.completeness >= 70


def test_athome_gallery_replaces_banners_and_puts_photos_before_plans():
    result = extract_listing(
        ATHOME_HTML, base_url="https://fukui-c18201.akiya-athome.jp/bukken/detail/buy/x"
    )
    photos = result.fields["photo_urls"]
    # The municipal banner is the only <img> on the page — it must not become
    # the cover photo, and the exterior shot outranks the floor plan.
    assert all("BANNER" not in p for p in photos)
    assert photos[0].endswith("EXTERIOR")
    assert photos[1].endswith("PLAN")


def test_athome_page_without_a_gallery_shows_no_photo_rather_than_a_logo():
    html = ATHOME_HTML.replace("var image_tile_carousel_image_s", "var unrelated")
    result = extract_listing(html, base_url="https://fukui-c18201.akiya-athome.jp/b/1")
    assert "photo_urls" not in result.fields


def test_every_normalized_field_is_attributable():
    result = extract_listing(ATHOME_HTML, base_url="https://fukui-c18201.akiya-athome.jp/b/1")
    for name in ("price_yen", "land_area_m2", "zoning"):
        assert result.provenance[name]["label"]
        assert result.provenance[name]["text"]


def test_four_column_spec_tables_yield_every_pair():
    html = """
    <table><tr>
      <th>価格</th><td>380万円</td><th>間取り</th><td>5DK</td>
    </tr></table>
    """
    fields = extract_listing_fields(html)
    assert fields["price_yen"] == Decimal(3_800_000)
    assert fields["floor_plan"] == "5DK"
