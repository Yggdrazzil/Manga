/**
 * In-memory mock API for self-contained previews (no backend).
 * Activated at build time with VITE_MOCK=1. Never used in production.
 */
import type {
  CatalogEntry,
  CatalogPrefecture,
  CatalogResponse,
  CompsResult,
  RefreshResult,
  StationResult,
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


// Demo photos: self-contained SVG kominka illustrations. No network calls and
// no random stock-photo service (one of those once served an ISS photo here).
function demoPhoto(variant: number, label: string): string {
  const skies = ["#e8e0d0", "#dfe6e2", "#e6dede"];
  const accents = ["#c93a2b", "#b07d2c", "#3d5a80"];
  const sky = skies[variant % skies.length];
  const accent = accents[variant % accents.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
  <rect width="800" height="500" fill="${sky}"/>
  <circle cx="650" cy="110" r="52" fill="${accent}" opacity="0.85"/>
  <path d="M0 340 L140 240 L260 330 L380 250 L520 340 L800 300 L800 500 L0 500 Z" fill="#c9c2b2"/>
  <path d="M150 380 L400 250 L650 380 L610 380 L400 275 L190 380 Z" fill="#2b2320"/>
  <rect x="215" y="378" width="370" height="122" fill="#f2ead8" stroke="#2b2320" stroke-width="6"/>
  <rect x="255" y="405" width="70" height="95" fill="#8a7a62"/>
  <rect x="360" y="405" width="80" height="60" fill="#d8d2c0" stroke="#2b2320" stroke-width="5"/>
  <line x1="400" y1="405" x2="400" y2="465" stroke="#2b2320" stroke-width="5"/>
  <rect x="470" y="405" width="80" height="60" fill="#d8d2c0" stroke="#2b2320" stroke-width="5"/>
  <line x1="510" y1="405" x2="510" y2="465" stroke="#2b2320" stroke-width="5"/>
  <text x="24" y="478" font-family="serif" font-size="30" fill="#2b2320" opacity="0.55">${label} — photo de démo</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

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
    source_key: null,
    external_id: null,
    description_original: null,
    description_fr: null,
    price_text_original: null,
    address_text: null,
    floor_plan: null,
    transaction_type: "sale",
    rent_yen_month: null,
    station_name: null,
    station_line: null,
    station_walk_minutes: null,
    station_distance_km: null,
    data_completeness: null,
    zoning: null,
    structure: null,
    land_rights: null,
    parking: null,
    current_state: null,
    features: null,
    utilities: null,
    elevation_m: null,
    field_provenance: null,
    first_seen_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    source_updated_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    notes: [],
    tasks: [],
    price_history: [],
    hazard_scores: [],
    ...over,
  };
}

const LISTINGS: ListingDetail[] = [
  base({
    id: "L1",
    hazard_scores: [
      {
        id: uid(),
        flood_risk: "none",
        tsunami_risk: "none",
        landslide_risk: "none",
        storm_surge_risk: "none",
        earthquake_risk: "low",
        source_name: "J-SHIS Y2024 + 重ねるハザードマップ — démo",
        raw_json: null,
        created_at: "",
      },
    ],
    data_completeness: 94,
    station_name: "西郷港",
    station_distance_km: 4.2,
    zoning: "指定なし",
    structure: "木造",
    parking: "空有",
    current_state: "空",
    elevation_m: 18.4,
    utilities: ["上水道", "下水道", "プロパンガス", "バス", "トイレ"],
    features: ["南向", "海が見える", "駐車場3台以上", "リフォーム済"],
    source_key: "athome-32528",
    field_provenance: {
      price_yen: { label: "価格", text: "880万円" },
      land_area_m2: { label: "土地面積", text: "280㎡" },
      zoning: { label: "用途地域", text: "指定なし" },
    },
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
    lat: 36.21315,
    lon: 133.24324,
    geocode_accuracy: "approximate",
    land_area_m2: 280,
    building_area_m2: 115,
    floor_plan: "4LDK",
    build_year: 2005,
    property_type: "house",
    personal_status: "very_interesting",
    favorite: true,
    rating: 4,
    photo_urls: [demoPhoto(0, "隠岐の島町"), demoPhoto(1, "隠岐の島町 · 庭"), demoPhoto(2, "隠岐の島町 · 海")],
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
    hazard_scores: [
      {
        id: uid(),
        flood_risk: "medium",
        tsunami_risk: "none",
        landslide_risk: "none",
        storm_surge_risk: "none",
        earthquake_risk: "high",
        source_name: "J-SHIS Y2024 + 重ねるハザードマップ — démo",
        raw_json: null,
        created_at: "",
      },
    ],
    data_completeness: 88,
    station_name: "敦賀駅",
    station_line: "ハピラインふくい",
    station_distance_km: 3.1,
    zoning: "1種住居",
    structure: "木造",
    parking: "空有",
    current_state: "空",
    elevation_m: 2.1,
    utilities: ["上水道", "浄化槽", "プロパンガス"],
    features: ["広い庭", "駐車場2台", "平屋"],
    source_key: "athome-18202",
    field_provenance: {
      price_yen: { label: "価格", text: "380万円" },
      build_year: { label: "築年月", text: "昭和48年" },
      station_name: { label: "交通", text: "ハピラインふくい 敦賀駅 / 車3.1km" },
    },
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
    lat: 35.654671,
    lon: 136.042694,
    geocode_accuracy: "approximate",
    land_area_m2: 220.5,
    building_area_m2: 98.2,
    floor_plan: "5DK",
    build_year: 1973,
    property_type: "kominka",
    personal_status: "interesting",
    favorite: true,
    photo_urls: [demoPhoto(1, "敦賀市"), demoPhoto(2, "敦賀市 · 内装")],
    flags: [FLAGS.roof(), FLAGS.repairs()],
    scores: [score(62, { price_score: 13, renovation_score: 5, legal_risk_score: 15 }, 67)],
  }),
  base({
    id: "L3",
    hazard_scores: [
      {
        id: uid(),
        flood_risk: "none",
        tsunami_risk: "none",
        landslide_risk: "high",
        storm_surge_risk: "none",
        earthquake_risk: "medium",
        source_name: "J-SHIS Y2024 + 重ねるハザードマップ — démo",
        raw_json: null,
        created_at: "",
      },
    ],
    data_completeness: 76,
    station_name: "由布院駅",
    station_line: "JR久大本線",
    station_walk_minutes: 18,
    zoning: "1種低層",
    structure: "木造",
    current_state: "空",
    elevation_m: 339.8,
    utilities: ["公営水道", "都市ガス", "温泉引込可"],
    features: ["温泉付", "リフォーム不要", "観光地近く"],
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
    lat: 33.196159,
    lon: 131.349655,
    geocode_accuracy: "approximate",
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
    data_completeness: 58,
    zoning: "指定なし",
    structure: "木造",
    current_state: "空",
    elevation_m: 42.0,
    utilities: ["上水道"],
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
    lat: 36.213398,
    lon: 133.311829,
    geocode_accuracy: "city",
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
    hazard_scores: [
      {
        id: uid(),
        flood_risk: "none",
        tsunami_risk: "high",
        landslide_risk: "none",
        storm_surge_risk: "none",
        earthquake_risk: "medium",
        source_name: "J-SHIS Y2024 + 重ねるハザードマップ — démo",
        raw_json: null,
        created_at: "",
      },
    ],
    data_completeness: 64,
    station_name: "千倉駅",
    station_line: "JR内房線",
    station_walk_minutes: 22,
    zoning: "指定なし",
    structure: "木造",
    current_state: "空",
    elevation_m: 13.0,
    utilities: ["井戸", "プロパンガス"],
    features: ["別荘向き", "海近"],
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
    lat: 34.934258,
    lon: 139.948578,
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
    hazard_scores: [
      {
        id: uid(),
        flood_risk: "medium",
        tsunami_risk: "none",
        landslide_risk: "none",
        storm_surge_risk: "none",
        earthquake_risk: "high",
        source_name: "J-SHIS Y2024 + 重ねるハザードマップ — démo",
        raw_json: null,
        created_at: "",
      },
    ],
    data_completeness: 71,
    station_name: "敦賀駅",
    station_line: "ハピラインふくい",
    station_walk_minutes: 8,
    zoning: "商業地域",
    structure: "木造",
    land_rights: "借地権",
    current_state: "空",
    elevation_m: 4.5,
    utilities: ["公営水道", "都市ガス"],
    features: ["駅近", "リノベーション向き"],
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
    lat: 35.655514,
    lon: 136.068314,
    geocode_accuracy: "approximate",
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

// Real entries sampled from the bundled catalogue (backend/app/data/
// source_catalog.json) so the preview browses genuine akiya-bank sources.
const CATALOG: CatalogEntry[] = [
  {
    "key": "ieichiba",
    "name": "Ieichiba — petites annonces entre particuliers",
    "source_type": "other",
    "url": "https://www.ieichiba.com/",
    "prefecture": null,
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "national",
    "notes_fr": "Biens ruraux proposés directement par leurs propriétaires, souvent absents des banques municipales. Les annonces sont chargées en JavaScript : consultation manuelle puis « Importer une URL ».",
    "registered": false
  },
  {
    "key": "join-akiyabank",
    "name": "JOIN — portail national migration & akiya",
    "source_type": "public_dataset",
    "url": "https://www.iju-join.jp/akiyabank/",
    "prefecture": null,
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "national",
    "notes_fr": "Portail national de la mobilité résidentielle : utile pour découvrir les dispositifs d'aide commune par commune.",
    "registered": false
  },
  {
    "key": "mlit-directory",
    "name": "Répertoire officiel MLIT des banques d'akiya",
    "source_type": "public_dataset",
    "url": "https://www.mlit.go.jp/totikensangyo/const/akiyabank_link.html",
    "prefecture": null,
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "national",
    "notes_fr": "Annuaire gouvernemental de toutes les banques d'akiya municipales. Sert de référence : c'est la source de ce catalogue.",
    "registered": false
  },
  {
    "key": "athome-national",
    "name": "At Home — banque d'akiya nationale",
    "source_type": "athome_akiya_bank",
    "url": "https://www.akiya-athome.jp/",
    "prefecture": null,
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "national",
    "notes_fr": "Portail national. Les fiches exploitables sont sur les sites communaux dédiés (un sous-domaine par commune), pré-enregistrés ici.",
    "registered": false
  },
  {
    "key": "lifull-national",
    "name": "LIFULL HOME'S — banque d'akiya nationale",
    "source_type": "lifull_akiya_bank",
    "url": "https://www.homes.co.jp/akiyabank/",
    "prefecture": null,
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "national",
    "notes_fr": "Consultation manuelle uniquement : le site renvoie 403 aux robots. Utilisez « Importer une URL » pour récupérer une fiche précise.",
    "registered": false
  },
  {
    "key": "athome-01222",
    "name": "三笠市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mikasa-c01222.akiya-athome.jp/",
    "prefecture": "北海道",
    "municipality": "三笠市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-01635",
    "name": "上川郡新得町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://shintoku-t01635.akiya-athome.jp/",
    "prefecture": "北海道",
    "municipality": "上川郡新得町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-01453",
    "name": "上川郡東神楽町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://higashikagura-t01453.akiya-athome.jp/",
    "prefecture": "北海道",
    "municipality": "上川郡東神楽町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-park21-wakwak-com-hkss-akiyabank-html",
    "name": "しりべし空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://park21.wakwak.com/~hkss/akiyabank.html",
    "prefecture": "北海道",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-fukushima-iju-jp",
    "name": "ふくしまぐらし。",
    "source_type": "public_dataset",
    "url": "https://www.fukushima-iju.jp/",
    "prefecture": "福島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-07204",
    "name": "いわき市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://iwaki-c07204.akiya-athome.jp/",
    "prefecture": "福島県",
    "municipality": "いわき市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-07210",
    "name": "二本松市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nihonmatsu-c07210.akiya-athome.jp/",
    "prefecture": "福島県",
    "municipality": "二本松市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-07213",
    "name": "伊達市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://date-c07213.akiya-athome.jp/",
    "prefecture": "福島県",
    "municipality": "伊達市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-pref-fukushima-lg-jp-site-fui",
    "name": "福島県移住ポータルサイト「ふくしまぐらし。」",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.pref.fukushima.lg.jp/site/fui/",
    "prefecture": "福島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-11245",
    "name": "ふじみ野市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://fujimino-c11245.akiya-athome.jp/",
    "prefecture": "埼玉県",
    "municipality": "ふじみ野市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-11237",
    "name": "三郷市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://misato-c11237.akiya-athome.jp/",
    "prefecture": "埼玉県",
    "municipality": "三郷市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-11219",
    "name": "上尾市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ageo-c11219.akiya-athome.jp/",
    "prefecture": "埼玉県",
    "municipality": "上尾市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-town-tokigawa-lg-jp-forms-info-info-aspx-info-id-2",
    "name": "ときがわ町空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.town.tokigawa.lg.jp/forms/info/info.aspx?info_id=25576",
    "prefecture": "埼玉県",
    "municipality": "ときがわ町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-12212",
    "name": "佐倉市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sakura-c12212.akiya-athome.jp/",
    "prefecture": "千葉県",
    "municipality": "佐倉市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-12221",
    "name": "八千代市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yachiyo-c12221.akiya-athome.jp/",
    "prefecture": "千葉県",
    "municipality": "八千代市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-12230",
    "name": "八街市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yachimata-c12230.akiya-athome.jp/",
    "prefecture": "千葉県",
    "municipality": "八街市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-uji-isumi-com-project",
    "name": "いすみ市空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://uji-isumi.com/project",
    "prefecture": "千葉県",
    "municipality": "いすみ市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-20583",
    "name": "上水内郡信濃町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://shinano-t20583.akiya-athome.jp/",
    "prefecture": "長野県",
    "municipality": "上水内郡信濃町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-20590",
    "name": "上水内郡飯綱町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://iizuna-t20590.akiya-athome.jp/",
    "prefecture": "長野県",
    "municipality": "上水内郡飯綱町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-20203",
    "name": "上田市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ueda-c20203.akiya-athome.jp/",
    "prefecture": "長野県",
    "municipality": "上田市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-rakuen-akiya-jp-housesearch",
    "name": "楽園信州空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://rakuen-akiya.jp/housesearch/",
    "prefecture": "長野県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-28229",
    "name": "たつの市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tatsuno-c28229.akiya-athome.jp/",
    "prefecture": "兵庫県",
    "municipality": "たつの市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-28215",
    "name": "三木市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://miki-c28215.akiya-athome.jp/",
    "prefecture": "兵庫県",
    "municipality": "三木市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-28219",
    "name": "三田市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sanda-c28219.akiya-athome.jp/",
    "prefecture": "兵庫県",
    "municipality": "三田市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-harikura-west-jp-akiyabank-html",
    "name": "【西播磨暮らし】空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://harikura-west.jp/akiyabank.html",
    "prefecture": "兵庫県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-40503",
    "name": "三井郡大刀洗町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tachiarai-t40503.akiya-athome.jp/",
    "prefecture": "福岡県",
    "municipality": "三井郡大刀洗町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-40522",
    "name": "三潴郡大木町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ooki-t40522.akiya-athome.jp/",
    "prefecture": "福岡県",
    "municipality": "三潴郡大木町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-40215",
    "name": "中間市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nakama-c40215.akiya-athome.jp/",
    "prefecture": "福岡県",
    "municipality": "中間市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-rabbynet-zennichi-or-jp-div-fukuoka-buy-house-special",
    "name": "ラビ―ネット不動産（福岡県本部）福岡県空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://rabbynet.zennichi.or.jp/div_fukuoka/buy/house/special/akiya/fukuoka/",
    "prefecture": "福岡県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-08235",
    "name": "つくばみらい市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tsukubamirai-c08235.akiya-athome.jp/",
    "prefecture": "茨城県",
    "municipality": "つくばみらい市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-08220",
    "name": "つくば市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tsukuba-c08220.akiya-athome.jp/",
    "prefecture": "茨城県",
    "municipality": "つくば市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-08221",
    "name": "ひたちなか市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://hitachinaka-c08221.akiya-athome.jp/",
    "prefecture": "茨城県",
    "municipality": "ひたちなか市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-iju-ibaraki-jp-residence",
    "name": "Re:BARAKI",
    "source_type": "municipal_akiya_bank",
    "url": "https://iju-ibaraki.jp/residence/",
    "prefecture": "茨城県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-kagoshima-iju-jp",
    "name": "かごしまで暮らす",
    "source_type": "public_dataset",
    "url": "https://www.kagoshima-iju.jp/",
    "prefecture": "鹿児島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-46219",
    "name": "いちき串木野市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ichikikushikino-c46219.akiya-athome.jp/",
    "prefecture": "鹿児島県",
    "municipality": "いちき串木野市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-46224",
    "name": "伊佐市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://isa-c46224.akiya-athome.jp/",
    "prefecture": "鹿児島県",
    "municipality": "伊佐市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-46208",
    "name": "出水市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://izumi-c46208.akiya-athome.jp/",
    "prefecture": "鹿児島県",
    "municipality": "出水市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-www-city-ichikikushikino-lg-jp-akiyabank-index-html",
    "name": "いちき串木野市公式ＨＰ",
    "source_type": "municipal_akiya_bank",
    "url": "http://www.city.ichikikushikino.lg.jp/akiyabank_index.html",
    "prefecture": "鹿児島県",
    "municipality": "いちき串木野市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-21361",
    "name": "不破郡垂井町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tarui-t21361.akiya-athome.jp/",
    "prefecture": "岐阜県",
    "municipality": "不破郡垂井町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-21362",
    "name": "不破郡関ケ原町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sekigahara-t21362.akiya-athome.jp/",
    "prefecture": "岐阜県",
    "municipality": "不破郡関ケ原町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-21206",
    "name": "中津川市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nakatsugawa-c21206.akiya-athome.jp/",
    "prefecture": "岐阜県",
    "municipality": "中津川市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-gifu-iju-com",
    "name": "岐阜県移住定住ポータルサイト ふふふぎふ",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.gifu-iju.com/",
    "prefecture": "岐阜県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-03209",
    "name": "一関市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ichinoseki-c03209.akiya-athome.jp/",
    "prefecture": "岩手県",
    "municipality": "一関市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-03461",
    "name": "上閉伊郡大槌町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://otsuchi-t03461.akiya-athome.jp/",
    "prefecture": "岩手県",
    "municipality": "上閉伊郡大槌町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-03482",
    "name": "下閉伊郡山田町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yamada-t03482.akiya-athome.jp/",
    "prefecture": "岩手県",
    "municipality": "下閉伊郡山田町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-iju-pref-iwate-jp",
    "name": "移住定住ポータルサイト いわてイーハトー部に入ろう！",
    "source_type": "municipal_akiya_bank",
    "url": "https://iju.pref.iwate.jp/",
    "prefecture": "岩手県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-43441",
    "name": "上益城郡御船町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mifune-t43441.akiya-athome.jp/",
    "prefecture": "熊本県",
    "municipality": "上益城郡御船町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-43202",
    "name": "八代市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yatsushiro-c43202.akiya-athome.jp/",
    "prefecture": "熊本県",
    "municipality": "八代市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-43216",
    "name": "合志市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://koshi-c43216.akiya-athome.jp/",
    "prefecture": "熊本県",
    "municipality": "合志市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-kumamoto-akiya360-jp",
    "name": "熊本県空き家バンクプラットフォーム",
    "source_type": "municipal_akiya_bank",
    "url": "https://kumamoto-akiya360.jp/",
    "prefecture": "熊本県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-02209",
    "name": "つがる市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tsugaru-c02209.akiya-athome.jp/",
    "prefecture": "青森県",
    "municipality": "つがる市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-02208",
    "name": "むつ市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mutsu-c02208.akiya-athome.jp/",
    "prefecture": "青森県",
    "municipality": "むつ市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-02441",
    "name": "三戸郡三戸町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sannohe-t02441.akiya-athome.jp/",
    "prefecture": "青森県",
    "municipality": "三戸郡三戸町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-town-oirase-aomori-jp-soshiki-1232-akiyabank-html",
    "name": "おいらせ町空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.town.oirase.aomori.jp/soshiki/1232/akiyabank.html",
    "prefecture": "青森県",
    "municipality": "おいらせ町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-tochitaku-or-jp-akiya-index-html",
    "name": "栃木県空き家バンクガイド",
    "source_type": "public_dataset",
    "url": "https://www.tochitaku.or.jp/akiya/index.html",
    "prefecture": "栃木県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-09214",
    "name": "さくら市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sakura-c09214.akiya-athome.jp/",
    "prefecture": "栃木県",
    "municipality": "さくら市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-09361",
    "name": "下都賀郡壬生町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mibu-t09361.akiya-athome.jp/",
    "prefecture": "栃木県",
    "municipality": "下都賀郡壬生町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-09364",
    "name": "下都賀郡野木町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nogi-t09364.akiya-athome.jp/",
    "prefecture": "栃木県",
    "municipality": "下都賀郡野木町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-sakura-ijyu-jp-akiya-bank",
    "name": "さくら市空き家等情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://sakura-ijyu.jp/akiya-bank/",
    "prefecture": "栃木県",
    "municipality": "さくら市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-15405",
    "name": "三島郡出雲崎町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://izumozaki-t15405.akiya-athome.jp/",
    "prefecture": "新潟県",
    "municipality": "三島郡出雲崎町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-15204",
    "name": "三条市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sanjo-c15204.akiya-athome.jp/",
    "prefecture": "新潟県",
    "municipality": "三条市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-15222",
    "name": "上越市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://joetsu-c15222.akiya-athome.jp/",
    "prefecture": "新潟県",
    "municipality": "上越市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-niigatakurashi-com-akiya-search",
    "name": "空き家情報検索システム",
    "source_type": "municipal_akiya_bank",
    "url": "https://niigatakurashi.com/akiya-search/",
    "prefecture": "新潟県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-23219",
    "name": "小牧市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://komaki-c23219.akiya-athome.jp/",
    "prefecture": "愛知県",
    "municipality": "小牧市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-23230",
    "name": "日進市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nisshin-c23230.akiya-athome.jp/",
    "prefecture": "愛知県",
    "municipality": "日進市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-23206",
    "name": "春日井市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kasugai-c23206.akiya-athome.jp/",
    "prefecture": "愛知県",
    "municipality": "春日井市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-city-aichi-miyoshi-lg-jp-toshi-k-akiya-akiyatop-ht",
    "name": "空き家に関すること",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.city.aichi-miyoshi.lg.jp/toshi_k/akiya/akiyatop.html",
    "prefecture": "愛知県",
    "municipality": "みよし市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-06212",
    "name": "尾花沢市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://obanazawa-c06212.akiya-athome.jp/",
    "prefecture": "山形県",
    "municipality": "尾花沢市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-06201",
    "name": "山形市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yamagata-c06201.akiya-athome.jp/",
    "prefecture": "山形県",
    "municipality": "山形市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-06362",
    "name": "最上郡最上町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mogami-t06362.akiya-athome.jp/",
    "prefecture": "山形県",
    "municipality": "最上郡最上町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-www-town-mikawa-yamagata-jp-cache-yimg-jp-kurashi-sumai",
    "name": "三川町空き家バンク情報",
    "source_type": "municipal_akiya_bank",
    "url": "http://www.town.mikawa.yamagata.jp.cache.yimg.jp/kurashi/sumai/akiya/index.html",
    "prefecture": "山形県",
    "municipality": "三川町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-29207",
    "name": "五條市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://gojo-c29207.akiya-athome.jp/",
    "prefecture": "奈良県",
    "municipality": "五條市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-29424",
    "name": "北葛城郡上牧町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kanmaki-t29424.akiya-athome.jp/",
    "prefecture": "奈良県",
    "municipality": "北葛城郡上牧町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-29426",
    "name": "北葛城郡広陵町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://koryo-t29426.akiya-athome.jp/",
    "prefecture": "奈良県",
    "municipality": "北葛城郡広陵町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-town-sango-nara-jp-seikatsukankyo-akiyabank-html",
    "name": "三郷町空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.town.sango.nara.jp/seikatsukankyo/akiyabank.html",
    "prefecture": "奈良県",
    "municipality": "三郷町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-05214",
    "name": "にかほ市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nikaho-c05214.akiya-athome.jp/",
    "prefecture": "秋田県",
    "municipality": "にかほ市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-05434",
    "name": "仙北郡美郷町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://misato-t05434.akiya-athome.jp/",
    "prefecture": "秋田県",
    "municipality": "仙北郡美郷町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-05213",
    "name": "北秋田市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kitaakita-c05213.akiya-athome.jp/",
    "prefecture": "秋田県",
    "municipality": "北秋田市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-a-iju-jp-live-akiya",
    "name": "あきた暮らし\"はじめの一歩",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.a-iju.jp/live/akiya/",
    "prefecture": "秋田県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-kochi-iju-jp",
    "name": "高知家で暮らす。",
    "source_type": "public_dataset",
    "url": "https://kochi-iju.jp/",
    "prefecture": "高知県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-39204",
    "name": "南国市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nankoku-c39204.akiya-athome.jp/",
    "prefecture": "高知県",
    "municipality": "南国市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-39386",
    "name": "吾川郡いの町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ino-t39386.akiya-athome.jp/",
    "prefecture": "高知県",
    "municipality": "吾川郡いの町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-39209",
    "name": "土佐清水市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tosashimizu-c39209.akiya-athome.jp/",
    "prefecture": "高知県",
    "municipality": "土佐清水市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-ino-iju-jp",
    "name": "ハッピーいの町ターン",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.ino-iju.jp/",
    "prefecture": "高知県",
    "municipality": "いの町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-27212",
    "name": "八尾市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yao-c27212.akiya-athome.jp/",
    "prefecture": "大阪府",
    "municipality": "八尾市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-27205",
    "name": "吹田市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://suita-c27205.akiya-athome.jp/",
    "prefecture": "大阪府",
    "municipality": "吹田市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-27219",
    "name": "和泉市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://izumi-c27219.akiya-athome.jp/",
    "prefecture": "大阪府",
    "municipality": "和泉市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-bank-osaka-sumai-refo-com",
    "name": "大阪版・空家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://bank.osaka-sumai-refo.com/",
    "prefecture": "大阪府",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-okayama-iju-jp",
    "name": "おかやま晴れの国ぐらし",
    "source_type": "public_dataset",
    "url": "https://www.okayama-iju.jp/",
    "prefecture": "岡山県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-33663",
    "name": "久米郡久米南町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kumenan-t33663.akiya-athome.jp/",
    "prefecture": "岡山県",
    "municipality": "久米郡久米南町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-33666",
    "name": "久米郡美咲町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://misaki-t33666.akiya-athome.jp/",
    "prefecture": "岡山県",
    "municipality": "久米郡美咲町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-33207",
    "name": "井原市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ibara-c33207.akiya-athome.jp/",
    "prefecture": "岡山県",
    "municipality": "井原市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-town-kumenan-lg-jp-iju-property-property-list-html",
    "name": "久米南町空き家・空き地情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.town.kumenan.lg.jp/iju/property/property_list.html",
    "prefecture": "岡山県",
    "municipality": "久米南町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-04361",
    "name": "亘理郡亘理町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://watari-t04361.akiya-athome.jp/",
    "prefecture": "宮城県",
    "municipality": "亘理郡亘理町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-04362",
    "name": "亘理郡山元町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yamamoto-t04362.akiya-athome.jp/",
    "prefecture": "宮城県",
    "municipality": "亘理郡山元町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-04341",
    "name": "伊具郡丸森町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://marumori-t04341.akiya-athome.jp/",
    "prefecture": "宮城県",
    "municipality": "伊具郡丸森町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-pref-miyagi-jp-soshiki-juutaku-akiyataisaku-html",
    "name": "空き家等対策について",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.pref.miyagi.jp/soshiki/juutaku/akiyataisaku.html",
    "prefecture": "宮城県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-22206",
    "name": "三島市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mishima-c22206.akiya-athome.jp/",
    "prefecture": "静岡県",
    "municipality": "三島市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-22219",
    "name": "下田市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://shimoda-c22219.akiya-athome.jp/",
    "prefecture": "静岡県",
    "municipality": "下田市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-22222",
    "name": "伊豆市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://izu-c22222.akiya-athome.jp/",
    "prefecture": "静岡県",
    "municipality": "伊豆市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-iju-pref-shizuoka-jp-living-158-html",
    "name": "静岡県公式移住・定住情報サイト「ゆとりすと静岡」",
    "source_type": "municipal_akiya_bank",
    "url": "https://iju.pref.shizuoka.jp/living/158.html",
    "prefecture": "静岡県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-24343",
    "name": "三重郡朝日町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://asahi-t24343.akiya-athome.jp/",
    "prefecture": "三重県",
    "municipality": "三重郡朝日町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-24210",
    "name": "亀山市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kameyama-c24210.akiya-athome.jp/",
    "prefecture": "三重県",
    "municipality": "亀山市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-24216",
    "name": "伊賀市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://iga-c24216.akiya-athome.jp/",
    "prefecture": "三重県",
    "municipality": "伊賀市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-city-kameyama-mie-jp-docs-2021010500012-akiya-bank",
    "name": "亀山市空き家情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.city.kameyama.mie.jp/docs/2021010500012/akiya_bank.html",
    "prefecture": "三重県",
    "municipality": "亀山市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-45209",
    "name": "えびの市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ebino-c45209.akiya-athome.jp/",
    "prefecture": "宮崎県",
    "municipality": "えびの市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-45207",
    "name": "串間市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kushima-c45207.akiya-athome.jp/",
    "prefecture": "宮崎県",
    "municipality": "串間市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-45405",
    "name": "児湯郡川南町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kawaminami-t45405.akiya-athome.jp/",
    "prefecture": "宮崎県",
    "municipality": "児湯郡川南町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-iju-pref-miyazaki-lg-jp-housebank",
    "name": "｢日本のひなた宮崎県｣移住・UIJターン情報サイト　あったか宮崎ひなた暮らし",
    "source_type": "municipal_akiya_bank",
    "url": "http://iju.pref.miyazaki.lg.jp/housebank/",
    "prefecture": "宮崎県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-14210",
    "name": "三浦市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://miura-c14210.akiya-athome.jp/",
    "prefecture": "神奈川県",
    "municipality": "三浦市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-14341",
    "name": "中郡大磯町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://oiso-t14341.akiya-athome.jp/",
    "prefecture": "神奈川県",
    "municipality": "中郡大磯町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-14214",
    "name": "伊勢原市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://isehara-c14214.akiya-athome.jp/",
    "prefecture": "神奈川県",
    "municipality": "伊勢原市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-www-city-miura-kanagawa-jp-keikaku-akiya-akiya-banku-ka",
    "name": "三浦市空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://www.city.miura.kanagawa.jp/keikaku/akiya/akiya_banku_kaishi.html",
    "prefecture": "神奈川県",
    "municipality": "三浦市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-akiya-pref-fukui-lg-jp",
    "name": "ふくい空き家情報バンク",
    "source_type": "public_dataset",
    "url": "https://akiya.pref.fukui.lg.jp/",
    "prefecture": "福井県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-18208",
    "name": "あわら市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://awara-c18208.akiya-athome.jp/",
    "prefecture": "福井県",
    "municipality": "あわら市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-18501",
    "name": "三方上中郡若狭町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://wakas-t18501.akiya-athome.jp/",
    "prefecture": "福井県",
    "municipality": "三方上中郡若狭町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-18442",
    "name": "三方郡美浜町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mihama-t18442.akiya-athome.jp/",
    "prefecture": "福井県",
    "municipality": "三方郡美浜町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-info-pref-fukui-jp-kentiku-banku",
    "name": "福井県空き家情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "http://info.pref.fukui.jp/kentiku/banku/",
    "prefecture": "福井県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-10212",
    "name": "みどり市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://midori-c10212.akiya-athome.jp/",
    "prefecture": "群馬県",
    "municipality": "みどり市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-10204",
    "name": "伊勢崎市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://isesaki-c10204.akiya-athome.jp/",
    "prefecture": "群馬県",
    "municipality": "伊勢崎市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-10464",
    "name": "佐波郡玉村町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tamamura-t10464.akiya-athome.jp/",
    "prefecture": "群馬県",
    "municipality": "佐波郡玉村町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-pref-gunma-jp-04-bi0100004-html",
    "name": "空き家関連情報（群馬県ホームページ）",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.pref.gunma.jp/04/bi0100004.html",
    "prefecture": "群馬県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-41346",
    "name": "三養基郡みやき町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://miyaki-t41346.akiya-athome.jp/",
    "prefecture": "佐賀県",
    "municipality": "三養基郡みやき町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-41341",
    "name": "三養基郡基山町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kiyama-t41341.akiya-athome.jp/",
    "prefecture": "佐賀県",
    "municipality": "三養基郡基山町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-41205",
    "name": "伊万里市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://imari-c41205.akiya-athome.jp/",
    "prefecture": "佐賀県",
    "municipality": "伊万里市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-sagasmile-com-main-28-html",
    "name": "サガスマイル",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.sagasmile.com/main/28.html",
    "prefecture": "佐賀県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-19212",
    "name": "上野原市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://uenohara-c19212.akiya-athome.jp/",
    "prefecture": "山梨県",
    "municipality": "上野原市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-19214",
    "name": "中央市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://chuo-c19214.akiya-athome.jp/",
    "prefecture": "山梨県",
    "municipality": "中央市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-19209",
    "name": "北杜市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://hokuto-c19209.akiya-athome.jp/",
    "prefecture": "山梨県",
    "municipality": "北杜市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-city-uenohara-yamanashi-jp-gyosei-docs-akiyabank-b",
    "name": "上野原市空き家・空き店舗バンク物件情報",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.city.uenohara.yamanashi.jp/gyosei/docs/akiyabank-bukken.html",
    "prefecture": "山梨県",
    "municipality": "上野原市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-25201",
    "name": "大津市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://otsu-c25201.akiya-athome.jp/",
    "prefecture": "滋賀県",
    "municipality": "大津市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-25207",
    "name": "守山市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://moriyama-c25207.akiya-athome.jp/",
    "prefecture": "滋賀県",
    "municipality": "守山市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-25202",
    "name": "彦根市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://hikone-c25202.akiya-athome.jp/",
    "prefecture": "滋賀県",
    "municipality": "彦根市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-pref-shiga-lg-jp-ippan-kendoseibi-zyuutaku-19000-h",
    "name": "滋賀県空き家バンクのご案内",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.pref.shiga.lg.jp/ippan/kendoseibi/zyuutaku/19000.html",
    "prefecture": "滋賀県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-38202",
    "name": "今治市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://imabari-c38202.akiya-athome.jp/",
    "prefecture": "愛媛県",
    "municipality": "今治市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-38210",
    "name": "伊予市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://iyo-c38210.akiya-athome.jp/",
    "prefecture": "愛媛県",
    "municipality": "伊予市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-38401",
    "name": "伊予郡松前町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://masaki-t38401.akiya-athome.jp/",
    "prefecture": "愛媛県",
    "municipality": "伊予郡松前町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-e-iju-net-akiya-public-top",
    "name": "えひめ空き家情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://e-iju.net/akiya/public/Top",
    "prefecture": "愛媛県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-31203",
    "name": "倉吉市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kurayoshi-c31203.akiya-athome.jp/",
    "prefecture": "鳥取県",
    "municipality": "倉吉市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-31329",
    "name": "八頭郡八頭町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yazu-t31329.akiya-athome.jp/",
    "prefecture": "鳥取県",
    "municipality": "八頭郡八頭町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-31328",
    "name": "八頭郡智頭町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://chizu-t31328.akiya-athome.jp/",
    "prefecture": "鳥取県",
    "municipality": "八頭郡智頭町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-ietoti-jp-iju",
    "name": "とっとり暮らし住宅バンクシステム",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.ietoti.jp/IJU/",
    "prefecture": "鳥取県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-hiroshima-hirobiro-jp",
    "name": "ひろしま暮らし",
    "source_type": "public_dataset",
    "url": "https://www.hiroshima-hirobiro.jp/",
    "prefecture": "広島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-34204",
    "name": "三原市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://mihara-c34204.akiya-athome.jp/",
    "prefecture": "広島県",
    "municipality": "三原市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-34209",
    "name": "三次市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://miyoshi-c34209.akiya-athome.jp/",
    "prefecture": "広島県",
    "municipality": "三次市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-34309",
    "name": "安芸郡坂町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://saka-t34309.akiya-athome.jp/",
    "prefecture": "広島県",
    "municipality": "安芸郡坂町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-minto-hiroshima-jp",
    "name": "ひろしま空き家バンク「みんと。」（※一部対象外の地域あり）",
    "source_type": "municipal_akiya_bank",
    "url": "https://minto-hiroshima.jp/",
    "prefecture": "広島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-iju-oita-jp",
    "name": "おおいた暮らし",
    "source_type": "public_dataset",
    "url": "https://www.iju-oita.jp/",
    "prefecture": "大分県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-44203",
    "name": "中津市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nakatsu-c44203.akiya-athome.jp/",
    "prefecture": "大分県",
    "municipality": "中津市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-44205",
    "name": "佐伯市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://saiki-c44205.akiya-athome.jp/",
    "prefecture": "大分県",
    "municipality": "佐伯市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-44202",
    "name": "別府市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://beppu-c44202.akiya-athome.jp/",
    "prefecture": "大分県",
    "municipality": "別府市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-iju-city-nakatsu-com",
    "name": "なかつ移住の窓口",
    "source_type": "municipal_akiya_bank",
    "url": "https://iju.city-nakatsu.com",
    "prefecture": "大分県",
    "municipality": "中津市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-26322",
    "name": "久世郡久御山町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kumiyama-t26322.akiya-athome.jp/",
    "prefecture": "京都府",
    "municipality": "久世郡久御山町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-26206",
    "name": "亀岡市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kameo-c26206.akiya-athome.jp/",
    "prefecture": "京都府",
    "municipality": "亀岡市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-26100",
    "name": "京都市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kyoto-c26100.akiya-athome.jp/",
    "prefecture": "京都府",
    "municipality": "京都市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-http-kyotohokuburenkei-jp-akiyasearch-kubun-buyrent-city-yos",
    "name": "京都府北部UIターンプロジェクト　たんたんターン",
    "source_type": "municipal_akiya_bank",
    "url": "http://kyotohokuburenkei.jp/akiyasearch/?kubun=buyrent&city=yosano",
    "prefecture": "京都府",
    "municipality": "与謝野町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-42211",
    "name": "五島市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://goto-c42211.akiya-athome.jp/",
    "prefecture": "長崎県",
    "municipality": "五島市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-42202",
    "name": "佐世保市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sasebo-c42202.akiya-athome.jp/",
    "prefecture": "長崎県",
    "municipality": "佐世保市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-42383",
    "name": "北松浦郡小値賀町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ojika-t42383.akiya-athome.jp/",
    "prefecture": "長崎県",
    "municipality": "北松浦郡小値賀町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-city-goto-nagasaki-jp-iju-li-050-010-index-html",
    "name": "五島市空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.city.goto.nagasaki.jp/iju/li/050/010/index.html",
    "prefecture": "長崎県",
    "municipality": "五島市",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-35201",
    "name": "下関市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://shimonoseki-c35201.akiya-athome.jp/",
    "prefecture": "山口県",
    "municipality": "下関市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-35215",
    "name": "周南市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://shunan-c35215.akiya-athome.jp/",
    "prefecture": "山口県",
    "municipality": "周南市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-35203",
    "name": "山口市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://yamaguchi-c35203.akiya-athome.jp/",
    "prefecture": "山口県",
    "municipality": "山口市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-ymg-uji-jp-house-bank",
    "name": "住んでみぃね！ぶちええ山口",
    "source_type": "municipal_akiya_bank",
    "url": "https://ymg-uji.jp/house/bank/",
    "prefecture": "山口県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-16342",
    "name": "下新川郡入善町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://nyuzen-t16342.akiya-athome.jp/",
    "prefecture": "富山県",
    "municipality": "下新川郡入善町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-16343",
    "name": "下新川郡朝日町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://asahi-t16343.akiya-athome.jp/",
    "prefecture": "富山県",
    "municipality": "下新川郡朝日町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-16322",
    "name": "中新川郡上市町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kamiichi-t16322.akiya-athome.jp/",
    "prefecture": "富山県",
    "municipality": "中新川郡上市町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-toyama-teiju-jp-housebank",
    "name": "市町村空き家情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://toyama-teiju.jp/housebank",
    "prefecture": "富山県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-17206",
    "name": "加賀市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kaga-c17206.akiya-athome.jp/",
    "prefecture": "石川県",
    "municipality": "加賀市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-17203",
    "name": "小松市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://komatsu-c17203.akiya-athome.jp/",
    "prefecture": "石川県",
    "municipality": "小松市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-17205",
    "name": "珠洲市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://suzu-c17205.akiya-athome.jp/",
    "prefecture": "石川県",
    "municipality": "珠洲市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-iju-ishikawa-jp-akiya",
    "name": "いしかわ暮らし情報ひろば／空き家情報ナビ",
    "source_type": "municipal_akiya_bank",
    "url": "https://iju.ishikawa.jp/akiya/",
    "prefecture": "石川県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-kurashimanet-jp",
    "name": "くらしまねっと",
    "source_type": "public_dataset",
    "url": "https://www.kurashimanet.jp/",
    "prefecture": "島根県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-32343",
    "name": "仁多郡奥出雲町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://okuizumo-t32343.akiya-athome.jp/",
    "prefecture": "島根県",
    "municipality": "仁多郡奥出雲町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-32201",
    "name": "松江市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://matsue-c32201.akiya-athome.jp/",
    "prefecture": "島根県",
    "municipality": "松江市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-32449",
    "name": "邑智郡邑南町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ohnan-t32449.akiya-athome.jp/",
    "prefecture": "島根県",
    "municipality": "邑智郡邑南町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-kurashimanet-jp-lifestyle-house-shimane-akiya-html",
    "name": "くらしまねっと 市町村の空き家情報",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.kurashimanet.jp/lifestyle/house/shimane-akiya.html",
    "prefecture": "島根県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-36208",
    "name": "三好市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://miyoshi-c36208.akiya-athome.jp/",
    "prefecture": "徳島県",
    "municipality": "三好市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-36489",
    "name": "三好郡東みよし町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://higashimiyoshi-t36489.akiya-athome.jp/",
    "prefecture": "徳島県",
    "municipality": "三好郡東みよし町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-36301",
    "name": "勝浦郡勝浦町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://katsuura-t36301.akiya-athome.jp/",
    "prefecture": "徳島県",
    "municipality": "勝浦郡勝浦町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-tokushima36000-akiya-athome-jp",
    "name": "「とくしま回帰」空き家情報バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://tokushima36000.akiya-athome.jp/",
    "prefecture": "徳島県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "pref-https-www-wakayamagurashi-jp",
    "name": "わかやま定住サポート",
    "source_type": "public_dataset",
    "url": "https://www.wakayamagurashi.jp/",
    "prefecture": "和歌山県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": false,
    "scope": "prefectural",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-30341",
    "name": "伊都郡かつらぎ町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://katsuragi-t30341.akiya-athome.jp/",
    "prefecture": "和歌山県",
    "municipality": "伊都郡かつらぎ町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-30343",
    "name": "伊都郡九度山町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kudoyama-t30343.akiya-athome.jp/",
    "prefecture": "和歌山県",
    "municipality": "伊都郡九度山町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-30201",
    "name": "和歌山市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://wakayama-c30201.akiya-athome.jp/",
    "prefecture": "和歌山県",
    "municipality": "和歌山市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-wakayamagurashi-jp-category-house",
    "name": "わかやま空き家バンク",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.wakayamagurashi.jp/category/house",
    "prefecture": "和歌山県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-13214",
    "name": "国分寺市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kokubunji-c13214.akiya-athome.jp/",
    "prefecture": "東京都",
    "municipality": "国分寺市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-13222",
    "name": "東久留米市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://higashikurume-c13222.akiya-athome.jp/",
    "prefecture": "東京都",
    "municipality": "東久留米市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-13219",
    "name": "狛江市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://komae-c13219.akiya-athome.jp/",
    "prefecture": "東京都",
    "municipality": "狛江市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-town-hachijo-tokyo-jp-iju-index-html",
    "name": "八丈島へ移住・定住を考えている方へのごあんない",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.town.hachijo.tokyo.jp/iju/index.html",
    "prefecture": "東京都",
    "municipality": "八丈町",
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-37206",
    "name": "さぬき市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://sanuki-c37206.akiya-athome.jp/",
    "prefecture": "香川県",
    "municipality": "さぬき市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-37406",
    "name": "仲多度郡まんのう町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://manno-t37406.akiya-athome.jp/",
    "prefecture": "香川県",
    "municipality": "仲多度郡まんのう町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-37404",
    "name": "仲多度郡多度津町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://tadotsu-t37404.akiya-athome.jp/",
    "prefecture": "香川県",
    "municipality": "仲多度郡多度津町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-www-kagawalife-jp-live",
    "name": "かがわ住まいネット",
    "source_type": "municipal_akiya_bank",
    "url": "https://www.kagawalife.jp/live/",
    "prefecture": "香川県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-47361",
    "name": "島尻郡久米島町 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://kumejima-t47361.akiya-athome.jp/",
    "prefecture": "沖縄県",
    "municipality": "島尻郡久米島町",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-47211",
    "name": "沖縄市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://okinawa-c47211.akiya-athome.jp/",
    "prefecture": "沖縄県",
    "municipality": "沖縄市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "athome-47207",
    "name": "石垣市 空き家バンク（アットホーム）",
    "source_type": "athome_akiya_bank",
    "url": "https://ishigaki-c47207.akiya-athome.jp/",
    "prefecture": "沖縄県",
    "municipality": "石垣市",
    "adapter": "athome_municipal",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  },
  {
    "key": "muni-https-okinawa-iju-jp-guide",
    "name": "沖縄県公式移住応援サイト おきなわ島ぐらし",
    "source_type": "municipal_akiya_bank",
    "url": "https://okinawa-iju.jp/guide/",
    "prefecture": "沖縄県",
    "municipality": null,
    "adapter": "generic",
    "crawlable": true,
    "scope": "municipal",
    "notes_fr": null,
    "registered": false
  }
];

const CATALOG_PREFECTURES: CatalogPrefecture[] = [
  {
    "prefecture": "北海道",
    "total": 159,
    "structured": 35
  },
  {
    "prefecture": "福島県",
    "total": 87,
    "structured": 37
  },
  {
    "prefecture": "埼玉県",
    "total": 79,
    "structured": 40
  },
  {
    "prefecture": "千葉県",
    "total": 75,
    "structured": 37
  },
  {
    "prefecture": "長野県",
    "total": 75,
    "structured": 12
  },
  {
    "prefecture": "兵庫県",
    "total": 72,
    "structured": 33
  },
  {
    "prefecture": "福岡県",
    "total": 69,
    "structured": 22
  },
  {
    "prefecture": "茨城県",
    "total": 66,
    "structured": 32
  },
  {
    "prefecture": "鹿児島県",
    "total": 64,
    "structured": 30
  },
  {
    "prefecture": "岐阜県",
    "total": 60,
    "structured": 27
  },
  {
    "prefecture": "岩手県",
    "total": 55,
    "structured": 22
  },
  {
    "prefecture": "熊本県",
    "total": 54,
    "structured": 14
  },
  {
    "prefecture": "青森県",
    "total": 53,
    "structured": 29
  },
  {
    "prefecture": "栃木県",
    "total": 51,
    "structured": 23
  },
  {
    "prefecture": "新潟県",
    "total": 51,
    "structured": 22
  },
  {
    "prefecture": "愛知県",
    "total": 51,
    "structured": 11
  },
  {
    "prefecture": "山形県",
    "total": 47,
    "structured": 17
  },
  {
    "prefecture": "奈良県",
    "total": 47,
    "structured": 18
  },
  {
    "prefecture": "秋田県",
    "total": 44,
    "structured": 18
  },
  {
    "prefecture": "高知県",
    "total": 44,
    "structured": 12
  },
  {
    "prefecture": "大阪府",
    "total": 43,
    "structured": 16
  },
  {
    "prefecture": "岡山県",
    "total": 43,
    "structured": 17
  },
  {
    "prefecture": "宮城県",
    "total": 41,
    "structured": 16
  },
  {
    "prefecture": "静岡県",
    "total": 41,
    "structured": 16
  },
  {
    "prefecture": "三重県",
    "total": 40,
    "structured": 15
  },
  {
    "prefecture": "宮崎県",
    "total": 40,
    "structured": 17
  },
  {
    "prefecture": "神奈川県",
    "total": 39,
    "structured": 20
  },
  {
    "prefecture": "福井県",
    "total": 38,
    "structured": 16
  },
  {
    "prefecture": "群馬県",
    "total": 37,
    "structured": 17
  },
  {
    "prefecture": "佐賀県",
    "total": 36,
    "structured": 16
  },
  {
    "prefecture": "山梨県",
    "total": 35,
    "structured": 14
  },
  {
    "prefecture": "滋賀県",
    "total": 35,
    "structured": 15
  },
  {
    "prefecture": "愛媛県",
    "total": 35,
    "structured": 14
  },
  {
    "prefecture": "鳥取県",
    "total": 34,
    "structured": 10
  },
  {
    "prefecture": "広島県",
    "total": 33,
    "structured": 9
  },
  {
    "prefecture": "大分県",
    "total": 33,
    "structured": 15
  },
  {
    "prefecture": "京都府",
    "total": 32,
    "structured": 12
  },
  {
    "prefecture": "長崎県",
    "total": 32,
    "structured": 16
  },
  {
    "prefecture": "山口県",
    "total": 31,
    "structured": 12
  },
  {
    "prefecture": "富山県",
    "total": 30,
    "structured": 14
  },
  {
    "prefecture": "石川県",
    "total": 27,
    "structured": 6
  },
  {
    "prefecture": "島根県",
    "total": 25,
    "structured": 7
  },
  {
    "prefecture": "徳島県",
    "total": 24,
    "structured": 11
  },
  {
    "prefecture": "和歌山県",
    "total": 23,
    "structured": 14
  },
  {
    "prefecture": "東京都",
    "total": 16,
    "structured": 6
  },
  {
    "prefecture": "香川県",
    "total": 14,
    "structured": 6
  },
  {
    "prefecture": "沖縄県",
    "total": 9,
    "structured": 4
  }
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
      const scoreOf = (l: ListingDetail) => l.scores.at(-1)?.total_score ?? -1;
      if (f.sort === "price_asc") items.sort((a, b) => (a.price_yen ?? Infinity) - (b.price_yen ?? Infinity));
      else if (f.sort === "price_desc") items.sort((a, b) => (b.price_yen ?? -1) - (a.price_yen ?? -1));
      else if (f.sort === "score_desc") items.sort((a, b) => scoreOf(b) - scoreOf(a));
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

    geocodeListing: (id: string): Promise<ListingDetail> => {
      const l = byId(id);
      if (l && l.lat == null) {
        l.lat = 35.7;
        l.lon = 136.1;
        l.geocode_accuracy = "approximate";
      }
      return delay(l ?? LISTINGS[0]);
    },

    checkHazard: (id: string): Promise<ListingDetail> => {
      const l = byId(id);
      if (l) {
        const prob = l.prefecture === "千葉県" ? 0.62 : l.prefecture === "島根県" ? 0.04 : 0.14;
        l.hazard_scores = [
          {
            id: uid(),
            flood_risk: l.prefecture === "福井県" ? "medium" : "none",
            tsunami_risk: l.prefecture === "千葉県" ? "high" : "none",
            landslide_risk: l.prefecture === "大分県" ? "high" : "none",
            storm_surge_risk: "none",
            earthquake_risk: prob >= 0.26 ? "high" : prob >= 0.06 ? "medium" : "low",
            source_name: "J-SHIS Y2024 (防災科研) + 重ねるハザードマップ (国土地理院) — démo",
            raw_json: { T30_I50_PS: prob },
            created_at: new Date().toISOString(),
          },
        ];
      }
      return delay(l ?? LISTINGS[0]);
    },

    comps: (id: string): Promise<CompsResult> => {
      const l = byId(id);
      return delay({
        available: true,
        reason: `MLIT XIT001 — 2026Q1, préfecture ${l?.prefecture ?? ""} (démo)`,
        comps: [
          {
            trade_price_yen: 5200000,
            area_m2: 195,
            unit_price_yen_m2: 26667,
            build_year: "昭和52年",
            municipality: l?.city ?? "敦賀市",
            district: "中央町",
            property_type: "宅地(土地と建物)",
          },
          {
            trade_price_yen: 3100000,
            area_m2: 240,
            unit_price_yen_m2: 12917,
            build_year: "昭和48年",
            municipality: l?.city ?? "敦賀市",
            district: "櫛川",
            property_type: "宅地(土地と建物)",
          },
          {
            trade_price_yen: 7800000,
            area_m2: 165,
            unit_price_yen_m2: 47273,
            build_year: "平成8年",
            municipality: l?.city ?? "敦賀市",
            district: "相生町",
            property_type: "宅地(土地と建物)",
          },
        ],
        median_unit_price: 26667,
        sample_size: 3,
      });
    },

    refreshListing: (id: string): Promise<RefreshResult> => {
      const l = byId(id)!;
      const before = l.listing_status;
      if (l.id === "L6") {
        l.listing_status = "gone";
        return delay({ outcome: "gone" as const, status_before: before, status_after: "gone", price_changed: false, listing: l });
      }
      l.listing_status = "active";
      return delay({ outcome: "ok" as const, status_before: before, status_after: "active", price_changed: false, listing: l });
    },

    nearestStation: (id: string): Promise<StationResult> => {
      const l = byId(id);
      const table: Record<string, [string, number, string | null]> = {
        敦賀市: ["敦賀", 2.1, "JR西日本"],
        隠岐の島町: ["(pas de gare — île)", 0, null],
        由布市: ["由布院", 3.4, "JR九州"],
        南房総市: ["千倉", 1.8, "JR東日本"],
      };
      const hit = l?.city ? table[l.city] : undefined;
      if (!hit || hit[1] === 0) return delay({ found: false, name: null, distance_km: null, lat: null, lon: null, operator: null });
      return delay({ found: true, name: hit[0], distance_km: hit[1], lat: l!.lat, lon: l!.lon, operator: hit[2] });
    },

    exportCsv: (): Promise<Blob> => {
      const header = "titre,prefecture,ville,prix_yen,score\n";
      const rows = LISTINGS.map(
        (l) =>
          `"${l.title_original ?? ""}",${l.prefecture ?? ""},${l.city ?? ""},${l.price_yen ?? ""},${
            l.scores.at(-1)?.total_score ?? ""
          }`,
      ).join("\n");
      return delay(new Blob([header + rows], { type: "text/csv" }));
    },

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
    updateSource: (id: string, b: Record<string, unknown>): Promise<Source> => {
      const s = SOURCES.find((x) => x.id === id);
      if (s) Object.assign(s, b);
      return delay(s ?? SOURCES[0]);
    },
    deleteSource: (): Promise<void> => delay(undefined),

    catalog: (params: {
      query?: string;
      prefecture?: string;
      adapter?: string;
      limit?: number;
      offset?: number;
    }): Promise<CatalogResponse> => {
      let items = [...CATALOG];
      if (params.prefecture) items = items.filter((e) => e.prefecture === params.prefecture);
      if (params.adapter) items = items.filter((e) => e.adapter === params.adapter);
      if (params.query) {
        const q = params.query.toLowerCase();
        items = items.filter((e) =>
          `${e.name} ${e.municipality ?? ""} ${e.prefecture ?? ""} ${e.url}`
            .toLowerCase()
            .includes(q),
        );
      }
      const offset = params.offset ?? 0;
      const limit = params.limit ?? 30;
      return delay({
        items: items.slice(offset, offset + limit),
        total: items.length,
        limit,
        offset,
      });
    },
    catalogPrefectures: (): Promise<CatalogPrefecture[]> => delay(CATALOG_PREFECTURES),
    catalogAdd: (keys: string[], crawlEnabled: boolean): Promise<{
      added: Source[];
      skipped: string[];
    }> => {
      const added: Source[] = [];
      const skipped: string[] = [];
      keys.forEach((key) => {
        const entry = CATALOG.find((e) => e.key === key);
        if (!entry || entry.registered) {
          skipped.push(key);
          return;
        }
        entry.registered = true;
        const source: Source = {
          id: uid(),
          name: entry.name,
          source_type: entry.source_type,
          base_url: entry.url,
          municipality: entry.municipality,
          prefecture: entry.prefecture,
          crawl_enabled: crawlEnabled && entry.crawlable,
          crawl_frequency_days: 7,
          last_crawled_at: null,
          last_error: null,
          created_at: "",
          updated_at: "",
        };
        SOURCES.unshift(source);
        added.push(source);
      });
      return delay({ added, skipped });
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
