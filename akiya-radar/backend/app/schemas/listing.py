import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class FlagOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    flag_code: str
    label_fr: str
    severity: str
    evidence_text: str | None = None
    explanation_fr: str | None = None
    recommended_action_fr: str | None = None


class ScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    total_score: int | None = None
    price_score: int | None = None
    location_score: int | None = None
    natural_risk_score: int | None = None
    legal_risk_score: int | None = None
    renovation_score: int | None = None
    personal_fit_score: int | None = None
    confidence_score: int | None = None
    explanation_fr: str | None = None
    created_at: datetime


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    note: str
    created_at: datetime
    updated_at: datetime


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    status: str
    due_date: date | None = None
    created_at: datetime
    updated_at: datetime


class PriceHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    price_yen: Decimal | None = None
    detected_at: datetime
    source_url: str | None = None


class ListingBase(BaseModel):
    title_original: str | None = None
    title_fr: str | None = None
    description_original: str | None = None
    description_fr: str | None = None
    summary_fr: str | None = None
    price_yen: Decimal | None = None
    price_eur: Decimal | None = None
    price_text_original: str | None = None
    prefecture: str | None = None
    city: str | None = None
    address_text: str | None = None
    lat: Decimal | None = None
    lon: Decimal | None = None
    geocode_accuracy: str | None = None
    land_area_m2: Decimal | None = None
    building_area_m2: Decimal | None = None
    floor_plan: str | None = None
    build_year: int | None = None
    property_type: str | None = None
    transaction_type: str | None = None
    listing_status: str | None = None
    personal_status: str | None = None
    favorite: bool | None = None
    rating: int | None = Field(default=None, ge=0, le=5)


class ListingCreate(ListingBase):
    source_url: str
    source_id: uuid.UUID | None = None
    external_id: str | None = None


class ListingUpdate(ListingBase):
    source_url: str | None = None


class ListingSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    source_url: str
    title_original: str | None = None
    title_fr: str | None = None
    summary_fr: str | None = None
    price_yen: Decimal | None = None
    price_eur: Decimal | None = None
    prefecture: str | None = None
    city: str | None = None
    lat: Decimal | None = None
    lon: Decimal | None = None
    geocode_accuracy: str | None = None
    land_area_m2: Decimal | None = None
    building_area_m2: Decimal | None = None
    build_year: int | None = None
    property_type: str | None = None
    listing_status: str | None = None
    personal_status: str
    favorite: bool
    rating: int | None = None
    flags: list[FlagOut] = []
    scores: list[ScoreOut] = []


class ListingDetail(ListingSummary):
    source_id: uuid.UUID | None = None
    external_id: str | None = None
    description_original: str | None = None
    description_fr: str | None = None
    price_text_original: str | None = None
    address_text: str | None = None
    floor_plan: str | None = None
    transaction_type: str | None = None
    first_seen_at: datetime | None = None
    last_seen_at: datetime | None = None
    source_updated_at: datetime | None = None
    created_at: datetime
    updated_at: datetime
    notes: list[NoteOut] = []
    tasks: list[TaskOut] = []
    price_history: list[PriceHistoryOut] = []


class ImportUrlRequest(BaseModel):
    url: str
    source_id: uuid.UUID | None = None


class DuplicateOut(BaseModel):
    listing_id: str
    reason: str
    confidence: str
    title: str | None = None
    city: str | None = None
    price_yen: Decimal | None = None


class ImportResult(BaseModel):
    listing: ListingDetail
    fetched: bool
    fields_filled: list[str] = []
    possible_duplicates: list[DuplicateOut] = []


class FavoriteRequest(BaseModel):
    favorite: bool


class ListingListResponse(BaseModel):
    items: list[ListingSummary]
    total: int
    limit: int
    offset: int
