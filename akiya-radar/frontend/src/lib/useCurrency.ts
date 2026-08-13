import { useEffect, useState } from "react";

import {
  type Currency,
  convertFromYen,
  fetchRates,
  formatConverted,
  rateFor,
  type RateInfo,
} from "./exchange";
import { loadSettings } from "./settings";

const SETTINGS_EVENT = "akiya:settings-changed";

/** Broadcast a settings change so every mounted component re-reads it. */
export function notifySettingsChanged(): void {
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

function currentCurrency(): Currency {
  const raw = loadSettings().currency;
  return raw === "USD" || raw === "JPY" ? raw : "EUR";
}

export interface CurrencyView {
  currency: Currency;
  info: RateInfo;
  /** Formatted converted amount, or "" when the yen price is unknown. */
  format: (yen: number | null | undefined) => string;
  /** True while no live rate has been obtained yet. */
  isFallback: boolean;
}

/**
 * Converts yen at today's rate, everywhere, from one shared cached lookup.
 *
 * The rate is fetched once per session (and at most once per six hours across
 * sessions), then held in state so every price on screen moves together when
 * the user switches currency in Réglages.
 */
export function useCurrency(): CurrencyView {
  const [currency, setCurrency] = useState<Currency>(currentCurrency);
  const [entry, setEntry] = useState<Awaited<ReturnType<typeof fetchRates>> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchRates(controller.signal)
      .then(setEntry)
      .catch(() => setEntry(null));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const sync = () => setCurrency(currentCurrency());
    window.addEventListener(SETTINGS_EVENT, sync);
    // Keeps two tabs of the app in agreement.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const info = rateFor(entry, currency);

  return {
    currency,
    info,
    isFallback: info.source === "fallback",
    format: (yen) =>
      currency === "JPY" ? "" : formatConverted(convertFromYen(yen, info), currency),
  };
}
