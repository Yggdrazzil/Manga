import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Source
from app.schemas.misc import SourceCreate, SourceOut, SourceUpdate

router = APIRouter(prefix="/sources", tags=["sources"])


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
