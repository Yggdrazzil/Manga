"""Fallback adapter for manually-imported URLs.

Always handles any URL and produces a minimal listing so an import never fails
completely — matching the backend's import-url guarantee.
"""

from __future__ import annotations

from worker.adapters.base import SourceAdapter
from worker.models import NormalizedListing, RawListing


class ManualUrlAdapter(SourceAdapter):
    source_name = "manual"

    def can_handle(self, url: str) -> bool:
        return True

    def parse_detail(self, html: str) -> RawListing:
        return RawListing(source_url="", raw_html_excerpt=(html or "")[:500])

    def normalize(self, raw: RawListing) -> NormalizedListing:
        return NormalizedListing(
            source_url=raw.source_url,
            external_id=raw.external_id,
            title_original=raw.title,
            description_original=raw.description,
            price_text_original=raw.price_text,
            address_text=raw.address_text,
            raw_json={"adapter": self.source_name, "parsed": False},
        )
