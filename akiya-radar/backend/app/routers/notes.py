import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Listing, ListingNote
from app.schemas.listing import NoteOut
from app.schemas.misc import NoteCreate, NoteUpdate

router = APIRouter(tags=["notes"])


@router.get("/listings/{listing_id}/notes", response_model=list[NoteOut])
def list_notes(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> list[ListingNote]:
    if db.get(Listing, listing_id) is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return list(
        db.execute(
            select(ListingNote)
            .where(ListingNote.listing_id == listing_id)
            .order_by(ListingNote.created_at.desc())
        ).scalars()
    )


@router.post(
    "/listings/{listing_id}/notes",
    response_model=NoteOut,
    status_code=status.HTTP_201_CREATED,
)
def create_note(
    listing_id: uuid.UUID, payload: NoteCreate, db: Session = Depends(get_db)
) -> ListingNote:
    if db.get(Listing, listing_id) is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    note = ListingNote(listing_id=listing_id, note=payload.note)
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: uuid.UUID, payload: NoteUpdate, db: Session = Depends(get_db)
) -> ListingNote:
    note = db.get(ListingNote, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    note.note = payload.note
    db.commit()
    db.refresh(note)
    return note


@router.delete("/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(note_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    note = db.get(ListingNote, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
