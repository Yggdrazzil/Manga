/**
 * In-memory mock API for self-contained previews (no backend).
 * Activated at build time with VITE_MOCK=1. Never used in production.
 */
import type {
  DashboardResponse,
  Duplicate,
  Flag,
  ImportResult,
  ListingDetail,
  ListingFilters,
  ListingListResponse,
  Note,
  SavedSearch,
  Score,
  Source,
  Task,
} from "@/lib/types";

let seq = 1000;
const uid = () => `mock-${seq++}`;

function flag(code: string, label: string, sev: Flag["severity"], expl: string, act: string): Flag {
  return {
    id: uid(),
    flag_code: code,
    label_fr: label,
    severity: sev,
    explanation_fr: expl,
    recommended_action_fr: act,
  };
}

function score(total: number, parts: Partial<Score>, conf: number): Score {
  return {
    id: uid(),
    total_score: total,
    price_score: parts.price_score ?? 12,
    location_score: parts.location_score ?? 12,
    natural_risk_score: parts.natural_risk_score ?? 14,
    legal_risk_score: parts.legal_risk_score ?? 12,
    renovation_score: parts.renovation_score ?? 9,
    personal_fit_score: parts.personal_fit_score ?? 6,
    confidence_score: conf,
    explanation_fr: `Score : ${total}/100\n\nConfiance : ${
      conf >= 70 ? "élevée" : conf >= 45 ? "moyenne" : "faible"
    } (${conf}%).`,
    created_at: new Date().toISOString(),
  };
}

const FLAGS = {
  rebuild: () =>
    flag(
      "rebuild_forbidden",
      "Reconstruction impossible",
      "critical",
      "Le terrain ne permet pas de reconstruire. Valeur et revente limitées.",
      "Vérifier l'accès à la voirie et le statut en mairie.",
    ),
  leasehold: () =>
    flag(
      "leasehold_land",
      "Terrain en bail (pas pleine propriété)",
      "critical",
      "Vous achetez le bâtiment mais louez le terrain.",
      "Demander le contrat de bail et le loyer annuel.",
    ),
  tsunami: () =>
    flag(
      "tsunami_zone",
      "Zone inondable tsunami",
      "critical",
      "Zone exposée à une submersion selon les simulations officielles.",
      "Vérifier l'altitude et les voies d'évacuation.",
    ),
  roof: () =>
    flag(
      "roof_leak",
      "Fuite de toiture",
      "warning",
      "Infiltrations signalées : risque d'humidité et de pourriture.",
      "Faire inspecter la toiture et la charpente.",
    ),
  termites: () =>
    flag(
      "termites",
      "Termites",
      "warning",
      "Présence de termites : structure bois potentiellement compromise.",
      "Demander un diagnostic anti-termites.",
    ),
  repairs: () =>
    flag(
      "repairs_needed",
      "Réparations nécessaires",
      "warning",
      "Le vendeur signale des réparations à réaliser.",
      "Lister les réparations et obtenir des devis.",
    ),
  negotiating: () =>
    flag(
      "negotiating",
      "En négociation",
      "info",
      "Le bien fait l'objet d'une négociation en cours.",
      "Confirmer la disponibilité.",
    ),
};

function base(
  over: Partial<ListingDetail> & { id: string; source_url: string },
): ListingDetail {
  return {
    title_original: null,
    title_fr: null,
    summary_fr: null,
    price_yen: null,
    price_eur: null,
    prefecture: null,
    city: null,
    lat: null,
    lon: null,
    geocode_accuracy: null,
    land_area_m2: null,
    building_area_m2: null,
    build_year: null,
    property_type: null,
    listing_status: "active",
    personal_status: "new",
    favorite: false,
    rating: null,
    flags: [],
    scores: [],
    source_id: null,
    external_id: null,
    description_original: null,
    description_fr: null,
    price_text_original: null,
    address_text: null,
    floor_plan: null,
    transaction_type: "sale",
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_updated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
    tasks: [],
    price_history: [],
    ...over,
  };
}

