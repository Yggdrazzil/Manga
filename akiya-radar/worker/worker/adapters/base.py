"""SourceAdapter interface — the contract every ingestion source implements."""

from __future__ import annotations

from worker.models import NormalizedListing, RawListing


class SourceAdapter:
    source_name: str = "base"

    def can_handle(self, url: str) -> bool:
        raise NotImplementedError

    def fetch_detail(self, url: str) -> str:
        """Fetch raw HTML for a detail page.

        Networked adapters must respect robots.txt and rate limits. The MVP only
        parses provided fixtures, so the default raises to signal "not wired".
        """
        raise NotImplementedError(
            f"{self.source_name}: live fetching is not enabled in the MVP."
        )

    def parse_detail(self, html: str) -> RawListing:
        raise NotImplementedError

    def normalize(self, raw: RawListing) -> NormalizedListing:
        raise NotImplementedError
