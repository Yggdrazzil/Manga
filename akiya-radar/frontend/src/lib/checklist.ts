export interface ChecklistItem {
  id: string;
  label: string;
}

// Buyer due-diligence checklist tailored to Japanese akiya pitfalls.
export const DUE_DILIGENCE: ChecklistItem[] = [
  { id: "rebuild", label: "Vérifier le droit de reconstruire (再建築不可 ?)" },
  { id: "ownership", label: "Confirmer la pleine propriété du terrain (借地権 ?)" },
  { id: "zoning", label: "Vérifier le zonage d'urbanisme (市街化調整区域 ?)" },
  { id: "registry", label: "Contrôler l'enregistrement au registre foncier (未登記 ?)" },
  { id: "boundaries", label: "Faire borner le terrain / vérifier empiètements (越境)" },
  { id: "hazard", label: "Consulter la hazard map (inondation, glissement, tsunami)" },
  { id: "seismic", label: "Évaluer le risque sismique et la norme de construction" },
  { id: "structure", label: "Inspecter structure : toiture, termites, fondations" },
  { id: "utilities", label: "Vérifier eau, assainissement, électricité, gaz" },
  { id: "renovation", label: "Estimer le budget de rénovation / démolition" },
  { id: "access", label: "Vérifier l'accès routier et le stationnement" },
  { id: "taxes", label: "Estimer taxes foncières et frais d'acquisition" },
];

const keyFor = (listingId: string) => `akiya-checklist-${listingId}`;

export function loadChecklist(listingId: string): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(keyFor(listingId)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveChecklist(listingId: string, state: Record<string, boolean>): void {
  localStorage.setItem(keyFor(listingId), JSON.stringify(state));
}
