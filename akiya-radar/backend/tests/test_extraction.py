from decimal import Decimal

from app.services.extraction import extract_listing_fields

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