const LISTINGS: ListingDetail[] = [
  base({
    id: "L1",
    source_url: "https://akiya.okinoshima.example.jp/bukken/okino-31",
    title_original: "隠岐の島町 海辺の一軒家 4LDK",
    summary_fr: "Bien : house, à 隠岐の島町, 島根県, prix 8 800 000 ¥, terrain 280 m², bâti 115 m².",
    description_original: "海辺の一軒家。4LDK。広い庭。リフォーム済みで即入居可能。駐車場3台。眺望良好。",
    description_fr:
      "[Traduction automatique indisponible — texte original conservé] Maison en bord de mer, 4LDK, grand jardin, rénovée, emménagement immédiat.",
    price_yen: 8800000,
    price_eur: 52800,
    price_text_original: "880万円",
    prefecture: "島根県",
    city: "隠岐の島町",
    address_text: "島根県隠岐郡隠岐の島町都万",
    lat: 36.145,
    lon: 133.198,
    geocode_accuracy: "exact",
    land_area_m2: 280,
    building_area_m2: 115,
    floor_plan: "4LDK",
    build_year: 2005,
    property_type: "house",
    personal_status: "very_interesting",
    favorite: true,
    rating: 4,
    scores: [score(74, { price_score: 12, location_score: 18, renovation_score: 13 }, 67)],
    price_history: [
      { id: uid(), price_yen: 9500000, detected_at: "2026-05-01T00:00:00Z", source_url: null },
      { id: uid(), price_yen: 8800000, detected_at: "2026-06-15T00:00:00Z", source_url: null },
    ],
    notes: [{ id: uid(), note: "Contacter la mairie pour une visite en septembre.", created_at: "", updated_at: "" }],
    tasks: [{ id: uid(), title: "Demander les plans cadastraux", status: "todo", due_date: null, created_at: "", updated_at: "" }],
  }),
  base({
    id: "L2",
    source_url: "https://akiya.tsuruga.example.jp/bukken/0001",
    title_original: "敦賀市 古民家 平屋 5DK 海まで徒歩10分",
    summary_fr: "Bien : kominka, à 敦賀市, 福井県, prix 3 800 000 ¥, terrain 220.5 m², bâti 98.2 m².",
    description_original: "築昭和48年の古民家です。5DK、広い庭付き。老朽化が進んでおり要修繕。雨漏りの跡があります。浄化槽。駐車場2台。",
    description_fr: "[Traduction automatique indisponible — texte original conservé] Kominka de 1973, 5DK, grand jardin, vétuste, traces de fuite de toiture.",
    price_yen: 3800000,
    price_eur: 22800,
    price_text_original: "380万円",
    prefecture: "福井県",
    city: "敦賀市",
    address_text: "福井県敦賀市櫛川",
    lat: 35.6536,
    lon: 136.0758,
    geocode_accuracy: "exact",
    land_area_m2: 220.5,
    building_area_m2: 98.2,
    floor_plan: "5DK",
    build_year: 1973,
    property_type: "kominka",
    personal_status: "interesting",
    favorite: true,
    flags: [FLAGS.roof(), FLAGS.repairs()],
    scores: [score(62, { price_score: 13, renovation_score: 5, legal_risk_score: 15 }, 67)],
  }),
  base({
    id: "L3",
    source_url: "https://homes.example.co.jp/akiyabank/bukken/aki-9001",
    title_original: "大分県 由布市 温泉付き 戸建て 3LDK",
    summary_fr: "Bien : house, à 由布市, 大分県, prix 12 500 000 ¥, terrain 250 m², bâti 110 m².",
    description_original: "由布院近くの戸建て。3LDK。温泉引き込み可能。状態良好でリフォーム不要。駐車場あり。観光地に近い好立地。",
    description_fr: "Maison près de Yufuin, 3LDK, source chaude, bon état, proche des sites touristiques.",
    price_yen: 12500000,
    price_eur: 75000,
    price_text_original: "1,250万円",
    prefecture: "大分県",
    city: "由布市",
    address_text: "大分県由布市湯布院町",
    lat: 33.264,
    lon: 131.354,
    geocode_accuracy: "exact",
    land_area_m2: 250,
    building_area_m2: 110,
    floor_plan: "3LDK",
    build_year: 2010,
    property_type: "house",
    personal_status: "interesting",
    scores: [score(70, { price_score: 10, location_score: 16, renovation_score: 15 }, 67)],
  }),
  base({
    id: "L4",
    source_url: "https://akiya.okinoshima.example.jp/bukken/okino-12",
    title_original: "隠岐の島町 一戸建て 3LDK 再建築不可",
    summary_fr: "Bien : house, à 隠岐の島町, 島根県, prix 1 500 000 ¥, terrain 160 m², bâti 82 m².",
    description_original: "海が見える高台の一戸建て。3LDK。再建築不可のため現況のままご利用ください。シロアリの被害が一部あり。残置物あり。",
    description_fr: "Maison sur hauteur avec vue mer, 3LDK. Reconstruction impossible. Dégâts de termites.",
    price_yen: 1500000,
    price_eur: 9000,
    price_text_original: "150万円",
    prefecture: "島根県",
    city: "隠岐の島町",
    address_text: "島根県隠岐郡隠岐の島町",
    lat: 36.2095,
    lon: 133.322,
    geocode_accuracy: "approximate",
    land_area_m2: 160,
    building_area_m2: 82,
    floor_plan: "3LDK",
    build_year: 1981,
    property_type: "house",
    personal_status: "needs_verification",
    flags: [FLAGS.rebuild(), FLAGS.termites()],
    scores: [score(58, { price_score: 16, legal_risk_score: 7, renovation_score: 8 }, 50)],
  }),
  base({
    id: "L5",
    source_url: "https://homes.example.co.jp/akiyabank/bukken/aki-3001",
    title_original: "南房総市 別荘向き 2LDK 海近",
    summary_fr: "Bien : house, à 南房総市, 千葉県, prix 6 800 000 ¥, terrain 140 m², bâti 70.5 m².",
    description_original: "南房総の別荘向き物件。2LDK。津波浸水想定区域に含まれます。上水道なし、井戸利用。リフォーム済みで状態良好。",
    description_fr: "Maison de villégiature, 2LDK. Zone inondable tsunami. Pas d'eau courante (puits).",
    price_yen: 6800000,
    price_eur: 40800,
    price_text_original: "680万円",
    prefecture: "千葉県",
    city: "南房総市",
    address_text: "千葉県南房総市千倉町",
    lat: 34.987,
    lon: 139.945,
    geocode_accuracy: "approximate",
    land_area_m2: 140,
    building_area_m2: 70.5,
    floor_plan: "2LDK",
    build_year: 1998,
    property_type: "house",
    personal_status: "to_review",
    flags: [FLAGS.tsunami()],
    scores: [score(65, { natural_risk_score: 8, renovation_score: 13 }, 50)],
  }),
  base({
    id: "L6",
    source_url: "https://akiya.tsuruga.example.jp/bukken/0014",
    title_original: "敦賀市中心部 町家 4DK 商談中",
    summary_fr: "Bien : machiya, à 敦賀市, 福井県, prix 1 200 000 ¥, terrain 95 m², bâti 88 m².",
    description_original: "敦賀駅徒歩8分の町家。4DK。商談中。借地権物件のためご注意ください。リノベーション向き。",
    description_fr: "Machiya à 8 min de la gare, 4DK. En négociation. Terrain en bail.",
    price_yen: 1200000,
    price_eur: 7200,
    price_text_original: "120万円",
    prefecture: "福井県",
    city: "敦賀市",
    address_text: "福井県敦賀市相生町",
    lat: 35.645,
    lon: 136.0555,
    geocode_accuracy: "exact",
    land_area_m2: 95,
    building_area_m2: 88,
    floor_plan: "4DK",
    build_year: 1958,
    property_type: "machiya",
    listing_status: "under_negotiation",
    personal_status: "abandoned",
    flags: [FLAGS.leasehold(), FLAGS.negotiating()],
    scores: [score(48, { legal_risk_score: 9, price_score: 16 }, 67)],
  }),
];

