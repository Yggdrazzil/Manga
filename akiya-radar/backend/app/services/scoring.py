"""Transparent, explainable scoring for akiya listings.

Score is out of 100, broken into six weighted components:

    Prix / valeur ........ 20
    Localisation ......... 20
    Risques naturels ..... 20
    Risques juridiques ... 15
    Travaux probables .... 15
    Fit personnel ........ 10

A separate ``confidence_score`` (0-100) reflects how complete the source data
is, so a *missing-data* listing is never confused with a *bad* listing.
Every score ships with a French explanation (points positifs / négatifs).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

# Critical flag codes that are *legal* in nature (vs natural-hazard critical).
_LEGAL_CRITICAL = {
    "rebuild_forbidden": 8,
    "leasehold_land": 6,
    "urbanization_control_zone": 6,
    "agricultural_land": 6,
    "unregistered": 6,
    "encroachment": 5,
    "co_ownership_share": 6,
}
_NATURAL_CRITICAL = {
    "landslide_zone": 8,
    "tsunami_zone": 8,
    "flood_zone": 7,
}


@dataclass
class ScoreResult:
    total_score: int
    price_score: int
    location_score: int
    natural_risk_score: int
    legal_risk_score: int
    renovation_score: int
    personal_fit_score: int
    confidence_score: int
    explanation_fr: str
    positives: list[str] = field(default_factory=list)
    negatives: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "total_score": self.total_score,
            "price_score": self.price_score,
            "location_score": self.location_score,
            "natural_risk_score": self.natural_risk_score,
            "legal_risk_score": self.legal_risk_score,
            "renovation_score": self.renovation_score,
            "personal_fit_score": self.personal_fit_score,
            "confidence_score": self.confidence_score,
            "explanation_fr": self.explanation_fr,
        }


def _to_float(value) -> float | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _price_score(price_yen, positives: list[str], negatives: list[str]) -> tuple[int, bool]:
    price = _to_float(price_yen)
    if price is None:
        negatives.append("Prix inconnu : évaluation prix incertaine.")
        return 10, False
    # Heuristic akiya price bands (no MLIT market comparison in the MVP).
    if price == 0:
        negatives.append(
            "Cession gratuite (0円/譲渡) : vérifier les contreparties probables "
            "(démolition, remise en état, obligations)."
        )
        return 14, True
    if price <= 1_000_000:
        positives.append("Prix très faible pour une maison.")
        return 20, True
    if price <= 3_000_000:
        positives.append("Prix faible pour la région.")
        return 16, True
    if price <= 5_000_000:
        positives.append("Prix raisonnable.")
        return 13, True
    if price <= 10_000_000:
        return 10, True
    if price <= 20_000_000:
        negatives.append("Prix élevé pour un akiya.")
        return 6, True
    negatives.append("Prix élevé.")
    return 3, True


def _location_score(
    listing: dict, prefs: dict, positives: list[str], negatives: list[str]
) -> tuple[int, bool]:
    prefecture = listing.get("prefecture")
    city = listing.get("city")
    accuracy = listing.get("geocode_accuracy")
    target_regions = {r.strip() for r in prefs.get("target_regions", []) if r}

    if not prefecture and not city:
        negatives.append("Localisation inconnue.")
        return 8, False

    score = 12
    have_data = True
    if target_regions and (prefecture in target_regions or city in target_regions):
        positives.append("Ville/région dans une zone cible.")
        score += 6
    elif target_regions:
        negatives.append("Hors des zones cibles définies.")
        score -= 2

    if accuracy == "exact":
        positives.append("Géocodage exact.")
        score += 2
    elif accuracy in ("approximate", "city"):
        negatives.append("Géocodage approximatif.")
        have_data = False

    return max(0, min(20, score)), have_data


def _natural_risk_score(
    flags: list[dict], hazard: dict | None, positives: list[str], negatives: list[str]
) -> tuple[int, bool]:
    score = 20
    codes = {f["flag_code"] for f in flags}
    hit = False
    for code, penalty in _NATURAL_CRITICAL.items():
        if code in codes:
            score -= penalty
            hit = True
    if "tsunami_zone" in codes:
        negatives.append("Zone inondable tsunami.")
    if "flood_zone" in codes:
        negatives.append("Zone inondable (crue).")
    if "landslide_zone" in codes:
        negatives.append("Zone de glissement de terrain.")

    have_data = hazard is not None
    if not have_data:
        negatives.append("Risque naturel encore non vérifié.")
        score = min(score, 14)
        return max(0, min(20, score)), have_data

    quake = hazard.get("earthquake_risk")
    if quake == "high":
        score -= 5
        negatives.append("Risque sismique élevé (J-SHIS : prob. ≥26% sur 30 ans).")
    elif quake == "medium":
        score -= 2
        negatives.append("Risque sismique modéré (J-SHIS).")
    elif quake == "low":
        positives.append("Risque sismique faible (vérifié J-SHIS).")

    # Measured hazard-map layers outrank keyword flags: they say whether *this
    # point* is inside a mapped zone, not whether the advert mentioned it.
    measured = (
        ("flood_risk", "Inondation", 6),
        ("tsunami_risk", "Submersion tsunami", 7),
        ("storm_surge_risk", "Submersion marine", 5),
        ("landslide_risk", "Glissement de terrain", 6),
    )
    measured_clear = True
    for key, label, weight in measured:
        level = hazard.get(key)
        if level in (None, "unknown"):
            measured_clear = False
            continue
        if level == "very_high":
            score -= weight
            hit = True
            measured_clear = False
            negatives.append(f"{label} : zone à aléa très élevé (carte officielle).")
        elif level == "high":
            score -= weight - 2
            hit = True
            measured_clear = False
            negatives.append(f"{label} : zone à aléa élevé (carte officielle).")
        elif level == "medium":
            score -= 2
            measured_clear = False
            negatives.append(f"{label} : zone à aléa modéré (carte officielle).")
        elif level == "low":
            measured_clear = False
            negatives.append(f"{label} : aléa faible mais zone cartographiée.")

    elevation = hazard.get("elevation_m")
    if elevation is not None:
        if elevation < 5 and hazard.get("tsunami_risk") not in (None, "none"):
            score -= 2
            negatives.append(f"Altitude très basse ({elevation:g} m) en zone de submersion.")
        elif elevation >= 30:
            positives.append(f"Terrain en hauteur ({elevation:g} m).")

    if measured_clear and not hit:
        positives.append(
            "Hors de toute zone d'aléa cartographiée (inondation, tsunami, glissement)."
        )
    elif not hit and quake in ("low", "medium", None):
        positives.append("Aucun risque naturel critique détecté.")
    return max(0, min(20, score)), have_data


def _legal_risk_score(
    flags: list[dict], positives: list[str], negatives: list[str]
) -> tuple[int, bool]:
    score = 15
    codes = {f["flag_code"] for f in flags}
    hit = False
    for code, penalty in _LEGAL_CRITICAL.items():
        if code in codes:
            score -= penalty
            hit = True
    if "rebuild_forbidden" in codes:
        negatives.append("Reconstruction impossible (再建築不可).")
    if "leasehold_land" in codes:
        negatives.append("Terrain en bail, pas pleine propriété (借地権).")
    if "urbanization_control_zone" in codes:
        negatives.append("Zone d'urbanisation contrôlée (市街化調整区域).")
    if not hit:
        positives.append("Aucun red flag juridique critique détecté.")
    return max(0, min(15, score)), True


def _renovation_score(
    listing: dict, flags: list[dict], positives: list[str], negatives: list[str]
) -> tuple[int, bool]:
    score = 15
    work_flags = [f for f in flags if f.get("severity") == "warning"]
    if work_flags:
        score -= min(12, 3 * len(work_flags))
        negatives.append("Travaux probables (signaux dans l'annonce).")
    build_year = listing.get("build_year")
    have_data = build_year is not None
    if build_year is not None:
        if build_year < 1981:
            score -= 4
            negatives.append("Construit avant 1981 (norme antisismique ancienne).")
        elif build_year < 2000:
            score -= 2
            negatives.append("Maison ancienne.")
        else:
            positives.append("Construction relativement récente.")
    else:
        negatives.append("Année de construction inconnue.")
    return max(0, min(15, score)), have_data


def _personal_fit_score(
    listing: dict, prefs: dict, positives: list[str], negatives: list[str]
) -> tuple[int, bool]:
    score = 6
    have_data = bool(prefs)
    budget = prefs.get("max_budget_yen")
    price = _to_float(listing.get("price_yen"))
    if budget and price is not None:
        if price <= float(budget):
            score += 2
            positives.append("Dans le budget cible.")
        else:
            score -= 3
            negatives.append("Au-dessus du budget cible.")
    pref_types = prefs.get("property_types") or []
    if pref_types and listing.get("property_type") in pref_types:
        score += 2
    return max(0, min(10, score)), have_data


def _confidence(data_signals: list[bool]) -> tuple[int, str]:
    if not data_signals:
        return 0, "faible"
    ratio = sum(1 for s in data_signals if s) / len(data_signals)
    pct = round(ratio * 100)
    if pct >= 75:
        label = "élevée"
    elif pct >= 45:
        label = "moyenne"
    else:
        label = "faible"
    return pct, label


def score_listing(
    listing: dict,
    flags: list[dict] | None = None,
    hazard: dict | None = None,
    prefs: dict | None = None,
) -> ScoreResult:
    flags = flags or []
    prefs = prefs or {}
    positives: list[str] = []
    negatives: list[str] = []

    price_score, c_price = _price_score(listing.get("price_yen"), positives, negatives)
    location_score, c_loc = _location_score(listing, prefs, positives, negatives)
    natural_score, c_nat = _natural_risk_score(flags, hazard, positives, negatives)
    legal_score, c_legal = _legal_risk_score(flags, positives, negatives)
    reno_score, c_reno = _renovation_score(listing, flags, positives, negatives)
    fit_score, c_fit = _personal_fit_score(listing, prefs, positives, negatives)

    total = (
        price_score
        + location_score
        + natural_score
        + legal_score
        + reno_score
        + fit_score
    )

    # Plafonds de bon sens : un score additif ne doit jamais masquer un
    # deal-breaker (règles du cahier des charges).
    codes = {f.get("flag_code") for f in flags}
    status = (listing.get("listing_status") or "").lower()
    if status in ("sold", "gone") or "sold" in codes:
        if total > 40:
            total = 40
        negatives.append("Bien vendu ou disparu de la source : score plafonné à 40.")
    elif (
        status in ("under_negotiation", "paused")
        or codes & {"negotiating", "applications_suspended"}
    ):
        if total > 75:
            total = 75
        negatives.append("Négociation en cours / demandes suspendues : score plafonné à 75.")
    if codes & set(_LEGAL_CRITICAL):
        if total > 65:
            total = 65
        negatives.append(
            "Red flag juridique critique (ex. 再建築不可, 借地権) : score plafonné à 65."
        )

    confidence, conf_label = _confidence([c_price, c_loc, c_nat, c_legal, c_reno, c_fit])

    lines = [f"Score : {total}/100", ""]
    if positives:
        lines.append("Points positifs :")
        lines.extend(f"- {p}" for p in positives)
        lines.append("")
    if negatives:
        lines.append("Points négatifs :")
        lines.extend(f"- {n}" for n in negatives)
        lines.append("")
    lines.append(
        f"Confiance : {conf_label}, basée sur la complétude des données source "
        f"({confidence}%)."
    )
    explanation = "\n".join(lines).strip()

    return ScoreResult(
        total_score=total,
        price_score=price_score,
        location_score=location_score,
        natural_risk_score=natural_score,
        legal_risk_score=legal_score,
        renovation_score=reno_score,
        personal_fit_score=fit_score,
        confidence_score=confidence,
        explanation_fr=explanation,
        positives=positives,
        negatives=negatives,
    )
