import { useState } from "react";

import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type UserSettings,
} from "@/lib/settings";

export function Settings() {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [regionInput, setRegionInput] = useState("");

  const update = (patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setSaved(false);
  };

  const persist = () => {
    saveSettings(settings);
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Réglages</h1>
        <p className="text-ink-soft">
          Préférences locales (stockées dans le navigateur). Les fournisseurs de traduction/LLM
          sont configurés côté serveur via variables d'environnement et restent en mode mock par
          défaut.
        </p>
      </div>

      <section className="panel space-y-4 p-5">
        <div>
          <span className="label">Régions cibles</span>
          <div className="flex gap-2">
            <input
              className="field"
              placeholder="例: 福井県"
              value={regionInput}
              onChange={(e) => setRegionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && regionInput.trim()) {
                  e.preventDefault();
                  update({ target_regions: [...settings.target_regions, regionInput.trim()] });
                  setRegionInput("");
                }
              }}
            />
            <button
              className="btn shrink-0"
              type="button"
              onClick={() => {
                if (regionInput.trim()) {
                  update({ target_regions: [...settings.target_regions, regionInput.trim()] });
                  setRegionInput("");
                }
              }}
            >
              +
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {settings.target_regions.map((r) => (
              <button
                key={r}
                className="chip bg-indigo/15 text-indigo"
                onClick={() =>
                  update({ target_regions: settings.target_regions.filter((x) => x !== r) })
                }
              >
                {r} ✕
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="budget">Budget max (¥)</label>
          <input
            id="budget"
            type="number"
            className="field"
            value={settings.max_budget_yen ?? ""}
            onChange={(e) =>
              update({ max_budget_yen: e.target.value ? Number(e.target.value) : null })
            }
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="cur">Devise d'affichage</label>
            <select
              id="cur"
              className="field"
              value={settings.currency}
              onChange={(e) => update({ currency: e.target.value })}
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="JPY">JPY (¥)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="trans">Traduction (info serveur)</label>
            <select
              id="trans"
              className="field"
              value={settings.translation_provider}
              onChange={(e) => update({ translation_provider: e.target.value })}
            >
              <option value="mock">mock</option>
              <option value="manual">manual</option>
              <option value="deepl">deepl (à venir)</option>
              <option value="llm">llm (à venir)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line pt-4">
          <button className="btn btn-primary" onClick={persist}>
            Enregistrer
          </button>
          <button
            className="btn"
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              saveSettings(DEFAULT_SETTINGS);
              setSaved(true);
            }}
          >
            Réinitialiser
          </button>
          {saved && <span className="font-bold text-moss">✓ Enregistré</span>}
        </div>
      </section>
    </div>
  );
}
