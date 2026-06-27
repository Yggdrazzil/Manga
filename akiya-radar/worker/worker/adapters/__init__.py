from worker.adapters.base import SourceAdapter
from worker.adapters.generic_municipal import GenericMunicipalAkiyaAdapter
from worker.adapters.manual import ManualUrlAdapter
from worker.adapters.placeholders import (
    AtHomeAkiyaBankAdapter,
    LifullAkiyaBankAdapter,
    OkinoshimaAdapter,
    TsurugaAkiyaAdapter,
)

REGISTRY: list[SourceAdapter] = [
    TsurugaAkiyaAdapter(),
    OkinoshimaAdapter(),
    LifullAkiyaBankAdapter(),
    AtHomeAkiyaBankAdapter(),
    GenericMunicipalAkiyaAdapter(),
    ManualUrlAdapter(),  # fallback, must remain last
]


def select_adapter(url: str) -> SourceAdapter:
    """Return the first adapter that can handle ``url`` (ManualUrlAdapter always can)."""
    for adapter in REGISTRY:
        if adapter.can_handle(url):
            return adapter
    return ManualUrlAdapter()


__all__ = [
    "SourceAdapter",
    "ManualUrlAdapter",
    "GenericMunicipalAkiyaAdapter",
    "TsurugaAkiyaAdapter",
    "OkinoshimaAdapter",
    "LifullAkiyaBankAdapter",
    "AtHomeAkiyaBankAdapter",
    "REGISTRY",
    "select_adapter",
]
