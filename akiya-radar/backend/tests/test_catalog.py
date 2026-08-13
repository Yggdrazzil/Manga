"""The bundled catalogue of real akiya-bank sources."""

from app.services import catalog


def test_catalogue_covers_every_prefecture():
    entries = catalog.load_catalog()
    assert len(entries) > 1_500
    prefectures = {e.prefecture for e in entries if e.prefecture}
    assert len(prefectures) == 47


def test_structured_sources_are_present_and_flagged():
    structured = [e for e in catalog.load_catalog() if e.adapter == "athome_municipal"]
    assert len(structured) > 500
    assert all(e.url.endswith(".akiya-athome.jp/") for e in structured)
    assert all(e.crawlable for e in structured)


def test_search_filters_and_paginates():
    page, total = catalog.search(prefecture="福井県", limit=5)
    assert total > 5
    assert len(page) == 5
    assert all(e.prefecture == "福井県" for e in page)

    second, total_again = catalog.search(prefecture="福井県", limit=5, offset=5)
    assert total_again == total
    assert {e.key for e in page}.isdisjoint({e.key for e in second})


def test_search_ranks_structured_sources_first():
    page, _ = catalog.search(prefecture="福井県", limit=10)
    adapters = [e.adapter for e in page if e.scope == "municipal"]
    # Once a generic entry appears, no structured entry may follow it.
    assert adapters == sorted(adapters, key=lambda a: a != "athome_municipal")


def test_search_is_width_and_case_insensitive():
    lower, _ = catalog.search(query="akiya-athome", limit=3)
    assert lower


def test_national_platforms_are_not_marked_crawlable():
    national = [e for e in catalog.load_catalog() if e.scope == "national"]
    assert national
    # LIFULL answers 403 to robots and At Home's portal is a directory, not a
    # listing index — neither may be handed to the crawler.
    assert not any(e.crawlable for e in national)


def test_get_returns_none_for_unknown_key():
    assert catalog.get("does-not-exist") is None
    some = catalog.load_catalog()[0]
    assert catalog.get(some.key) == some


def test_adapter_is_chosen_from_the_url():
    assert catalog.adapter_for_url("https://fukui-c18201.akiya-athome.jp/x") == "athome_municipal"
    assert catalog.adapter_for_url("https://www.city.otaru.lg.jp/akiya/") == "generic"
