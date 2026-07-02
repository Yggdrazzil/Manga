from worker import fetcher, ingest

INDEX_HTML = """
<html><body>
  <a href="/bukken/0001">物件1</a>
  <a href="/bukken/0002">物件2</a>
  <a href="https://other-site.example/bukken/9">外部</a>
  <a href="/about">会社概要</a>
  <a href="#top">top</a>
  <a href="mailto:x@y.jp">mail</a>
</body></html>
"""


def test_discover_detail_urls_filters_to_same_host_detail_links():
    urls = ingest.discover_detail_urls(INDEX_HTML, "https://akiya.city.example.jp/list")
    assert "https://akiya.city.example.jp/bukken/0001" in urls
    assert "https://akiya.city.example.jp/bukken/0002" in urls
    # external host and non-detail/anchor/mailto links excluded
    assert all("other-site" not in u for u in urls)
    assert all("/about" not in u for u in urls)
    assert all(not u.endswith("#top") for u in urls)


def test_discover_handles_empty():
    assert ingest.discover_detail_urls("", "https://x.jp") == []


def test_split_env_list():
    assert ingest._split_env_list("a\nb, c") == ["a", "b", "c"]
    assert ingest._split_env_list(None) == []
    assert ingest._split_env_list("") == []


def test_run_ingest_counts_outcomes(monkeypatch):
    monkeypatch.setattr(fetcher, "fetch_html", lambda url: INDEX_HTML)

    calls: list[str] = []

    class FakeResp:
        def __init__(self, dup: bool):
            self._dup = dup

        def raise_for_status(self):
            pass

        def json(self):
            return {"possible_duplicates": [{"x": 1}] if self._dup else []}

    def fake_post(url, json, headers, timeout):
        calls.append(json["url"])
        # Mark the second discovered URL as a duplicate.
        return FakeResp(dup=json["url"].endswith("0002"))

    monkeypatch.setattr(ingest.requests, "post", fake_post)

    summary = ingest.run_ingest(
        "https://api.example",
        source_index_urls=["https://akiya.city.example.jp/list"],
    )
    assert summary.discovered == 2
    assert summary.created == 1
    assert summary.duplicates == 1
    assert summary.errors == 0
    assert len(calls) == 2


def test_run_ingest_handles_post_errors(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("network down")

    monkeypatch.setattr(ingest.requests, "post", boom)
    summary = ingest.run_ingest("https://api.example", watch_urls=["https://x.jp/bukken/1"])
    assert summary.discovered == 1
    assert summary.errors == 1
    assert summary.created == 0


def test_watch_urls_are_deduped(monkeypatch):
    monkeypatch.setattr(
        ingest.requests,
        "post",
        lambda *a, **k: type(
            "R",
            (),
            {"raise_for_status": lambda s: None, "json": lambda s: {"possible_duplicates": []}},
        )(),
    )
    summary = ingest.run_ingest(
        "https://api.example",
        watch_urls=["https://x.jp/a", "https://x.jp/a", "https://x.jp/b"],
    )
    assert summary.discovered == 2


def test_run_refresh_counts_outcomes(monkeypatch):
    listings = {"items": [{"id": "a"}, {"id": "b"}, {"id": "c"}]}
    refresh_bodies = {
        "a": {"status_before": "active", "status_after": "gone", "price_changed": False},
        "b": {"status_before": "active", "status_after": "active", "price_changed": True},
    }

    class R:
        def __init__(self, body, ok=True):
            self._body, self._ok = body, ok

        def raise_for_status(self):
            if not self._ok:
                raise RuntimeError("boom")

        def json(self):
            return self._body

    monkeypatch.setattr(ingest.requests, "get", lambda *a, **k: R(listings))

    def fake_post(url, headers, timeout):
        lid = url.rsplit("/", 2)[-2]
        if lid == "c":
            return R({}, ok=False)
        return R(refresh_bodies[lid])

    monkeypatch.setattr(ingest.requests, "post", fake_post)
    summary = ingest.IngestSummary()
    ingest.run_refresh("https://api.example", None, summary)
    assert summary.refreshed == 2
    assert summary.gone == 1
    assert summary.price_changes == 1
    assert summary.errors == 1
