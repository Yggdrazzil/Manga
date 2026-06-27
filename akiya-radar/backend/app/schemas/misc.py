import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SourceBase(BaseModel):
    name: str | None = None
    source_type: str | None = None
    base_url: str | None = None
    municipality: str | None = None
    prefecture: str | None = None
    crawl_enabled: bool | None = None
    crawl_frequency_days: int | None = None
    terms_note: str | None = None


class SourceCreate(SourceBase):
    name: str
    source_type: str


class SourceUpdate(SourceBase):
    pass


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    source_type: str
    base_url: str | None = None
    municipality: str | None = None
    prefecture: str | None = None
    crawl_enabled: bool
    crawl_frequency_days: int
    last_crawled_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime
    updated_at: datetime


class NoteCreate(BaseModel):
    note: str


class NoteUpdate(BaseModel):
    note: str


class TaskCreate(BaseModel):
    title: str
    status: str | None = None
    due_date: date | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    due_date: date | None = None


class SavedSearchCreate(BaseModel):
    name: str
    criteria_json: dict
    alert_enabled: bool | None = None
    alert_frequency: str | None = None


class SavedSearchUpdate(BaseModel):
    name: str | None = None
    criteria_json: dict | None = None
    alert_enabled: bool | None = None
    alert_frequency: str | None = None


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    criteria_json: dict
    alert_enabled: bool
    alert_frequency: str
    last_checked_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class HealthOut(BaseModel):
    status: str = "ok"
