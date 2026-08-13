"""Robots-respecting HTTP fetching for the worker (requests-based).

Mirrors the backend fetcher's rules: respect robots.txt, clear user-agent,
bounded timeout, never raise (failures return ``None``). Used by the daily
ingest job to fetch source *index* pages before discovering detail links.
"""

from __future__ import annotations

import logging
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import requests

logger = logging.getLogger("akiya.worker.fetcher")

USER_AGENT = "AkiyaRadarBot/0.1 (+personal akiya research; respects robots.txt)"
TIMEOUT = 12


def is_fetch_allowed(url: str, user_agent: str = USER_AGENT) -> bool:
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    parser = RobotFileParser()
    try:
        resp = requests.get(robots_url, headers={"User-Agent": user_agent}, timeout=TIMEOUT)
        if resp.status_code >= 400:
            return True
        parser.parse(resp.text.splitlines())
    except Exception as exc:  # noqa: BLE001
        logger.info("robots.txt unavailable for %s (%s) — allowing", robots_url, exc)
        return True
    return parser.can_fetch(user_agent, url)


def fetch_html(url: str) -> str | None:
    if not is_fetch_allowed(url):
        logger.info("robots.txt disallows fetching %s", url)
        return None
    try:
        resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=TIMEOUT)
    except Exception as exc:  # noqa: BLE001
        logger.info("fetch failed for %s (%s)", url, exc)
        return None
    if resp.status_code != 200:
        return None
    ctype = resp.headers.get("content-type", "").lower()
    if ctype and "html" not in ctype:
        return None
    return resp.text


# --- JavaScript rendering ---------------------------------------------------
#
# Some source index pages are single-page applications: the HTML served over
# plain HTTP contains no listing link at all, so link discovery finds nothing.
# When Scrapling is installed, those pages are re-fetched through a real
# browser. Rendering only — no stealth fetcher, no anti-bot circumvention.

_SPA_MARKERS = (
    "/_nuxt/",
    "__NUXT__",
    "__NEXT_DATA__",
    '<div id="root"></div>',
    '<div id="app"></div>',
    "ng-version",
    "data-reactroot",
)
_MIN_TEXT_LENGTH = 600


def looks_unrendered(html: str | None) -> bool:
    """Whether ``html`` is an app shell whose content needs JavaScript."""
    if not html:
        return True
    if not any(marker in html for marker in _SPA_MARKERS):
        return False
    import re

    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return len(re.sub(r"\s+", " ", text).strip()) < _MIN_TEXT_LENGTH


def fetch_rendered_html(url: str) -> str | None:
    """Render ``url`` in a browser via Scrapling, or ``None`` if unavailable."""
    if not is_fetch_allowed(url):
        logger.info("robots.txt disallows fetching %s", url)
        return None
    try:
        from scrapling.fetchers import DynamicFetcher
    except Exception:  # noqa: BLE001 — optional dependency
        logger.info("Scrapling not installed — cannot render %s", url)
        return None

    import os

    kwargs = {
        "headless": True,
        "network_idle": True,
        "disable_resources": True,
        "timeout": 45_000,
        "useragent": USER_AGENT,
        # Scrapling fakes a Google referrer by default; this crawler identifies
        # itself honestly.
        "google_search": False,
    }
    if executable := os.environ.get("AKIYA_BROWSER_PATH"):
        kwargs["executable_path"] = executable
    try:
        page = DynamicFetcher.fetch(url, **kwargs)
    except Exception as exc:  # noqa: BLE001 — never break the ingest run
        logger.warning("dynamic fetch failed for %s (%s)", url, exc)
        return None
    return getattr(page, "html_content", None)


def fetch_html_smart(url: str) -> tuple[str | None, str]:
    """Fetch ``url``, rendering only if the plain response is an app shell.

    Returns ``(html, mode)`` with ``mode`` in ``static`` / ``rendered``.
    """
    html = fetch_html(url)
    if html and not looks_unrendered(html):
        return html, "static"
    rendered = fetch_rendered_html(url)
    if rendered:
        return rendered, "rendered"
    return html, "static"