// ---- in-memory helpers ----
const byId = (id: string) => LISTINGS.find((l) => l.id === id);

const SOURCES: Source[] = [
  {
    id: "S1",
    name: "つるが暮らし 空き家バンク",
    source_type: "municipal_akiya_bank",
    base_url: "https://akiya.tsuruga.example.jp",
    municipality: "敦賀市",
    prefecture: "福井県",
    crawl_enabled: true,
    crawl_frequency_days: 7,
    last_crawled_at: "2026-06-28T21:00:00Z",
    last_error: null,
    created_at: "",
    updated_at: "",
  },
  {
    id: "S2",
    name: "隠岐の島町 空き家バンク",
    source_type: "municipal_akiya_bank",
    base_url: "https://akiya.okinoshima.example.jp",
    municipality: "隠岐の島町",
    prefecture: "島根県",
    crawl_enabled: false,
    crawl_frequency_days: 7,
    last_crawled_at: null,
    last_error: null,
    created_at: "",
    updated_at: "",
  },
];

const SAVED: SavedSearch[] = [
  {
    id: "SS1",
    name: "Îles & bord de mer < 900万",
    criteria_json: { prefecture: "島根県", max_price_yen: 9000000 },
    alert_enabled: true,
    alert_frequency: "weekly",
    last_checked_at: null,
    created_at: "",
    updated_at: "",
  },
];

