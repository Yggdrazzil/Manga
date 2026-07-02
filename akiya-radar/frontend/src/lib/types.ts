export type Severity = "critical" | "warning" | "info";

export interface Flag {
  id: string;
  flag_code: string;
  label_fr: string;
  severity: Severity;
  evidence_text?: string | null;
  explanation_fr?: string | null;
  recommended_action_fr?: string | null;
}

export interface Score {
  id: string;
  total_score: number | null;
  price_score: number | null;
  location_score: number | null;
  natural_risk_score: number | null;
  legal_risk_score: number | null;
  renovation_score: number | null;
  personal_fit_score: number | null;
  confidence_score: number | null;
  explanation_fr: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  price_yen: number | null;
  detected_at: string;
  source_url: string | null;
}

export interface ListingSummary {
  id: string;
  source_url: string;
  title_original: string | null;
  title_fr: string | null;
  summary_fr: string | null;
  price_yen: number | null;
  price_eur: number | null;
  prefecture: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  geocode_accuracy: string | null;
  land_area_m2: number | null;
  building_area_m2: number | null;
  build_year: number | null;
  property_type: string | null;
  listing_status: string | null;
  personal_status: string;
  favorite: boolean;
  rating: number | null;
  flags: Flag[];
  scores: Score[];
}

export interface HazardScore {
  id: string;
  flood_risk: string | null;
  tsunami_risk: string | null;
  landslide_risk: string | null;
  earthquake_risk: string | null;
  source_name: string | null;
  raw_json: Record<string, unknown> | null;
  created_at: string;
}

export interface Comp {
  trade_price_yen: number | null;
  area_m2: number | null;
  unit_price_yen_m2: number | null;
  build_year: string | null;
  municipality: string | null;
  district: string | null;
  property_type: string | null;
}

export interface CompsResult {
  available: boolean;
  reason: string;
  comps: Comp[];
  median_unit_price: number | null;
  sample_size: number;
}

export interface StationResult {
  found: boolean;
  name: string | null;
  distance_km: number | null;
  lat: number | null;
  lon: number | null;
  operator: string | null;
}

export type ListingSort = "newest" | "price_asc" | "price_desc" | "score_desc";

export interface ListingDetail extends ListingSummary {
  source_id: string | null;
  external_id: string | null;
  description_original: string | null;
  description_fr: string | null;
  price_text_original: string | null;
  address_text: string | null;
  floor_plan: string | null;
  transaction_type: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
  notes: Note[];
  tasks: Task[];
  price_history: PriceHistoryEntry[];
  hazard_scores: HazardScore[];
}

export interface ListingListResponse {
  items: ListingSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface Duplicate {
  listing_id: string;
  reason: string;
  confidence: "exact" | "high" | "possible";
  title: string | null;
  city: string | null;
  price_yen: number | null;
}

export interface ImportResult {
  listing: ListingDetail;
  fetched: boolean;
  fields_filled: string[];
  possible_duplicates: Duplicate[];
}

export interface DashboardResponse {
  stats: {
    total: number;
    new: number;
    favorites: number;
    very_interesting: number;
    critical_flags: number;
    open_tasks: number;
  };
  top_opportunities: ListingSummary[];
  recent_listings: ListingSummary[];
}

export interface Source {
  id: string;
  name: string;
  source_type: string;
  base_url: string | null;
  municipality: string | null;
  prefecture: string | null;
  crawl_enabled: boolean;
  crawl_frequency_days: number;
  last_crawled_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria_json: Record<string, unknown>;
  alert_enabled: boolean;
  alert_frequency: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListingFilters {
  prefecture?: string;
  city?: string;
  max_price_yen?: number;
  min_land_area_m2?: number;
  min_building_area_m2?: number;
  property_type?: string;
  transaction_type?: string;
  personal_status?: string;
  favorite?: boolean;
  min_score?: number;
  exclude_critical_flags?: boolean;
  query?: string;
  sort?: ListingSort;
  limit?: number;
  offset?: number;
}

export const PERSONAL_STATUSES = [
  "new",
  "to_review",
  "interesting",
  "very_interesting",
  "needs_verification",
  "contact_to_make",
  "contacted",
  "visit_to_plan",
  "visited",
  "offer_considered",
  "abandoned",
] as const;

export const PERSONAL_STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  to_review: "À examiner",
  interesting: "Intéressant",
  very_interesting: "Très intéressant",
  needs_verification: "À vérifier",
  contact_to_make: "Contact à faire",
  contacted: "Contacté",
  visit_to_plan: "Visite à planifier",
  visited: "Visité",
  offer_considered: "Offre envisagée",
  abandoned: "Abandonné",
};

export const latestScore = (l: ListingSummary): Score | null =>
  l.scores && l.scores.length > 0 ? l.scores[l.scores.length - 1] : null;
