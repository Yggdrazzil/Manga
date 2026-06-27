"""Ingestion pipeline orchestration.

The MVP runs the parse → normalize pipeline against local fixture HTML to prove
the adapter architecture end to end. Live fetching (with robots.txt checks and
rate limiting) is added in a later milestone.
"""

from __future__ import annotations

import logging
from dataclasses import replace

from worker.adapters import select_adapter
from worker.models import NormalizedListing

USER_AGENT = "AkiyaRadarBot/0.1 (personal akiya research; contact via app settings)"

logger = logging.getLogger("akiya.worker")


def process_html(url: str, html: str) -> NormalizedListing:
    """Run the full adapter pipeline for one detail page of known HTML."""
    adapter = select_adapter(url)
    logger.info("processing %s with adapter=%s", url, adapter.source_name)
    raw = adapter.parse_detail(html)
    raw = replace(raw, source_url=url)
    normalized = adapter.normalize(raw)
    return normalized


def process_many(items: list[tuple[str, str]]) -> list[NormalizedListing]:
    """Process (url, html) pairs, isolating failures per source."""
    results: list[NormalizedListing] = []
    for url, html in items:
        try:
            results.append(process_html(url, html))
        except Exception:  # noqa: BLE001 — one bad source must not stop the job
            logger.exception("failed to process %s", url)
    return results
