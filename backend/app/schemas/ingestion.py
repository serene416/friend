from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class IngestionHotplacePayload(BaseModel):
    kakao_place_id: str
    place_name: str | None = None
    x: float | None = None
    y: float | None = None
    source_keyword: str | None = None
    source_station: str | None = None


class CreateIngestionJobRequest(BaseModel):
    source: str = "internal"
    request_context: dict[str, Any] = Field(default_factory=dict)
    hotplaces: list[IngestionHotplacePayload] = Field(default_factory=list)


class CreateIngestionJobResponse(BaseModel):
    job_id: UUID
    status: str


class IngestionJobStatusResponse(BaseModel):
    job_id: UUID
    source: str
    status: str
    total_items: int
    completed_items: int
    failed_items: int
    created_at: datetime
    updated_at: datetime
