import os

import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set — skipping DB-backed tests")
    from sqlalchemy import create_engine, text

    eng = create_engine(TEST_DATABASE_URL, future=True)
    with eng.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()

    import app.models  # noqa: F401
    from app.database import Base

    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def client(engine, monkeypatch):
    from fastapi.testclient import TestClient
    from sqlalchemy.orm import sessionmaker

    # Disable real HTTP calls for API tests by default; tests that exercise
    # these paths re-patch the functions via their own monkeypatch.
    import app.services.dynamic_fetcher as dynamic_fetcher
    import app.services.fetcher as fetcher
    import app.services.geocoding as geocoding
    import app.services.hazard as hazard
    import app.services.hazard_tiles as hazard_tiles

    # Every fetch entry point is stubbed, not just the convenience wrapper:
    # fetch_page_smart escalates to a real browser otherwise.
    monkeypatch.setattr(fetcher, "fetch_html", lambda url: None)
    monkeypatch.setattr(fetcher, "fetch_page", lambda url: ("error", None))
    monkeypatch.setattr(dynamic_fetcher, "fetch_rendered", lambda url, **kw: ("disabled", None))
    monkeypatch.setattr(hazard_tiles, "fetch_hazard_tiles", lambda lat, lon, **kw: None)
    monkeypatch.setattr(geocoding, "geocode", lambda address: None)
    monkeypatch.setattr(hazard, "fetch_seismic_hazard", lambda lat, lon: None)

    from app.database import Base, get_db
    from app.main import app

    # Clean slate per test.
    Base.metadata.drop_all(engine)
    from sqlalchemy import text

    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.commit()
    Base.metadata.create_all(engine)

    TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
