import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  convertFromYen,
  fetchRates,
  formatConverted,
  rateFor,
} from "./exchange";

const FRANKFURTER = { date: "2026-08-13", rates: { EUR: 0.00544, USD: 0.00638 } };

function mockFetch(impl: (url: string) => unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const body = impl(String(url));
      if (body === null) return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
}

describe("live exchange rates", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("uses the primary provider and caches the result", async () => {
    mockFetch(() => FRANKFURTER);
    const first = await fetchRates();
    expect(first.source).toBe("frankfurter");
    expect(first.rates.EUR).toBe(0.00544);

    // A second call must not hit the network again.
    const spy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    await fetchRates();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to the second provider when the first fails", async () => {
    mockFetch((url) =>
      url.includes("frankfurter")
        ? null
        : { time_last_update_utc: "Wed, 13 Aug 2026", rates: { EUR: 0.0055, USD: 0.0064 } },
    );
    const entry = await fetchRates();
    expect(entry.source).toBe("erapi");
    expect(entry.rates.EUR).toBe(0.0055);
  });

  it("labels the offline fallback instead of inventing a live rate", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline");
    }));
    const entry = await fetchRates();
    expect(entry.source).toBe("fallback");
    const info = rateFor(entry, "EUR");
    expect(info.source).toBe("fallback");
    expect(info.date).toBeNull();
    expect(info.rate).toBeGreaterThan(0);
  });

  it("rejects an implausible rate rather than mispricing everything", async () => {
    // A payload in the wrong direction (JPY per EUR) would be ~160.
    mockFetch(() => ({ date: "2026-08-13", rates: { EUR: 160 } }));
    const entry = await fetchRates();
    expect(entry.source).toBe("fallback");
  });

  it("converts and formats per currency", () => {
    const entry = {
      rates: { EUR: 0.00544, USD: 0.00638, JPY: 1 },
      date: "2026-08-13",
      source: "frankfurter" as const,
      fetchedAt: Date.now(),
    };
    expect(convertFromYen(5_000_000, rateFor(entry, "EUR"))).toBeCloseTo(27_200, 0);
    expect(convertFromYen(null, rateFor(entry, "EUR"))).toBeNull();
    expect(formatConverted(27_200, "EUR")).toContain("27");
    expect(formatConverted(null, "EUR")).toBe("");
  });

  it("ignores a stale cache", async () => {
    localStorage.setItem(
      "akiya.fx.v1",
      JSON.stringify({
        rates: { EUR: 0.001 },
        date: "2000-01-01",
        source: "frankfurter",
        fetchedAt: Date.now() - 48 * 3600 * 1000,
      }),
    );
    mockFetch(() => FRANKFURTER);
    const entry = await fetchRates();
    expect(entry.rates.EUR).toBe(0.00544);
  });
});