const delay = <T>(v: T): Promise<T> => new Promise((r) => setTimeout(() => r(v), 120));

function filterListings(f: ListingFilters) {
  let items = [...LISTINGS];
  if (f.prefecture) items = items.filter((l) => l.prefecture === f.prefecture);
  if (f.city) items = items.filter((l) => l.city === f.city);
  if (f.max_price_yen != null) items = items.filter((l) => (l.price_yen ?? Infinity) <= f.max_price_yen!);
  if (f.min_land_area_m2 != null) items = items.filter((l) => (l.land_area_m2 ?? 0) >= f.min_land_area_m2!);
  if (f.favorite) items = items.filter((l) => l.favorite);
  if (f.personal_status) items = items.filter((l) => l.personal_status === f.personal_status);
  if (f.min_score != null)
    items = items.filter((l) => (l.scores.at(-1)?.total_score ?? 0) >= f.min_score!);
  if (f.exclude_critical_flags)
    items = items.filter((l) => !l.flags.some((x) => x.severity === "critical"));
  if (f.query) {
    const q = f.query.toLowerCase();
    items = items.filter((l) =>
      [l.title_original, l.title_fr, l.city, l.prefecture, l.summary_fr]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q)),
    );
  }
  return items;
}

// Authored French translations so the on-demand "Traduire" action shows real
// output in the server-less preview (the live app uses the backend provider).
const FR_MAP: Record<string, string> = {
  "隠岐の島町 海辺の一軒家 4LDK": "Oki-no-shima — maison individuelle en bord de mer, 4LDK",
  "海辺の一軒家。4LDK。広い庭。リフォーム済みで即入居可能。駐車場3台。眺望良好。":
    "Maison individuelle en bord de mer. 4LDK. Grand jardin. Rénovée, emménagement immédiat possible. 3 places de parking. Belle vue.",
  "敦賀市 古民家 平屋 5DK 海まで徒歩10分":
    "Tsuruga — kominka de plain-pied, 5DK, à 10 min à pied de la mer",
  "築昭和48年の古民家です。5DK、広い庭付き。老朽化が進んでおり要修繕。雨漏りの跡があります。浄化槽。駐車場2台。":
    "Kominka construite en 1973 (ère Shōwa 48). 5DK avec grand jardin. Vétusté avancée, réparations nécessaires. Traces de fuites de toiture. Fosse septique. 2 places de parking.",
  "大分県 由布市 温泉付き 戸建て 3LDK":
    "Préfecture d'Ōita, Yufu — maison avec source chaude (onsen), 3LDK",
  "由布院近くの戸建て。3LDK。温泉引き込み可能。状態良好でリフォーム不要。駐車場あり。観光地に近い好立地。":
    "Maison proche de Yufuin. 3LDK. Raccordement à une source chaude (onsen) possible. Bon état, aucune rénovation nécessaire. Parking. Bien située, proche des sites touristiques.",
  "隠岐の島町 一戸建て 3LDK 再建築不可":
    "Oki-no-shima — maison individuelle 3LDK, reconstruction impossible",
  "海が見える高台の一戸建て。3LDK。再建築不可のため現況のままご利用ください。シロアリの被害が一部あり。残置物あり。":
    "Maison sur les hauteurs avec vue sur la mer. 3LDK. Reconstruction impossible : à utiliser en l'état. Dégâts de termites par endroits. Objets laissés sur place par l'ancien occupant.",
  "南房総市 別荘向き 2LDK 海近":
    "Minamibōsō — idéale résidence secondaire, 2LDK, proche de la mer",
  "南房総の別荘向き物件。2LDK。津波浸水想定区域に含まれます。上水道なし、井戸利用。リフォーム済みで状態良好。":
    "Bien de type résidence secondaire à Minamibōsō. 2LDK. Situé en zone de submersion prévue par tsunami. Pas d'eau courante (utilisation d'un puits). Rénové, en bon état.",
  "敦賀市中心部 町家 4DK 商談中":
    "Centre de Tsuruga — machiya (maison de ville) 4DK, en cours de négociation",
  "敦賀駅徒歩8分の町家。4DK。商談中。借地権物件のためご注意ください。リノベーション向き。":
    "Machiya à 8 min à pied de la gare de Tsuruga. 4DK. En cours de négociation. Attention : terrain en bail (pas la pleine propriété). Idéale pour une rénovation.",
};

