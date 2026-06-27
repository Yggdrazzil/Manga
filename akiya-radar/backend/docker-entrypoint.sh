#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] waiting for database…"
python - <<'PY'
import time
import sqlalchemy
from app.config import get_settings

url = get_settings().database_url
for attempt in range(30):
    try:
        engine = sqlalchemy.create_engine(url)
        with engine.connect() as conn:
            conn.execute(sqlalchemy.text("SELECT 1"))
        print("[entrypoint] database is ready")
        break
    except Exception as exc:  # noqa: BLE001
        print(f"[entrypoint] db not ready ({attempt+1}/30): {exc}")
        time.sleep(2)
else:
    raise SystemExit("[entrypoint] database never became ready")
PY

echo "[entrypoint] running migrations…"
alembic upgrade head

if [ "${SEED_ON_START:-true}" = "true" ]; then
  echo "[entrypoint] seeding mock data (idempotent)…"
  python -m app.seed || echo "[entrypoint] seed skipped/failed (non-fatal)"
fi

echo "[entrypoint] starting API…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${BACKEND_PORT:-8000}"
