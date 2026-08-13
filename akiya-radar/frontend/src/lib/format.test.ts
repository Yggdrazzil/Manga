import { describe, expect, it } from "vitest";

import { completenessLabel, fmtArea, fmtEur, fmtPricePerM2, fmtStation, fmtYen, pricePerM2, riskRank, riskTone, scoreColor, severityRank } from "./format";

describe("format", () => {
  it("formats yen with separators", () => {
    expect(fmtYen(3800000)).toMatch(/3\s?800\s?000\s?¥/);
  });

  it("marks free transfers", () => {
    expect(fmtYen(0)).toContain("譲渡");
  });

  it("returns dash for missing values", () => {
    expect(fmtYen(null)).toBe("—");
    expect(fmtArea(undefined)).toBe("—");
    expect(fmtEur(null)).toBe("");
  });

  it("colours scores by band", () => {
    expect(scoreColor(80)).toContain("moss");
    expect(scoreColor(55)).toContain("gold");
    expect(scoreColor(30)).toContain("vermilion");
    expect(scoreColor(null)).toContain("mute");
  });

  it("ranks severities critical < warning < info", () => {
    expect(severityRank("critical")).toBeLessThan(severityRank("warning"));
    expect(severityRank("warning")).toBeLessThan(severityRank("info"));
  });
});

describe("comparability helpers", () => {
  it("computes yen per m² of land", () => {
    expect(pricePerM2(3_800_000, 220)).toBe(17273);
    expect(pricePerM2(3_800_000, 0)).toBeNull();
    expect(pricePerM2(null, 220)).toBeNull();
    expect(fmtPricePerM2(null)).toBe("—");
  });

  it("reports the station distance the source actually gave", () => {
    expect(fmtStation(13, null)).toBe("13 min à pied");
    expect(fmtStation(null, 2)).toBe("2 km");
    expect(fmtStation(null, null)).toBeNull();
  });

  it("keeps an unverified hazard visually distinct from a clear one", () => {
    expect(riskTone("unknown")).not.toBe(riskTone("none"));
    expect(riskRank("unknown")).toBeLessThan(riskRank("none"));
    expect(riskRank("very_high")).toBeGreaterThan(riskRank("high"));
  });

  it("describes completeness in plain French", () => {
    expect(completenessLabel(94)).toBe("Fiche complète");
    expect(completenessLabel(55)).toBe("Fiche partielle");
    expect(completenessLabel(10)).toBe("Fiche très incomplète");
    expect(completenessLabel(null)).toBe("Complétude inconnue");
  });
});
