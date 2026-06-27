"""Source-specific adapter placeholders.

These subclass the generic municipal parser and only narrow ``can_handle`` to
their domain. Real, source-tuned parsing/fetching is added in later milestones;
no live scraping is implemented in the MVP.
"""

from __future__ import annotations

from worker.adapters.generic_municipal import GenericMunicipalAkiyaAdapter


class TsurugaAkiyaAdapter(GenericMunicipalAkiyaAdapter):
    source_name = "tsuruga_akiya"

    def can_handle(self, url: str) -> bool:
        return "tsuruga" in url


class OkinoshimaAdapter(GenericMunicipalAkiyaAdapter):
    source_name = "okinoshima_akiya"

    def can_handle(self, url: str) -> bool:
        return "okinoshima" in url


class LifullAkiyaBankAdapter(GenericMunicipalAkiyaAdapter):
    source_name = "lifull_akiya_bank"

    def can_handle(self, url: str) -> bool:
        return "homes.co.jp" in url or "homes.example" in url


class AtHomeAkiyaBankAdapter(GenericMunicipalAkiyaAdapter):
    source_name = "athome_akiya_bank"

    def can_handle(self, url: str) -> bool:
        return "athome" in url
