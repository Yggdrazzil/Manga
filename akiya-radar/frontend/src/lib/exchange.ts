/**
 * Live currency conversion, computed in the browser at display time.
 *
 * The backend used to convert yen to euros *at import time* and store the
 * result, which froze every listing at the rate of the day it was discovered:
 * a house imported six months ago showed a euro price nobody could reproduce.
 * Yen is the only figure the source actually publishes, so it is the only one
 * stored; everything else is derived here, from a rate refreshed daily.
 *
 * Both providers are free, key-less and send `Access-Control-Allow-Origin: *`,
 * so this works with or without a backend.
 */

export type Currency = "EUR" | "USD" | "JPY";

export interface RateInfo {
  /** Units of `currency` per 1 JPY. */
  rate: number;
  currency: Currency;
  /** Date the rate was published (ISO), or null for the offline fallback. */
  date: string | null;
  source: "frankfurter" | "erapi" | "fallback";
}

const CACHE_KEY = "akiya.fx.v1";
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Last-resort rates, used only when every provider is unreachable. They are
 * deliberately labelled `fallback` so the UI can say the figure is indicative
 * rather than quietly presenting a stale number as today's rate.
 */
const FALLBACK: Record<Currency, number> = { EUR: 0.0055, USD: 0.0064, JPY: 1 };

// JPY→EUR/USD has stayed far inside this band for decades; anything outside it
// means the payload is not what we think it is.
const PLAUSIBLE = { min: 0.001, max: 0.05 };

interface CacheEntry {
  rates: Partial<Record<Currency, number>>;
  date: string | null;
  source: RateInfo["source"];
  fetchedAt: number;
}

function readCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.fetchedAt > TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CacheEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    /* private mode or full quota — the in-memory value still works */
  }
}

function isPlausible(value: unknown): value is number {
  return typeof value === "number" && value > PLAUSIBLE.min && value < PLAUSIBLE.max;
}

async function fromFrankfurter(signal?: AbortSignal): Promise<CacheEntry | null> {
  const resp = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=JPY&symbols=EUR,USD",
    { signal },
  );
  if (!resp.ok) return null;
  const body = (await resp.json()) as { date?: string; rates?: Record<string, number> };
  const eur = body.rates?.EUR;
  const usd = body.rates?.USD;
  if (!isPlausible(eur)) return null;
  return {
    rates: { EUR: eur, USD: isPlausible(usd) ? usd : undefined, JPY: 1 },
    date: body.date ?? null,
    source: "frankfurter",
    fetchedAt: Date.now(),
  };
}

async function fromErApi(signal?: AbortSignal): Promise<CacheEntry | null> {
  const resp = await fetch("https://open.er-api.com/v6/latest/JPY", { signal });
  if (!resp.ok) return null;
  const body = (await resp.json()) as {
    time_last_update_utc?: string;
    rates?: Record<string, number>;
  };
  const eur = body.rates?.EUR;
  const usd = body.rates?.USD;
  if (!isPlausible(eur)) return null;
  return {
    rates: { EUR: eur, USD: isPlausible(usd) ? usd : undefined, JPY: 1 },
    date: body.time_last_update_utc?.slice(0, 16) ?? null,
    source: "erapi",
    fetchedAt: Date.now(),
  };
}

/**
 * Current rates, from cache when fresh, otherwise from the first provider that
 * answers. Never throws: an unreachable network yields the labelled fallback.
 */
export async function fetchRates(signal?: AbortSignal): Promise<CacheEntry> {
  const cached = readCache();
  if (cached) return cached;

  for (const provider of [fromFrankfurter, fromErApi]) {
    try {
      const entry = await provider(signal);
      if (entry) {
        writeCache(entry);
        return entry;
      }
    } catch {
      /* try the next provider */
    }
  }
  return { rates: {}, date: null, source: "fallback", fetchedAt: Date.now() };
}

export function rateFor(entry: CacheEntry | null, currency: Currency): RateInfo {
  const live = entry?.rates?.[currency];
  if (live !== undefined) {
    return { rate: live, currency, date: entry?.date ?? null, source: entry!.source };
  }
  return { rate: FALLBACK[currency], currency, date: null, source: "fallback" };
}

export function convertFromYen(yen: number | null | undefined, info: RateInfo): number | null {
  if (yen === null || yen === undefined) return null;
  return yen * info.rate;
}

const CURRENCY_LOCALE: Record<Currency, string> = {
  EUR: "fr-FR",
  USD: "en-US",
  JPY: "ja-JP",
};

export function formatConverted(value: number | null, currency: Currency): string {
  if (value === null) return "";
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}
