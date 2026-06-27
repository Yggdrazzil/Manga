from decimal import Decimal

from worker.dedupe import dedupe_key, is_probable_duplicate
from worker.models import NormalizedListing


def _listing(**kw) -> NormalizedListing:
    base = dict(
        source_url="https://x.jp/1",
        title_original="敦賀 古民家",
        city="敦賀市",
        price_yen=Decimal(3_800_000),
    )
    base.update(kw)
    return NormalizedListing(**base)


def test_same_url_is_duplicate():
    assert is_probable_duplicate(_listing(), _listing(title_original="別タイトル"))


def test_same_content_is_duplicate_across_urls():
    a = _listing(source_url="https://a.jp/1")
    b = _listing(source_url="https://b.jp/9")
    assert dedupe_key(a) == dedupe_key(b)
    assert is_probable_duplicate(a, b)


def test_different_listings_not_duplicate():
    a = _listing(source_url="https://a.jp/1")
    b = _listing(
        source_url="https://b.jp/2",
        title_original="札幌 マンション",
        city="札幌市",
        price_yen=Decimal(20_000_000),
    )
    assert not is_probable_duplicate(a, b)
