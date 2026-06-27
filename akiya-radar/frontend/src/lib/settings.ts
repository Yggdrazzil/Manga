export interface UserSettings {
  target_regions: string[];
  max_budget_yen: number | null;
  currency: string;
  translation_provider: string;
  llm_provider: string;
}

const KEY = "akiya-radar-settings";

export const DEFAULT_SETTINGS: UserSettings = {
  target_regions: [],
  max_budget_yen: null,
  currency: "EUR",
  translation_provider: "mock",
  llm_provider: "mock",
};

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}
