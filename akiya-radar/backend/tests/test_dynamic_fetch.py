"""JavaScript rendering: when it kicks in, and the limits it keeps.

Scrapling itself is mocked — what matters here is the escalation policy (a
browser is a hundred times the cost of a GET, so it must stay the exception),
the never-raise contract, and the fact that rendering never turns into
anti-bot circumvention.
"""

import httpx
import pytest

from app.services import dynamic_fetcher, fetcher

NUXT_SHELL = (
    '<html><head><script src="/_nuxt/app.js"></script></head>'
    '<body><div id="__nuxt"></div></body></html>'
)
RENDERED = (
    "<html><body><table><tr><th>価格</th><td>480万円</td></tr></table>"
    + "本物件は" * 200
    + "</body></html>"
)
SERVER_RENDERED = (
    '<html><head><script src="/_nuxt/app.js"></script></head><body>'
    "<table><tr><th>価格</th><td>380万円</td></tr></table>" + "説明文" * 300 + "</body></html>"
)


class _FakePage:
    def __init__(self, html="<html></html>", status=200):
        self.html_content = html
        self.status = status


# ---- when rendering is triggered ----


def test_app_shell_is_detected():
    assert fetcher.looks_unrendered(NUXT_SHELL) is True
    assert fetcher.looks_unrendered(None) is True


def test_a_framework_marker_alone_does_not_trigger_rendering():
    # Plenty of server-rendered sites ship a bundler marker. Only an empty body
    # justifies paying for a browser.
    assert fetcher.looks_unrendered(SERVER_RENDERED) is False


def test_plain_html_is_never_re_fetched(monkeypatch):
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", RENDERED))

    def fail(*a, **k):
        raise AssertionError("a browser must not be launched for a usable page")

    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", fail)
    outcome, html, mode = fetcher.fetch_page_smart("https://x.jp/1")
    assert (outcome, mode) == ("ok", "static")
    assert html == RENDERED


def test_app_shell_escalates_to_rendering(monkeypatch):
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", NUXT_SHELL))
    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", lambda url: ("ok", RENDERED))
    outcome, html, mode = fetcher.fetch_page_smart("https://x.jp/1")
    assert (outcome, mode) == ("ok", "rendered")
    assert "480万円" in html


def test_a_gone_page_is_not_re_rendered(monkeypatch):
    """404 is an answer, not a rendering problem."""
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("gone", None))

    def fail(*a, **k):
        raise AssertionError("404 must not trigger a browser")

    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", fail)
    assert fetcher.fetch_page_smart("https://x.jp/1")[0] == "gone"


def test_robots_refusal_is_not_worked_around(monkeypatch):
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("disallowed", None))

    def fail(*a, **k):
        raise AssertionError("a robots refusal must never be retried with a browser")

    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", fail)
    assert fetcher.fetch_page_smart("https://x.jp/1")[0] == "disallowed"


def test_render_failure_falls_back_to_the_static_body(monkeypatch):
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", NUXT_SHELL))
    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", lambda url: ("error", None))
    outcome, html, mode = fetcher.fetch_page_smart("https://x.jp/1")
    # Better a thin page than none at all.
    assert (outcome, mode) == ("ok", "static")
    assert html == NUXT_SHELL


def test_prefer_render_skips_the_plain_fetch(monkeypatch):
    def fail(url):
        raise AssertionError("a known SPA source should not be fetched twice")

    monkeypatch.setattr(fetcher, "fetch_page", fail)
    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", lambda url: ("ok", RENDERED))
    assert fetcher.fetch_page_smart("https://x.jp/1", prefer_render=True)[2] == "rendered"


# ---- the renderer itself ----


def test_rendering_honours_robots(monkeypatch):
    monkeypatch.setattr(dynamic_fetcher, "is_available", lambda: True)
    monkeypatch.setattr(dynamic_fetcher, "is_fetch_allowed", lambda url: False)
    assert dynamic_fetcher.fetch_rendered("https://x.jp/1") == ("disallowed", None)


def test_rendering_never_raises(monkeypatch):
    monkeypatch.setattr(dynamic_fetcher, "is_available", lambda: True)
    monkeypatch.setattr(dynamic_fetcher, "is_fetch_allowed", lambda url: True)
    scrapling = pytest.importorskip("scrapling.fetchers")

    def boom(*a, **k):
        raise httpx.ConnectError("browser died")

    monkeypatch.setattr(scrapling.DynamicFetcher, "fetch", staticmethod(boom))
    assert dynamic_fetcher.fetch_rendered("https://x.jp/1") == ("error", None)


def test_missing_scrapling_is_reported_not_fatal(monkeypatch):
    monkeypatch.setattr(dynamic_fetcher, "is_available", lambda: False)
    assert dynamic_fetcher.fetch_rendered("https://x.jp/1") == ("unavailable", None)


def test_rendered_404_is_gone(monkeypatch):
    monkeypatch.setattr(dynamic_fetcher, "is_available", lambda: True)
    monkeypatch.setattr(dynamic_fetcher, "is_fetch_allowed", lambda url: True)
    scrapling = pytest.importorskip("scrapling.fetchers")
    monkeypatch.setattr(
        scrapling.DynamicFetcher, "fetch", staticmethod(lambda *a, **k: _FakePage(status=404))
    )
    assert dynamic_fetcher.fetch_rendered("https://x.jp/1") == ("gone", None)


def test_no_fake_referrer_and_identifiable_agent():
    """Rendering must not impersonate organic traffic."""
    kwargs = dynamic_fetcher._browser_kwargs("https://example.jp/x")
    assert kwargs["google_search"] is False
    assert "AkiyaRadarBot" in kwargs["useragent"]


def test_local_hosts_bypass_the_configured_proxy(monkeypatch):
    monkeypatch.setenv("HTTPS_PROXY", "http://127.0.0.1:9999")
    monkeypatch.setenv("NO_PROXY", "internal.example.jp")
    assert dynamic_fetcher._proxy_for("https://www.example.jp/x") == "http://127.0.0.1:9999"
    assert dynamic_fetcher._proxy_for("http://127.0.0.1:8000/x") is None
    assert dynamic_fetcher._proxy_for("https://internal.example.jp/x") is None
