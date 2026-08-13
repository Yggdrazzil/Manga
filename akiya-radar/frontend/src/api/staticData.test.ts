import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStaticApi, StaticModeError, toCsv } from "./staticData";

const LISTING = {
  id: "abc123",
  source_url: "https://okinoshima-t32528.akiya-athome.jp/bukken/detail/buy/x-1",
  source_key: "athome-32528",
  title_original: "売戸建住宅【R1-1】",
  title_fr: null,
  summary_fr: null,
  price_yen: 5_000_000,
  price_eur: null,
  rent_yen_month: null,
  prefecture: "島根県",
  city: "隠岐の島町",
  lat: 36.21,
  lon: 133.24,
  geocode_accuracy: "approximate",
  land_area_m2: 218.45,
  building_area_m2: 184.73,
  build_year: 1970,
  floor_plan: "8DK",
  property_type: "house",
  transaction_type: "sale",
  listing_status: "active",
  personal_status: "new",
  favorite: false,
  rating: null,
  photo_urls: [],
  station_name: null,
  station_walk_minutes: null,
  station_distance_km: null,
  data_completeness: 100,
  created_at: "2026-08-13T00:00:00Z",
  flags: [],
  scores: [{ id: "s", total_score: 77, confidence_score: 67, created_at: "" }],
  hazard_scores: [],
  notes: [],
  tasks: [],
};

const SECOND = { ...LISTING, id: "def456", price_yen: 12_000_000, prefecture: "福井県", city: "敦賀市" };

function mockDataset(rows: unknown[] = [LISTING, SECOND]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("listings.json")) {
        return { ok: true, json: async () => rows };
      }
      return { ok: false, json: async () => ({}) };
    }),
  );
}

describe("static (serverless) API", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("serves listings from the published dataset", async () => {
    mockDataset();
    const api = createStaticApi();
    const page = await api.listings({});
    expect(page.total).toBe(2);
    expect(page.items[0].title_original).toContain("売戸建住宅");
  });

  it("filters and sorts entirely in the browser", async () => {
    mockDataset();
    const api = createStaticApi();
    expect((await api.listings({ prefecture: "福井県" })).total).toBe(1);
    expect((await api.listings({ max_price_yen: 6_000_000 })).total).toBe(1);
    const cheapest = await api.listings({ sort: "price_asc" });
    expect(cheapest.items[0].price_yen).toBe(5_000_000);
    expect((await api.listings({ query: "敦賀" })).total).toBe(1);
  });

  it("keeps favourites and statuses across reloads", async () => {
    mockDataset();
    const api = createStaticApi();
    await api.setFavorite("abc123", true);
    await api.updateListing("abc123", { personal_status: "very_interesting" });

    // A fresh adapter simulates a page reload: the dataset is immutable, the
    // user's state comes back from localStorage.
    const reloaded = createStaticApi();
    const listing = await reloaded.listing("abc123");
    expect(listing.favorite).toBe(true);
    expect(listing.personal_status).toBe("very_interesting");
  });

  it("counts local state in the dashboard", async () => {
    mockDataset();
    const api = createStaticApi();
    await api.setFavorite("abc123", true);
    const dash = await (createStaticApi()).dashboard();
    expect(dash.stats.total).toBe(2);
    expect(dash.stats.favorites).toBe(1);
  });

  it("stores notes and tasks locally", async () => {
    mockDataset();
    const api = createStaticApi();
    const note = await api.addNote("abc123", "Contacter la mairie");
    expect((await api.notes("abc123"))[0].note).toBe("Contacter la mairie");
    await api.deleteNote(note.id);
    expect(await api.notes("abc123")).toHaveLength(0);

    const task = await api.addTask("abc123", "Demander le cadastre");
    await api.updateTask(task.id, { status: "done" });
    expect((await api.tasks("abc123"))[0].status).toBe("done");
  });

  it("refuses server-only actions with an explicit message", async () => {
    mockDataset();
    const api = createStaticApi();
    await expect(api.importUrl("https://x.jp/1")).rejects.toBeInstanceOf(StaticModeError);
    await expect(api.refreshListing("abc123")).rejects.toBeInstanceOf(StaticModeError);
    await expect(api.catalogAdd(["k"], false)).rejects.toBeInstanceOf(StaticModeError);
    await expect(api.importUrl("https://x.jp/1")).rejects.toThrow(/mode serveur/);
  });

  it("explains a missing dataset instead of failing silently", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    await expect(createStaticApi().listings({})).rejects.toThrow(/introuvable/);
  });

  it("exports a CSV of the dataset", async () => {
    const csv = toCsv([LISTING] as never);
    expect(csv).toContain("売戸建住宅");
    expect(csv).toContain("島根県");
    expect(csv.split("\n")[0]).toContain("prix_yen");
  });
});
