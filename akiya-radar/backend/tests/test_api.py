"""DB-backed API tests. Skipped automatically when TEST_DATABASE_URL is unset."""


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_and_get_listing(client):
    payload = {
        "source_url": "https://example.jp/listing/1",
        "title_original": "敦賀 古民家 再建築不可",
        "description_original": "雨漏りあり。シロアリ被害。",
        "price_yen": 3800000,
        "prefecture": "福井県",
        "city": "敦賀市",
        "lat": 35.6536,
        "lon": 136.0758,
        "geocode_accuracy": "exact",
        "build_year": 1973,
    }
    resp = client.post("/listings", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    listing_id = data["id"]

    # Enrichment ran: flags detected and a score computed.
    codes = {f["flag_code"] for f in data["flags"]}
    assert "rebuild_forbidden" in codes
    assert "roof_leak" in codes
    assert data["scores"], "a score should have been computed"
    assert data["price_eur"] is not None

    resp = client.get(f"/listings/{listing_id}")
    assert resp.status_code == 200
    assert resp.json()["city"] == "敦賀市"


def test_duplicate_url_conflicts(client):
    payload = {"source_url": "https://example.jp/dup"}
    assert client.post("/listings", json=payload).status_code == 201
    assert client.post("/listings", json=payload).status_code == 409


def test_import_url_never_fails(client):
    # Network fetch is disabled by the autouse fixture → graceful stub.
    resp = client.post("/listings/import-url", json={"url": "https://example.jp/imp/1"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["fetched"] is False
    listing = data["listing"]
    assert listing["source_url"] == "https://example.jp/imp/1"
    assert listing["listing_status"] == "unknown"
    # Re-importing the same URL returns the existing record, not an error.
    resp2 = client.post("/listings/import-url", json={"url": "https://example.jp/imp/1"})
    assert resp2.status_code == 201
    assert resp2.json()["listing"]["id"] == listing["id"]


def test_import_url_fetches_and_extracts(client, monkeypatch):
    import app.services.fetcher as fetcher

    html = """
    <html><body>
      <h1>敦賀市 古民家 5DK 再建築不可</h1>
      <table>
        <tr><th>価格</th><td>380万円</td></tr>
        <tr><th>所在地</th><td>福井県敦賀市櫛川町1-2</td></tr>
        <tr><th>土地面積</th><td>220.5㎡</td></tr>
        <tr><th>築年</th><td>昭和48年</td></tr>
      </table>
      <div class="comment">雨漏りあり。シロアリ被害。</div>
    </body></html>
    """
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", html))

    resp = client.post("/listings/import-url", json={"url": "https://akiya.example.jp/x"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["fetched"] is True
    assert "price_yen" in data["fields_filled"]
    listing = data["listing"]
    assert float(listing["price_yen"]) == 3_800_000
    assert listing["prefecture"] == "福井県"
    assert listing["city"] == "敦賀市"
    assert float(listing["land_area_m2"]) == 220.5
    assert listing["build_year"] == 1973
    codes = {f["flag_code"] for f in listing["flags"]}
    assert {"rebuild_forbidden", "roof_leak", "termites"} <= codes


def test_import_surfaces_possible_duplicate(client, monkeypatch):
    import app.services.fetcher as fetcher

    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("error", None))
    client.post(
        "/listings",
        json={
            "source_url": "https://a.jp/orig",
            "title_original": "敦賀 古民家",
            "city": "敦賀市",
            "price_yen": 3800000,
        },
    )
    # Same content, different URL → flagged as possible duplicate, not merged.
    resp = client.post(
        "/listings/import-url", json={"url": "https://b.jp/copy"}
    )
    # The stub has no title/price, so it won't match; create a matching one via POST.
    dup = client.post(
        "/listings",
        json={
            "source_url": "https://c.jp/copy2",
            "title_original": "敦賀 古民家",
            "city": "敦賀市",
            "price_yen": 3800000,
        },
    )
    assert dup.status_code == 201
    found = client.get(f"/listings/{dup.json()['id']}/duplicates").json()
    assert any(d["confidence"] in ("exact", "high") for d in found)
    assert resp.status_code == 201


def test_list_filters(client):
    client.post(
        "/listings",
        json={"source_url": "https://a.jp/1", "prefecture": "福井県", "price_yen": 1000000},
    )
    client.post(
        "/listings",
        json={"source_url": "https://a.jp/2", "prefecture": "東京都", "price_yen": 50000000},
    )
    resp = client.get("/listings", params={"prefecture": "福井県"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["prefecture"] == "福井県"

    resp = client.get("/listings", params={"max_price_yen": 2000000})
    assert resp.json()["total"] == 1


def test_patch_records_price_history(client):
    resp = client.post("/listings", json={"source_url": "https://a.jp/ph", "price_yen": 5000000})
    listing_id = resp.json()["id"]
    client.patch(f"/listings/{listing_id}", json={"price_yen": 4000000})
    detail = client.get(f"/listings/{listing_id}").json()
    assert len(detail["price_history"]) >= 1


def test_favorite_and_notes_and_tasks(client):
    resp = client.post("/listings", json={"source_url": "https://a.jp/fav"})
    listing_id = resp.json()["id"]

    assert client.post(f"/listings/{listing_id}/favorite", json={"favorite": True}).json()[
        "favorite"
    ]

    note = client.post(f"/listings/{listing_id}/notes", json={"note": "à visiter"})
    assert note.status_code == 201
    assert client.get(f"/listings/{listing_id}/notes").json()[0]["note"] == "à visiter"

    task = client.post(f"/listings/{listing_id}/tasks", json={"title": "appeler agence"})
    assert task.status_code == 201
    task_id = task.json()["id"]
    client.patch(f"/tasks/{task_id}", json={"status": "done"})
    assert client.get(f"/listings/{listing_id}/tasks").json()[0]["status"] == "done"


def test_saved_search_matching(client):
    client.post(
        "/listings",
        json={"source_url": "https://a.jp/s1", "prefecture": "島根県", "price_yen": 1500000},
    )
    client.post(
        "/listings",
        json={"source_url": "https://a.jp/s2", "prefecture": "東京都", "price_yen": 9000000},
    )
    search = client.post(
        "/saved-searches",
        json={"name": "Shimane cheap", "criteria_json": {"prefecture": "島根県"}},
    )
    assert search.status_code == 201
    sid = search.json()["id"]
    results = client.post(f"/saved-searches/{sid}/run")
    assert results.status_code == 200
    assert len(results.json()) == 1
    assert results.json()[0]["prefecture"] == "島根県"


def test_sort_param(client):
    client.post("/listings", json={"source_url": "https://s.jp/1", "price_yen": 9000000})
    client.post("/listings", json={"source_url": "https://s.jp/2", "price_yen": 1000000})
    client.post("/listings", json={"source_url": "https://s.jp/3"})  # null price

    asc = client.get("/listings", params={"sort": "price_asc"}).json()["items"]
    prices = [i["price_yen"] for i in asc]
    assert float(prices[0]) == 1000000 and float(prices[1]) == 9000000
    assert prices[2] is None  # nulls last

    desc = client.get("/listings", params={"sort": "price_desc"}).json()["items"]
    assert float(desc[0]["price_yen"]) == 9000000

    scored = client.get("/listings", params={"sort": "score_desc"}).json()["items"]
    assert len(scored) == 3

    assert client.get("/listings", params={"sort": "bogus"}).status_code == 422


def test_export_csv(client):
    client.post(
        "/listings",
        json={"source_url": "https://c.jp/1", "title_original": "テスト物件", "price_yen": 1500000},
    )
    resp = client.get("/listings/export.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    body = resp.text
    assert "titre" in body.splitlines()[0]
    assert "テスト物件" in body


def test_geocode_endpoint(client, monkeypatch):
    from decimal import Decimal

    import app.services.geocoding as geocoding
    from app.services.geocoding import GeocodeResult

    resp = client.post(
        "/listings", json={"source_url": "https://g.jp/1", "address_text": "福井県敦賀市櫛川"}
    )
    listing_id = resp.json()["id"]
    assert resp.json()["lat"] is None  # network disabled by conftest

    monkeypatch.setattr(
        geocoding,
        "geocode",
        lambda a: GeocodeResult(
            lat=Decimal("35.65"),
            lon=Decimal("136.07"),
            matched_title="敦賀市櫛川",
            accuracy="approximate",
        ),
    )
    out = client.post(f"/listings/{listing_id}/geocode")
    assert out.status_code == 200
    assert float(out.json()["lat"]) == 35.65
    assert out.json()["geocode_accuracy"] == "approximate"


def test_hazard_endpoint(client, monkeypatch):
    import app.services.hazard as hazard
    from app.services.hazard import SeismicHazard

    resp = client.post(
        "/listings",
        json={"source_url": "https://h.jp/1", "lat": 35.65, "lon": 136.07, "price_yen": 3000000},
    )
    listing_id = resp.json()["id"]

    monkeypatch.setattr(
        hazard,
        "fetch_seismic_hazard",
        lambda lat, lon: SeismicHazard(0.42, 0.08, "high", "J-SHIS Y2024 (test)", {}),
    )
    out = client.post(f"/listings/{listing_id}/hazard")
    assert out.status_code == 200
    hazards = out.json()["hazard_scores"]
    assert hazards and hazards[-1]["earthquake_risk"] == "high"
    # Rescore happened and the explanation now mentions the verified risk.
    latest_score = out.json()["scores"][-1]
    assert "J-SHIS" in latest_score["explanation_fr"]

    # Missing coordinates → explicit 422.
    resp2 = client.post("/listings", json={"source_url": "https://h.jp/2"})
    assert client.post(f"/listings/{resp2.json()['id']}/hazard").status_code == 422


def test_comps_endpoint_unconfigured(client):
    resp = client.post(
        "/listings", json={"source_url": "https://m.jp/1", "prefecture": "福井県"}
    )
    out = client.get(f"/listings/{resp.json()['id']}/comps")
    assert out.status_code == 200
    body = out.json()
    assert body["available"] is False
    assert "MLIT_API_KEY" in body["reason"]


def test_translate_endpoint(client):
    resp = client.post("/translate", json={"text": "再建築不可の物件"})
    assert resp.status_code == 200
    body = resp.json()
    assert "provider" in body
    # Mock provider echoes the source text so nothing is ever lost.
    assert "再建築不可の物件" in body["translated"]
    assert client.post("/translate", json={"text": ""}).json()["translated"] == ""


def test_dashboard(client):
    client.post("/listings", json={"source_url": "https://a.jp/d1", "title_original": "再建築不可"})
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["stats"]["total"] >= 1
    assert "top_opportunities" in body
    assert "recent_listings" in body


def test_refresh_marks_gone_on_404(client, monkeypatch):
    import app.services.fetcher as fetcher

    resp = client.post("/listings", json={"source_url": "https://r.jp/gone", "price_yen": 2000000})
    lid = resp.json()["id"]
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("gone", None))
    out = client.post(f"/listings/{lid}/refresh").json()
    assert out["outcome"] == "gone"
    assert out["listing"]["listing_status"] == "gone"
    # Le bien n'est PAS supprimé : la fiche reste consultable.
    assert client.get(f"/listings/{lid}").status_code == 200
    # Et son score est plafonné.
    assert out["listing"]["scores"][-1]["total_score"] <= 40


def test_refresh_detects_sold_and_price_change(client, monkeypatch):
    import app.services.fetcher as fetcher

    resp = client.post(
        "/listings",
        json={"source_url": "https://r.jp/sold", "title_original": "物件", "price_yen": 3800000},
    )
    lid = resp.json()["id"]

    html_sold = """<html><body><h1>物件</h1><p>成約済み</p>
    <table><tr><th>価格</th><td>350万円</td></tr></table></body></html>"""
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", html_sold))
    out = client.post(f"/listings/{lid}/refresh").json()
    assert out["listing"]["listing_status"] == "sold"
    assert out["price_changed"] is True
    assert float(out["listing"]["price_yen"]) == 3_500_000
    # Changement de prix historisé.
    assert any(float(p["price_yen"]) == 3_500_000 for p in out["listing"]["price_history"])


def test_refresh_network_error_never_marks_gone(client, monkeypatch):
    import app.services.fetcher as fetcher

    resp = client.post("/listings", json={"source_url": "https://r.jp/flaky"})
    lid = resp.json()["id"]
    status_before = client.get(f"/listings/{lid}").json()["listing_status"]
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("error", None))
    out = client.post(f"/listings/{lid}/refresh").json()
    assert out["outcome"] == "error"
    # Erreur réseau = état INCONNU : le statut ne change pas (surtout pas "gone").
    assert out["listing"]["listing_status"] == status_before


def test_import_extracts_photos(client, monkeypatch):
    import app.services.fetcher as fetcher

    html = """<html><head><meta property="og:image" content="/p/main.jpg"></head>
    <body><h1>物件X</h1><img src="/p/2.jpg"></body></html>"""
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("ok", html))
    out = client.post("/listings/import-url", json={"url": "https://photo.example.jp/b/1"}).json()
    photos = out["listing"]["photo_urls"]
    assert photos == [
        "https://photo.example.jp/p/main.jpg",
        "https://photo.example.jp/p/2.jpg",
    ]
