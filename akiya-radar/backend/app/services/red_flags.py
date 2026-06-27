"""Detection of Japanese real-estate red flags in listing text.

Each entry maps a Japanese keyword to an explained, actionable flag in French.
Severity levels: ``critical`` (legal/structural deal-breakers), ``warning``
(works / cost risks) and ``info`` (transactional status signals).

The module is intentionally dependency-free so it can be unit-tested in
isolation and reused by both the backend and the worker.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class FlagDefinition:
    flag_code: str
    keyword: str
    label_fr: str
    severity: str
    explanation_fr: str
    recommended_action_fr: str
    aliases: tuple[str, ...] = field(default_factory=tuple)

    @property
    def terms(self) -> tuple[str, ...]:
        return (self.keyword, *self.aliases)


# 9.1 — Critical red flags (legal / structural)
CRITICAL_FLAGS: list[FlagDefinition] = [
    FlagDefinition(
        "rebuild_forbidden",
        "再建築不可",
        "Reconstruction impossible",
        "critical",
        "Le terrain ne permet pas de reconstruire (souvent défaut d'accès à la voirie). "
        "La valeur et la revente sont fortement limitées.",
        "Vérifier l'accès à la voie publique et le statut auprès de la mairie avant tout.",
    ),
    FlagDefinition(
        "leasehold_land",
        "借地権",
        "Terrain en bail (pas pleine propriété)",
        "critical",
        "Vous achetez le bâtiment mais louez le terrain : loyer foncier et conditions de "
        "renouvellement à étudier.",
        "Demander le contrat de bail, le loyer annuel et la durée restante.",
    ),
    FlagDefinition(
        "urbanization_control_zone",
        "市街化調整区域",
        "Zone d'urbanisation contrôlée",
        "critical",
        "Zone où la construction neuve est restreinte. Travaux et reconstruction soumis "
        "à autorisation rarement accordée.",
        "Confirmer les droits à construire auprès du service d'urbanisme local.",
        aliases=("市街化調整区域内", "調整区域"),
    ),
    FlagDefinition(
        "agricultural_land",
        "農地",
        "Terrain agricole",
        "critical",
        "Les terres agricoles sont soumises à la loi agraire : l'achat par un "
        "non-agriculteur peut être interdit ou nécessiter une conversion.",
        "Vérifier le classement agricole et la possibilité de conversion (転用).",
    ),
    FlagDefinition(
        "unregistered",
        "未登記",
        "Bien non enregistré",
        "critical",
        "Le bâtiment n'est pas inscrit au registre foncier : propriété difficile à "
        "prouver et à transférer.",
        "Exiger la régularisation de l'enregistrement avant l'achat.",
    ),
    FlagDefinition(
        "encroachment",
        "越境",
        "Empiètement",
        "critical",
        "Une construction (mur, toit, branches) empiète sur ou depuis la parcelle "
        "voisine : litiges fréquents.",
        "Faire borner le terrain et obtenir un accord écrit avec les voisins.",
    ),
    FlagDefinition(
        "co_ownership_share",
        "共有持分",
        "Quote-part / indivision",
        "critical",
        "Vous n'achetez qu'une part du bien : toute décision exige l'accord des "
        "co-indivisaires.",
        "Identifier tous les indivisaires et privilégier l'achat de la pleine propriété.",
    ),
    FlagDefinition(
        "landslide_zone",
        "土砂災害警戒区域",
        "Zone de risque glissement/éboulement",
        "critical",
        "Parcelle classée en zone d'alerte glissement de terrain : risque physique et "
        "contraintes de construction.",
        "Consulter la carte des aléas (hazard map) et envisager des travaux de "
        "confortement.",
        aliases=("土砂災害特別警戒区域",),
    ),
    FlagDefinition(
        "tsunami_zone",
        "津波浸水想定区域",
        "Zone inondable tsunami",
        "critical",
        "Zone exposée à une submersion par tsunami selon les simulations officielles.",
        "Vérifier l'altitude, les voies d'évacuation et l'assurance.",
    ),
    FlagDefinition(
        "flood_zone",
        "洪水浸水想定区域",
        "Zone inondable (crue)",
        "critical",
        "Zone exposée aux inondations par débordement de cours d'eau.",
        "Consulter la hazard map locale et estimer le surcoût d'assurance.",
    ),
]

# 9.2 — Works / cost red flags
WORK_FLAGS: list[FlagDefinition] = [
    FlagDefinition(
        "roof_leak",
        "雨漏り",
        "Fuite de toiture",
        "warning",
        "Infiltrations signalées : risque d'humidité, de pourriture et de moisissures.",
        "Faire inspecter la toiture et la charpente.",
    ),
    FlagDefinition(
        "termites",
        "シロアリ",
        "Termites",
        "warning",
        "Présence de termites : la structure bois peut être compromise.",
        "Demander un diagnostic anti-termites et un devis de traitement.",
    ),
    FlagDefinition(
        "leaning_house",
        "傾き",
        "Maison qui penche",
        "warning",
        "Affaissement / inclinaison : possible défaut de fondation.",
        "Faire évaluer les fondations par un professionnel.",
    ),
    FlagDefinition(
        "corrosion",
        "腐食",
        "Corrosion / pourriture",
        "warning",
        "Éléments corrodés ou pourris : reprise structurelle probable.",
        "Chiffrer les reprises de structure.",
    ),
    FlagDefinition(
        "dilapidation",
        "老朽化",
        "Vétusté",
        "warning",
        "Bâtiment vétuste : nombreux postes de rénovation à prévoir.",
        "Établir un budget de rénovation global.",
    ),
    FlagDefinition(
        "repairs_needed",
        "要修繕",
        "Réparations nécessaires",
        "warning",
        "Le vendeur signale des réparations à réaliser.",
        "Lister les réparations et obtenir des devis.",
    ),
    FlagDefinition(
        "major_repairs",
        "大規模修繕",
        "Gros travaux",
        "warning",
        "Travaux d'envergure annoncés : budget conséquent.",
        "Prévoir une marge importante dans le budget.",
    ),
    FlagDefinition(
        "left_belongings",
        "残置物",
        "Objets laissés sur place",
        "warning",
        "Le bien contient des affaires de l'ancien occupant à évacuer.",
        "Estimer le coût d'enlèvement et de nettoyage.",
    ),
    FlagDefinition(
        "demolition_cost",
        "解体費",
        "Coût de démolition",
        "warning",
        "Une démolition est évoquée : coût souvent élevé au Japon.",
        "Obtenir un devis de démolition.",
    ),
    FlagDefinition(
        "vault_toilet",
        "汲み取り",
        "Toilettes à vidange",
        "warning",
        "Toilettes non raccordées : vidange manuelle régulière.",
        "Évaluer le coût de passage au tout-à-l'égout ou à une fosse.",
    ),
    FlagDefinition(
        "septic_tank",
        "浄化槽",
        "Fosse septique",
        "warning",
        "Assainissement individuel : entretien régulier obligatoire.",
        "Vérifier l'état et le coût d'entretien de la fosse.",
    ),
    FlagDefinition(
        "no_sewer",
        "下水道なし",
        "Pas de tout-à-l'égout",
        "warning",
        "Absence de réseau d'assainissement collectif.",
        "Chiffrer une solution d'assainissement individuel.",
    ),
    FlagDefinition(
        "no_water",
        "上水道なし",
        "Pas d'eau courante",
        "warning",
        "Pas de raccordement à l'eau potable.",
        "Évaluer le coût de raccordement ou de forage.",
    ),
    FlagDefinition(
        "no_parking",
        "駐車場なし",
        "Pas de parking",
        "warning",
        "Aucune place de stationnement : contrainte en zone rurale.",
        "Vérifier les possibilités de stationnement à proximité.",
    ),
]

# 9.3 — Transactional status signals
STATUS_FLAGS: list[FlagDefinition] = [
    FlagDefinition(
        "negotiating",
        "商談中",
        "En négociation",
        "info",
        "Le bien fait l'objet d'une négociation en cours.",
        "Confirmer la disponibilité avant d'engager des démarches.",
    ),
    FlagDefinition(
        "sold",
        "成約済み",
        "Vendu / conclu",
        "info",
        "La transaction est conclue : le bien n'est plus disponible.",
        "Marquer le bien comme vendu.",
        aliases=("売約済み",),
    ),
    FlagDefinition(
        "applications_suspended",
        "受付停止",
        "Demandes suspendues",
        "info",
        "Les demandes sont temporairement suspendues.",
        "Surveiller la réouverture des candidatures.",
    ),
    FlagDefinition(
        "for_sale",
        "売買",
        "Vente",
        "info",
        "Transaction de type vente.",
        "—",
    ),
    FlagDefinition(
        "for_rent",
        "賃貸",
        "Location",
        "info",
        "Transaction de type location (pas un achat).",
        "Vérifier que le mode correspond à votre objectif.",
    ),
    FlagDefinition(
        "transfer",
        "譲渡",
        "Cession",
        "info",
        "Cession (parfois gratuite ou symbolique).",
        "Clarifier les conditions de la cession.",
    ),
]

ALL_FLAGS: list[FlagDefinition] = CRITICAL_FLAGS + WORK_FLAGS + STATUS_FLAGS
_FLAGS_BY_CODE: dict[str, FlagDefinition] = {f.flag_code: f for f in ALL_FLAGS}


def _extract_evidence(text: str, term: str, window: int = 20) -> str:
    idx = text.find(term)
    if idx == -1:
        return term
    start = max(0, idx - window)
    end = min(len(text), idx + len(term) + window)
    snippet = text[start:end].replace("\n", " ").strip()
    return f"…{snippet}…" if (start > 0 or end < len(text)) else snippet


def detect_flags(*texts: str | None) -> list[dict]:
    """Detect red flags across one or more text fields.

    Returns a list of dicts ready to be persisted as ``ListingFlag`` rows.
    Each detected flag appears at most once, with evidence from the first match.
    """
    haystacks = [t for t in texts if t]
    if not haystacks:
        return []

    results: list[dict] = []
    seen: set[str] = set()
    for definition in ALL_FLAGS:
        if definition.flag_code in seen:
            continue
        for term in definition.terms:
            evidence_source = next((h for h in haystacks if term in h), None)
            if evidence_source is None:
                continue
            results.append(
                {
                    "flag_code": definition.flag_code,
                    "label_fr": definition.label_fr,
                    "severity": definition.severity,
                    "evidence_text": _extract_evidence(evidence_source, term),
                    "explanation_fr": definition.explanation_fr,
                    "recommended_action_fr": definition.recommended_action_fr,
                }
            )
            seen.add(definition.flag_code)
            break
    return results


def has_critical_flag(flags: list[dict]) -> bool:
    return any(f.get("severity") == "critical" for f in flags)


def get_flag_definition(flag_code: str) -> FlagDefinition | None:
    return _FLAGS_BY_CODE.get(flag_code)
