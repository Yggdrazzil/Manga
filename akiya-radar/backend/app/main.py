from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import (
    auth,
    dashboard,
    health,
    listings,
    notes,
    saved_searches,
    sources,
    tasks,
)

settings = get_settings()

app = FastAPI(
    title="Akiya Radar API",
    version="0.1.0",
    description="Personal cockpit for searching, scoring and tracking Japanese akiya.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(listings.router)
app.include_router(sources.router)
app.include_router(notes.router)
app.include_router(tasks.router)
app.include_router(saved_searches.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"name": "Akiya Radar API", "docs": "/docs", "health": "/health"}
