"""Best-effort, robots-respecting HTML fetching for manual URL imports.

Design rules (from the cahier des charges):
- Respect robots.txt.
- Clear, identifiable User-Agent.
- Bounded timeout.
- Never raise: any failure (network, robots disallow, non-HTML, bad status)
  returns ``None`` so the import flow can fall back to an editable stub.
- No anti-bot circumvention, no proxy rotation.
"""

from __future__ import annotations

import logging
import re
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

import httpx

from app.config import get_settings

logger = logging.getLogger("akiya.fetcher")

_HTML_HINTS = ("text/html", "application/xhtml")


def is_fetch_allowed(url: str, user_agent: str | None = None) -> bool:
    """Return whether robots.txt permits fetching ``url``.

    Fails *open* only when robots.txt itself cannot be retrieved (common for
    small municipal sites). A robots.txt that explicitly disallows is honoured.
    """
    settings = get_settings()
    ua = user_agent or settings.user_agent
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        return False
    robots_url = f"{parts.scheme}://{parts.netloc}/robots.txt"
    parser = RobotFileParser()
    try:
        resp = httpx.get(
            robots_url,
            headers={"User-Agent": ua},
            timeout=settings.import_fetch_timeout,
            follow_redirects=True,
        )
        if resp.status_code >= 400:
            return True  # no usable robots.txt → allowed
        parser.parse(resp.text.splitlines())
    except Exception as exc:  # noqa: BLE001
        logger.info("robots.txt unavailable for %s (%s) — allowing", robots_url, exc)
        return True
    return parser.can_fetch(ua, url)


def fetch_page(url: str) -> tuple[str, str | None]:
    """Status-aware fetch. Returns ``(outcome, html)``.

    Outcomes: ``ok`` (200 + HTML), ``gone`` (404/410 — the page no longer
    exists), ``error`` (network failure or other status — treat as UNKNOWN,
    never as gone), ``disallowed`` (robots.txt), ``disabled``.
    """
    settings = get_settings()
    if not settings.import_fetch_enabled:
        return "disabled", None
    if not is_fetch_allowed(url):
        logger.info("robots.txt disallows fetching %s", url)
        return "disallowed", None
    try:
        resp = httpx.get(
            url,
            headers={"User-Agent": settings.user_agent},
            timeout=settings.import_fetch_timeout,
            follow_redirects=True,
        )
    except Exception as exc:  # noqa: BLE001
        logger.info("fetch failed for %s (%s)", url, exc)
        return "error", None
    if resp.status_code in (404, 410):
        return "gone", None
    if resp.status_code != 200:
        logger.info("fetch %s returned status %s", url, resp.status_code)
        return "error", None
    content_type = resp.headers.get("content-type", "").lower()
    if content_type and not any(h in content_type for h in _HTML_HINTS):
        logger.info("fetch %s returned non-HTML content-type %s", url, content_type)
        return "error", None
    return "ok", resp.text


def fetch_html(url: str) -> str | None:
    """Fetch the HTML body of ``url`` or return ``None`` on any problem."""
    _, html = fetch_page(url)
    return html


# Markers of a single-page-application shell: the framework's mount point is
# there, the content is not. Matching the framework rather than "the page looks
# short" avoids re-rendering pages that are simply sparse.
_SPA_MARKERS = (
    "/_nuxt/",
    "__NUXT__",
    "__NEXT_DATA__",
    '<div id="root"></div>',
    '<div id="app"></div>',
    "ng-version",
    "data-reactroot",
)
# Below this, a page carries no meaningful body text once tags are stripped.
_MIN_TEXT_LENGTH = 600


def looks_unrendered(html: str | None) -> bool:
    """Whether ``html`` looks like an app shell whose content needs JavaScript."""
    if not html:
        return True
    if not any(marker in html for marker in _SPA_MARKERS):
        return False
    # A framework marker alone proves nothing — plenty of server-rendered sites
    # ship one. It only matters when the body is also empty of text.
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    return len(re.sub(r"\s+", " ", text).strip()) < _MIN_TEXT_LENGTH


def fetch_page_smart(
    url: str, prefer_render: bool = False
) -> tuple[str, str | None, str]:
    """Fetch ``url``, rendering JavaScript only when it is actually needed.

    Returns ``(outcome, html, mode)`` where ``mode`` is ``static`` or
    ``rendered``, so callers can record how a listing was obtained.

    A plain GET is tried first: it is ~100× cheaper than a browser launch and
    covers the overwhelming majority of akiya banks. The browser is used when
    the source is known to need it, or when what came back is an empty app
    shell.
    """
    from app.services import dynamic_fetcher

    if not prefer_render:
        outcome, html = fetch_page(url)
        if outcome == "ok" and not looks_unrendered(html):
            return outcome, html, "static"
        # 404/410 and robots refusals are answers, not rendering problems.
        if outcome in ("gone", "disallowed", "disabled"):
            return outcome, html, "static"
        static_result = (outcome, html)
    else:
        static_result = ("skipped", None)

    rendered_outcome, rendered_html = dynamic_fetcher.fetch_rendered(url)
    if rendered_outcome == "ok" and rendered_html:
        return "ok", rendered_html, "rendered"

    # Rendering unavailable or failed: fall back to whatever the plain fetch got
    # rather than losing a usable page.
    if static_result[0] == "ok" and static_result[1]:
        return "ok", static_result[1], "static"
    if prefer_render:
        return rendered_outcome, None, "rendered"
    return static_result[0], static_result[1], "static"
