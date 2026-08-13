import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Source
from app.schemas.misc import SourceCreate, SourceOut, SourceUpdate
from app.services import catalog

router = APIRouter(prefix="/sources", tags=["sources"])


class CatalogEntryOut(BaseModel):
    key: str
    name: str
    source_type: str
    url: str
    prefecture: str | None = None
    municipality: str | None = None
    adapter: str
    crawlable: bool
    scope: str
    notes_fr: str | None = None
    requires_js: bool = False
    registered: bool = False


class CatalogResponse(BaseModel):
    items: list[CatalogEntryOut]
    total: int
    limit: int
    offset: int


class PrefectureCount(BaseModel):
    prefecture: str
    total: int
    structured: int


class CatalogAddRequest(BaseModel):
    keys: list[str] = Field(min_length=1, max_length=200)
    crawl_enabled: bool = False


class CatalogAddResult(BaseModel):
    added: list[SourceOut]
    skipped: list[str]


def _registered_urls(db: Session) -> set[str]:
    rows = db.execute(select(Source.base_url).where(Source.base_url.is_not(None))).scalars()
    return {(url or "").rstrip("/") for url in rows}


@router.get("/catalog", response_model=CatalogResponse)
def source_catalog(
    db: Session = Depends(get_db),
    query: str | None = None,
    prefecture: str | None = None,
    adapter: str | None = None,
    limit: int = Query(60, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> CatalogResponse:
    """Browse the bundled catalogue of real akiya-bank sources.

    Nothing here is live until it is registered: this endpoint is read-only and
    marks entries the user already added so the UI never offers a duplicate.
    """
    entries, total = catalog.search(
        query=query, prefecture=prefecture, adapter=adapter, limit=limit, offset=offset
    )
    known = _registered_urls(db)
    return CatalogResponse(
        items=[
            CatalogEntryOut(**entry.to_dict(), registered=entry.url.rstrip("/") in known)
            for entry in entries
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/catalog/prefectures", response_model=list[PrefectureCount])
def catalog_prefectures() -> list[dict]:
    return catalog.prefectures()


@router.post("/catalog/add", response_model=CatalogAddResult, status_code=status.HTTP_201_CREATED)
def add_from_catalog(
    payload: CatalogAddRequest, db: Session = Depends(get_db)
) -> CatalogAddResult:
    """Register catalogue entries as sources, skipping ones already present.

    Crawling stays opt-in (``crawl_enabled`` defaults to False) so registering a
    whole prefecture never starts fetching anything on its own.
    """
    known = _registered_urls(db)
    added: list[Source] = []
    skipped: list[str] = []

    for key in dict.fromkeys(payload.keys):
        entry = catalog.get(key)
        if entry is None or entry.url.rstrip("/") in known:
            skipped.append(key)
            continue
        source = Source(
            name=entry.name,
            source_type=entry.source_type,
            base_url=entry.url,
            prefecture=entry.prefecture,
            municipality=entry.municipality,
            crawl_enabled=payload.crawl_enabled and entry.crawlable,
            terms_note=entry.notes_fr,
        )
        db.add(source)
        added.append(source)
        known.add(entry.url.rstrip("/"))

    db.commit()
    for source in added:
        db.refresh(source)
    return CatalogAddResult(
        added=[SourceOut.model_validate(s) for s in added], skipped=skipped
    )


def _get_or_404(db: Session, source_id: uuid.UUID) -> Source:
    source = db.get(Source, source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Source not found")
    return source


@router.get("", response_model=list[SourceOut])
def list_sources(db: Session = Depends(get_db)) -> list[Source]:
    return list(db.execute(select(Source).order_by(Source.created_at.desc())).scalars())


@router.post("", response_model=SourceOut, status_code=status.HTTP_201_CREATED)
def create_source(payload: SourceCreate, db: Session = Depends(get_db)) -> Source:
    source = Source(**payload.model_dump(exclude_unset=True))
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


@router.get("/{source_id}", response_model=SourceOut)
def get_source(source_id: uuid.UUID, db: Session = Depends(get_db)) -> Source:
    return _get_or_404(db, source_id)


@router.patch("/{source_id}", response_model=SourceOut)
def update_source(
    source_id: uuid.UUID, payload: SourceUpdate, db: Session = Depends(get_db)
) -> Source:
    source = _get_or_404(db, source_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(source, key, value)
    db.commit()
    db.refresh(source)
    return source


@router.delete("/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_source(source_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    source = _get_or_404(db, source_id)
    db.delete(source)
    db.commit()


@router.post("/{source_id}/crawl", response_model=SourceOut)
def crawl_source(source_id: uuid.UUID, db: Session = Depends(get_db)) -> Source:
    """Placeholder: records a crawl attempt. Real crawling lives in the worker."""
    source = _get_or_404(db, source_id)
    source.last_crawled_at = datetime.now(UTC)
    source.last_error = "Crawling not implemented in MVP (handled by the worker)."
    db.commit()
    db.refresh(source)
    return source
