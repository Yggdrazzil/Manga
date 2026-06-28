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
