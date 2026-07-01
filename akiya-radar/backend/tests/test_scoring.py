from decimal import Decimal

from app.services import scoring


def test_total_is_sum_of_components():
    listing = {"price_yen": Decimal(3_000_000), "prefecture": "福井県", "build_year": 1990}
    result = scoring.score_listing(listing)
    assert result.total_score == (
        result.price_score
        + result.location_score
        + result.natural_risk_score
        + result.legal_risk_score
        + result.renovation_score
        + result.personal_fit_score
    )
    assert 0 <= result.total_score <= 100


def test_critical_legal_flag_lowers_legal_score():
    listing = {"price_yen": Decimal(1_000_000), "prefecture": "島根県"}
    clean = scoring.score_listing(listing, flags=[])
    flagged = scoring.score_listing(
        listing, flags=[{"flag_code": "rebuild_forbidden", "severity": "critical"}]
    )
    assert flagged.legal_risk_score < clean.legal_risk_score
    assert flagged.total_score < clean.total_score


def test_cheaper_scores_higher_on_price():
    cheap = scoring.score_listing({"price_yen": Decimal(800_000)})
    pricey = scoring.score_listing({"price_yen": Decimal(25_000_000)})
    assert cheap.price_score > pricey.price_score


def test_missing_data_lowers_confidence():
    rich = scoring.score_listing(
        {
            "price_yen": Decimal(3_000_000),
            "prefecture": "福井県",
            "city": "敦賀市",
            "build_year": 2005,
            "geocode_accuracy": "exact",
        },
        hazard={"flood_risk": "low"},
        prefs={"max_budget_yen": 5_000_000},
    )
    poor = scoring.score_listing({})
    assert rich.confidence_score > poor.confidence_score


def test_explanation_is_present_and_structured():
    result = scoring.score_listing({"price_yen": Decimal(1_000_000)})
    assert "Score :" in result.explanation_fr
    assert "Confiance" in result.explanation_fr


def test_unknown_hazard_flagged_as_unverified():
    result = scoring.score_listing({"price_yen": Decimal(3_000_000)})
    assert any("non vérifié" in n for n in result.negatives)


def test_verified_seismic_hazard_affects_score():
    base = {"price_yen": Decimal(3_000_000), "prefecture": "福井県"}
    low = scoring.score_listing(base, hazard={"earthquake_risk": "low"})
    high = scoring.score_listing(base, hazard={"earthquake_risk": "high"})
    assert low.natural_risk_score > high.natural_risk_score
    assert any("faible (vérifié J-SHIS)" in p for p in low.positives)
    assert any("élevé" in n for n in high.negatives)
    # Verified data also stops the "non vérifié" caveat.
    assert not any("non vérifié" in n for n in low.negatives)


def test_target_region_boosts_location():
    base = scoring.score_listing({"prefecture": "福井県", "city": "敦賀市"})
    targeted = scoring.score_listing(
        {"prefecture": "福井県", "city": "敦賀市"},
        prefs={"target_regions": ["福井県"]},
    )
    assert targeted.location_score > base.location_score


def test_scores_within_component_bounds():
    result = scoring.score_listing(
        {"price_yen": Decimal(0), "prefecture": "X"},
        flags=[
            {"flag_code": "rebuild_forbidden", "severity": "critical"},
            {"flag_code": "leasehold_land", "severity": "critical"},
            {"flag_code": "roof_leak", "severity": "warning"},
        ],
    )
    assert 0 <= result.price_score <= 20
    assert 0 <= result.location_score <= 20
    assert 0 <= result.natural_risk_score <= 20
    assert 0 <= result.legal_risk_score <= 15
    assert 0 <= result.renovation_score <= 15
    assert 0 <= result.personal_fit_score <= 10
