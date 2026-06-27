import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Listing, ListingTask
from app.schemas.listing import TaskOut
from app.schemas.misc import TaskCreate, TaskUpdate

router = APIRouter(tags=["tasks"])


@router.get("/listings/{listing_id}/tasks", response_model=list[TaskOut])
def list_tasks(listing_id: uuid.UUID, db: Session = Depends(get_db)) -> list[ListingTask]:
    if db.get(Listing, listing_id) is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return list(
        db.execute(
            select(ListingTask)
            .where(ListingTask.listing_id == listing_id)
            .order_by(ListingTask.created_at.desc())
        ).scalars()
    )


@router.post(
    "/listings/{listing_id}/tasks",
    response_model=TaskOut,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    listing_id: uuid.UUID, payload: TaskCreate, db: Session = Depends(get_db)
) -> ListingTask:
    if db.get(Listing, listing_id) is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    task = ListingTask(listing_id=listing_id, **payload.model_dump(exclude_unset=True))
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}", response_model=TaskOut)
def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, db: Session = Depends(get_db)
) -> ListingTask:
    task = db.get(ListingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db)) -> None:
    task = db.get(ListingTask, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
