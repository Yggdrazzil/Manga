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
