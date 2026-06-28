"""Daily ingestion job — discovers and imports new akiya listings.

Orchestration (kept simple and robots-respecting):

1. Determine source *index* pages to crawl:
   - explicit ``AKIYA_SOURCE_INDEX_URLS`` (newline/comma separated), and/or
   - the ``base_url`` of crawl-enabled sources fetched from the backend API.
2. For each index page, discover candidate *detail* links.
3. Plus any explicit ``AKIYA_WATCH_URLS`` detail pages.
4. POST every detail URL to the backend ``/listings/import-url`` — the backend
   then fetches, extracts, deduplicates, scores and stores it. New URLs become
   new listings; already-known URLs are returned without duplication.

Designed to run in CI (GitHub Actions) on a daily schedule. If no API base is
configured it exits cleanly as a no-op, so the workflow is safe before the app
is deployed.
"""

from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from urllib.parse import urljoin, urlsplit

import requests

from worker import fetcher

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("akiya.worker.ingest")

# Heuristics for what a "detail page" link looks like on akiya-bank sites.
# Matched against the URL *path* (not the host, which often contains "akiya").
_DETAIL_HINTS = ("bukken", "property", "detail", "estate", "物件", "kominka")
_DETAIL_RE = re.compile(r"/\d{2,}")


@dataclass
class IngestSummary:
    discovered: int = 0
    created: int = 0
    duplicates: int = 0
    errors: int = 0
    detail: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "discovered": self.discovered,
            "created": self.created,
            "duplicates": self.duplicates,
            "errors": self.errors,
        }


def _split_env_list(value: str | None) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in re.split(r"[\n,]", value) if v.strip()]


def discover_detail_urls(index_html: str, base_url: str) -> list[str]:
    """Find candidate detail-page URLs from an index page's anchors."""
    if not index_html:
        return []
    base_host = urlsplit(base_url).netloc
    found: list[str] = []
    seen: set[str] = set()
    for match in re.finditer(r'href=["\']([^"\']+)["\']', index_html, re.I):
        href = match.group(1)
        if href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(base_url, href)
        parts = urlsplit(absolute)
        if parts.scheme not in ("http", "https"):
            continue
        if base_host and parts.netloc and parts.netloc != base_host:
            continue
        path = parts.path.lower()
        looks_detail = any(h in path for h in _DETAIL_HINTS) or _DETAIL_RE.search(path)
        if looks_detail and absolute not in seen:
            seen.add(absolute)
            found.append(absolute)
    return found


def _crawl_enabled_index_urls(api_base: str, token: str | None) -> list[str]:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = requests.get(f"{api_base}/sources", headers=headers, timeout=15)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        logger.warning("could not list sources from %s (%s)", api_base, exc)
        return []
    return [
        s["base_url"]
        for s in resp.json()
        if s.get("crawl_enabled") and s.get("base_url")
    ]


def _import_one(api_base: str, url: str, token: str | None) -> str:
    """Import a single URL via the backend. Returns 'created'|'duplicate'|'error'."""
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        resp = requests.post(
            f"{api_base}/listings/import-url",
            json={"url": url},
            headers=headers,
            timeout=30,
        )
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        logger.warning("import failed for %s (%s)", url, exc)
        return "error"
    body = resp.json()
    if body.get("possible_duplicates"):
        return "duplicate"
    return "created"


def run_ingest(
    api_base: str,
    token: str | None = None,
    source_index_urls: list[str] | None = None,
    watch_urls: list[str] | None = None,
) -> IngestSummary:
    summary = IngestSummary()
    detail_urls: list[str] = list(watch_urls or [])

    for index_url in source_index_urls or []:
        html = fetcher.fetch_html(index_url)
        if not html:
            continue
        links = discover_detail_urls(html, index_url)
        logger.info("discovered %d detail link(s) from %s", len(links), index_url)
        detail_urls.extend(links)

    # De-duplicate while preserving order.
    detail_urls = list(dict.fromkeys(detail_urls))
    summary.discovered = len(detail_urls)

    for url in detail_urls:
        outcome = _import_one(api_base, url, token)
        if outcome == "created":
            summary.created += 1
        elif outcome == "duplicate":
            summary.duplicates += 1
        else:
            summary.errors += 1
    return summary


def main() -> None:
    api_base = os.environ.get("AKIYA_API_BASE", "").rstrip("/")
    token = os.environ.get("AKIYA_ADMIN_TOKEN") or None
    watch_urls = _split_env_list(os.environ.get("AKIYA_WATCH_URLS"))
    index_urls = _split_env_list(os.environ.get("AKIYA_SOURCE_INDEX_URLS"))

    if not api_base:
        logger.info(
            "AKIYA_API_BASE not set — nothing to do (configure the secret to enable "
            "daily ingestion). Exiting cleanly."
        )
        return

    index_urls = index_urls or _crawl_enabled_index_urls(api_base, token)
    logger.info(
        "starting ingest: api=%s index_urls=%d watch_urls=%d",
        api_base,
        len(index_urls),
        len(watch_urls),
    )
    summary = run_ingest(api_base, token, index_urls, watch_urls)
    logger.info("ingest finished: %s", summary.as_dict())


if __name__ == "__main__":
    main()
