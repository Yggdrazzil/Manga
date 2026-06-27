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
    resp = client.post("/listings/import-url", json={"url": "https://example.jp/imp/1"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["source_url"] == "https://example.jp/imp/1"
    assert data["listing_status"] == "unknown"
    # Re-importing the same URL returns the existing record, not an error.
    resp2 = client.post("/listings/import-url", json={"url": "https://example.jp/imp/1"})
    assert resp2.status_code == 201
    assert resp2.json()["id"] == data["id"]


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


def test_dashboard(client):
    client.post("/listings", json={"source_url": "https://a.jp/d1", "title_original": "再建築不可"})
    resp = client.get("/dashboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["stats"]["total"] >= 1
    assert "top_opportunities" in body
    assert "recent_listings" in body
