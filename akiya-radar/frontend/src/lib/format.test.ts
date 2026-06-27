import { describe, expect, it } from "vitest";

import { fmtArea, fmtEur, fmtYen, scoreColor, severityRank } from "./format";

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
