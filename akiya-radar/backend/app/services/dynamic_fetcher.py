"""JavaScript rendering for sources that ship an empty HTML shell.

A growing share of akiya sites are single-page applications — 家いちば is a Nuxt
app, several municipal banks use similar frameworks — where the HTML served over
plain HTTP contains no listing at all. The markup only exists after the page's
JavaScript has run, so the fix is to actually run it: `Scrapling
<https://github.com/D4Vinci/Scrapling>`_ drives a real browser and hands back
the rendered DOM, which then goes through the same extraction pipeline as every
other source.

**Scope, deliberately.** This module renders pages; it does not defeat bot
protection. Scrapling also ships stealth fetchers designed to look like a human
visitor, and those stay unused: the project rules forbid anti-bot circumvention,
and a site answering 403 to robots (LIFULL HOME'S, for one) has stated its
position clearly. robots.txt is honoured here exactly as in the plain fetcher,
requests stay paced, and the user agent stays identifiable.

Rendering is a browser launch per page — roughly a hundred times the cost of an
HTTP GET — so it is opt-in per source and used as an escalation, never as the
default path.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from urllib.parse import urlsplit

from app.config import get_settings
from app.services.fetcher import is_fetch_allowed

logger = logging.getLogger("akiya.dynamic_fetcher")

# Outcomes match app.services.fetcher so callers can treat both the same way.
Outcome = str


@lru_cache(maxsize=1)
def is_available() -> bool:
    """Whether Scrapling and a usable browser are installed."""
    try:
        import scrapling.fetchers  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        logger.info("Scrapling unavailable (%s) — dynamic rendering disabled", exc)
        return False
    return True


def _proxy_for(url: str) -> str | None:
    """The configured proxy, unless ``NO_PROXY`` exempts this host."""
    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    if not proxy:
        return None
    host = urlsplit(url).hostname or ""
    no_proxy = os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or ""
    exempt = [p.strip().lstrip(".") for p in no_proxy.split(",") if p.strip()]
    if host in ("localhost", "127.0.0.1", "::1") or any(
        host == e or host.endswith("." + e) for e in exempt
    ):
        return None
    return proxy


def _browser_kwargs(url: str) -> dict:
    """Options passed to Scrapling, driven entirely by configuration."""
    settings = get_settings()
    kwargs: dict = {
        "headless": True,
        "timeout": int(settings.dynamic_fetch_timeout * 1000),
        # Fonts, images and media are never parsed by the extractor; skipping
        # them cuts the page load time roughly in half.
        "disable_resources": True,
        "network_idle": True,
        "useragent": settings.user_agent,
        # Scrapling defaults to sending a Google referrer to look like organic
        # traffic. This crawler identifies itself honestly, so that is off.
        "google_search": False,
    }
    # Lets a deployment reuse a browser it already has instead of downloading one.
    executable = os.environ.get("AKIYA_BROWSER_PATH") or settings.browser_executable_path
    if executable:
        kwargs["executable_path"] = executable
    if proxy := _proxy_for(url):
        kwargs["proxy"] = proxy
    return kwargs


def fetch_rendered(url: str, wait_selector: str | None = None) -> tuple[Outcome, str | None]:
    """Load ``url`` in a real browser and return ``(outcome, rendered_html)``.

    Same contract as :func:`app.services.fetcher.fetch_page`: never raises, and
    a failure is reported as ``error`` rather than as an empty page.
    """
    settings = get_settings()
    if not settings.dynamic_fetch_enabled:
        return "disabled", None
    if not is_available():
        return "unavailable", None
    if not is_fetch_allowed(url):
        logger.info("robots.txt disallows fetching %s", url)
        return "disallowed", None

    from scrapling.fetchers import DynamicFetcher

    kwargs = _browser_kwargs(url)
    if wait_selector:
        kwargs["wait_selector"] = wait_selector
    try:
        page = DynamicFetcher.fetch(url, **kwargs)
    except Exception as exc:  # noqa: BLE001 — rendering must never break a run
        logger.info("dynamic fetch failed for %s (%s)", url, exc)
        return "error", None

    status = getattr(page, "status", 200) or 200
    if status in (404, 410):
        return "gone", None
    if status >= 400:
        logger.info("dynamic fetch %s returned status %s", url, status)
        return "error", None

    html = getattr(page, "html_content", None)
    if not html:
        return "error", None
    return "ok", html
