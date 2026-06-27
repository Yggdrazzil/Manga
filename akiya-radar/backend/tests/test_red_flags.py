from app.services import red_flags


def test_detects_critical_rebuild_forbidden():
    flags = red_flags.detect_flags("再建築不可の物件です")
    codes = {f["flag_code"] for f in flags}
    assert "rebuild_forbidden" in codes
    flag = next(f for f in flags if f["flag_code"] == "rebuild_forbidden")
    assert flag["severity"] == "critical"
    assert flag["label_fr"]
    assert flag["explanation_fr"]
    assert flag["recommended_action_fr"]


def test_detects_multiple_flags_across_fields():
    flags = red_flags.detect_flags(
        "海が見える古民家",  # title
        "雨漏りあり。シロアリ被害。借地権物件。",  # description
    )
    codes = {f["flag_code"] for f in flags}
    assert {"roof_leak", "termites", "leasehold_land"} <= codes


def test_no_flags_on_clean_text():
    flags = red_flags.detect_flags("リフォーム済みの綺麗な一戸建てです。")
    assert flags == []


def test_each_flag_emitted_once():
    flags = red_flags.detect_flags("雨漏り 雨漏り 雨漏り")
    roof = [f for f in flags if f["flag_code"] == "roof_leak"]
    assert len(roof) == 1


def test_has_critical_flag_helper():
    flags = red_flags.detect_flags("市街化調整区域内の土地")
    assert red_flags.has_critical_flag(flags) is True
    assert red_flags.has_critical_flag([]) is False


def test_handles_none_and_empty():
    assert red_flags.detect_flags(None, "", None) == []


def test_status_flag_is_info():
    flags = red_flags.detect_flags("商談中の物件")
    flag = next(f for f in flags if f["flag_code"] == "negotiating")
    assert flag["severity"] == "info"


def test_evidence_text_present():
    flags = red_flags.detect_flags("この物件は再建築不可となっています")
    flag = next(f for f in flags if f["flag_code"] == "rebuild_forbidden")
    assert "再建築不可" in flag["evidence_text"]