export function createMockApi() {
  return {
    dashboard: (): Promise<DashboardResponse> =>
      delay({
        stats: {
          total: LISTINGS.length,
          new: LISTINGS.filter((l) => l.personal_status === "new").length,
          favorites: LISTINGS.filter((l) => l.favorite).length,
          very_interesting: LISTINGS.filter((l) => l.personal_status === "very_interesting").length,
          critical_flags: LISTINGS.filter((l) => l.flags.some((f) => f.severity === "critical")).length,
          open_tasks: LISTINGS.reduce((n, l) => n + l.tasks.filter((t) => t.status !== "done").length, 0),
        },
        top_opportunities: [...LISTINGS]
          .sort((a, b) => (b.scores.at(-1)?.total_score ?? 0) - (a.scores.at(-1)?.total_score ?? 0))
          .slice(0, 5),
        recent_listings: LISTINGS.slice(0, 6),
      }),

    listings: (f: ListingFilters = {}): Promise<ListingListResponse> => {
      const items = filterListings(f);
      const offset = f.offset ?? 0;
      const limit = f.limit ?? 12;
      return delay({ items: items.slice(offset, offset + limit), total: items.length, limit, offset });
    },

    listing: (id: string): Promise<ListingDetail> => delay(byId(id) ?? LISTINGS[0]),

    setFavorite: (id: string, favorite: boolean): Promise<ListingDetail> => {
      const l = byId(id);
      if (l) l.favorite = favorite;
      return delay(l ?? LISTINGS[0]);
    },

    updateListing: (id: string, body: Record<string, unknown>): Promise<ListingDetail> => {
      const l = byId(id);
      if (l) Object.assign(l, body);
      return delay(l ?? LISTINGS[0]);
    },

    deleteListing: (): Promise<void> => delay(undefined),
    enrich: (id: string): Promise<ListingDetail> => delay(byId(id) ?? LISTINGS[0]),
    rescore: (id: string): Promise<ListingDetail> => delay(byId(id) ?? LISTINGS[0]),
    detectFlags: (id: string): Promise<ListingDetail> => delay(byId(id) ?? LISTINGS[0]),

    importUrl: (url: string): Promise<ImportResult> =>
      delay({
        listing: base({ id: uid(), source_url: url, listing_status: "unknown", summary_fr: "Résumé indisponible (démo)." }),
        fetched: false,
        fields_filled: [],
        possible_duplicates: [] as Duplicate[],
      }),

    duplicates: (): Promise<Duplicate[]> => delay([]),

    translateText: (text: string): Promise<{ translated: string; provider: string }> =>
      delay({
        translated: FR_MAP[text] ?? `(traduction de démonstration) ${text}`,
        provider: "demo",
      }),

    notes: (id: string): Promise<Note[]> => delay(byId(id)?.notes ?? []),
    addNote: (id: string, note: string): Promise<Note> => {
      const n: Note = { id: uid(), note, created_at: new Date().toISOString(), updated_at: "" };
      byId(id)?.notes.unshift(n);
      return delay(n);
    },
    deleteNote: (): Promise<void> => delay(undefined),

    tasks: (id: string): Promise<Task[]> => delay(byId(id)?.tasks ?? []),
    addTask: (id: string, title: string): Promise<Task> => {
      const t: Task = { id: uid(), title, status: "todo", due_date: null, created_at: "", updated_at: "" };
      byId(id)?.tasks.unshift(t);
      return delay(t);
    },
    updateTask: (taskId: string, body: Record<string, unknown>): Promise<Task> => {
      for (const l of LISTINGS) {
        const t = l.tasks.find((x) => x.id === taskId);
        if (t) {
          Object.assign(t, body);
          return delay(t);
        }
      }
      return delay({ id: taskId, title: "", status: "todo", due_date: null, created_at: "", updated_at: "" });
    },
    deleteTask: (): Promise<void> => delay(undefined),

    sources: (): Promise<Source[]> => delay(SOURCES),
    createSource: (b: Record<string, unknown>): Promise<Source> => {
      const s = { ...SOURCES[0], ...b, id: uid() } as Source;
      SOURCES.unshift(s);
      return delay(s);
    },

    savedSearches: (): Promise<SavedSearch[]> => delay(SAVED),
    createSavedSearch: (b: Record<string, unknown>): Promise<SavedSearch> => {
      const s = { ...SAVED[0], ...b, id: uid() } as SavedSearch;
      SAVED.unshift(s);
      return delay(s);
    },
    runSavedSearch: (): Promise<ListingDetail[]> =>
      delay(filterListings(SAVED[0].criteria_json as ListingFilters)),
    deleteSavedSearch: (): Promise<void> => delay(undefined),
  };
}
