"""Pluggable provider abstractions (translation, summary, exchange rate).

All default implementations are *mock* so the MVP has zero paid dependencies.
Real providers (Claude, OpenAI, DeepL, live FX) can be wired later behind the
same interfaces, selected via environment variables.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Protocol

from app.config import get_settings


class TranslationProvider(Protocol):
    def translate_to_french(self, text: str) -> str: ...


class SummaryProvider(Protocol):
    def summarize_listing(self, listing: dict) -> str: ...


class ExchangeRateProvider(Protocol):
    def jpy_to_eur(self, amount_yen: Decimal) -> Decimal: ...


class MockTranslationProvider:
    """Returns a clearly-marked placeholder; the field stays editable in the UI."""

    def translate_to_french(self, text: str) -> str:
        if not text:
            return ""
        return f"[Traduction automatique indisponible — texte original conservé] {text}"


class ManualTranslationProvider:
    """No-op provider: the user pastes the translation manually."""

    def translate_to_french(self, text: str) -> str:
        return ""


class MockSummaryProvider:
    def summarize_listing(self, listing: dict) -> str:
        parts: list[str] = []
        if listing.get("property_type"):
            parts.append(str(listing["property_type"]))
        if listing.get("city") or listing.get("prefecture"):
            loc = ", ".join(
                p for p in (listing.get("city"), listing.get("prefecture")) if p
            )
            parts.append(f"à {loc}")
        if listing.get("price_yen"):
            parts.append(f"prix {int(float(listing['price_yen'])):,} ¥".replace(",", " "))
        if listing.get("land_area_m2"):
            parts.append(f"terrain {listing['land_area_m2']} m²")
        if listing.get("building_area_m2"):
            parts.append(f"bâti {listing['building_area_m2']} m²")
        if not parts:
            return "Résumé indisponible (données insuffisantes)."
        return "Bien : " + ", ".join(parts) + "."


class MockExchangeRateProvider:
    def __init__(self, rate: Decimal | None = None) -> None:
        self._rate = rate or Decimal(str(get_settings().jpy_to_eur_rate))

    def jpy_to_eur(self, amount_yen: Decimal) -> Decimal:
        return (Decimal(amount_yen) * self._rate).quantize(Decimal("0.01"))


class LiveExchangeRateProvider:
    """Live JPY→EUR rate, with redundancy.

    A single provider is a single point of silent failure: when Frankfurter
    moved to a new host, the old endpoint answered ``301`` and the app quietly
    fell back to a stale hard-coded rate — every price shown in euros was ~10 %
    too high with nothing in the UI to suggest it. So: redirects are followed,
    several independent providers are tried in order, and the caller can tell
    whether the number is live or a fallback.
    """

    ENDPOINTS: tuple[tuple[str, str, dict], ...] = (
        ("frankfurter", "https://api.frankfurter.dev/v1/latest", {"base": "JPY", "symbols": "EUR"}),
        ("erapi", "https://open.er-api.com/v6/latest/JPY", {}),
    )
    TTL_SECONDS = 6 * 3600

    _cached_rate: Decimal | None = None
    _cached_at: float = 0.0
    _cached_source: str = "static"

    @staticmethod
    def _read_rate(payload: dict) -> Decimal | None:
        rates = payload.get("rates")
        if not isinstance(rates, dict) or "EUR" not in rates:
            return None
        try:
            rate = Decimal(str(rates["EUR"]))
        except (TypeError, ValueError, ArithmeticError):
            return None
        # Sanity band: JPY→EUR has stayed well inside this range for decades, so
        # anything outside it means the payload is not what we think it is.
        return rate if Decimal("0.001") < rate < Decimal("0.05") else None

    def _live_rate(self) -> tuple[Decimal, str] | None:
        import time

        import httpx

        cls = LiveExchangeRateProvider
        if cls._cached_rate is not None and time.time() - cls._cached_at < self.TTL_SECONDS:
            return cls._cached_rate, cls._cached_source

        for name, url, params in self.ENDPOINTS:
            try:
                resp = httpx.get(
                    url,
                    params=params,
                    headers={"User-Agent": get_settings().user_agent},
                    timeout=8.0,
                    follow_redirects=True,
                )
                resp.raise_for_status()
                rate = self._read_rate(resp.json())
            except Exception:  # noqa: BLE001 — try the next provider
                continue
            if rate is not None:
                cls._cached_rate, cls._cached_at, cls._cached_source = rate, time.time(), name
                return rate, name
        return None

    def current_rate(self) -> tuple[Decimal, str]:
        """Return ``(rate, source)`` — ``source`` is ``static`` when offline."""
        live = self._live_rate()
        if live is not None:
            return live
        return Decimal(str(get_settings().jpy_to_eur_rate)), "static"

    def jpy_to_eur(self, amount_yen: Decimal) -> Decimal:
        rate, _ = self.current_rate()
        return (Decimal(amount_yen) * rate).quantize(Decimal("0.01"))


# Kept as an alias so existing configuration values keep working.
FrankfurterExchangeRateProvider = LiveExchangeRateProvider


def get_translation_provider() -> TranslationProvider:
    provider = get_settings().translation_provider
    if provider == "manual":
        return ManualTranslationProvider()
    return MockTranslationProvider()


def get_summary_provider() -> SummaryProvider:
    return MockSummaryProvider()


def get_exchange_rate_provider() -> ExchangeRateProvider:
    if get_settings().exchange_rate_provider == "static":
        return MockExchangeRateProvider()
    return LiveExchangeRateProvider()
