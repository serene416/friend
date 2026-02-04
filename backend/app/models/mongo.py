from pydantic import BaseModel, Field
from datetime import datetime
from uuid import UUID
from typing import Optional, Any

# MongoDB Models using Pydantic
# These will be used with Motor (async)

class RawCrawledData(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    source: str  # 'INSTAGRAM', 'BLOG', etc.
    url: str
    raw_content: Any  # JSON or weirdly nested dicts
    crawled_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True

class PlaceReview(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    place_id: str  # Store as string representation of UUID for easier querying in Mongo
    content: str
    author: Optional[str] = None
    sentiment_score: Optional[float] = None
    posted_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


class PlacePhoto(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    place_id: Optional[str] = None
    kakao_place_id: str
    image_url: str
    source: str
    captured_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True


class PlaceTrendRaw(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    kakao_place_id: str
    source: str
    window_days: int
    count: int
    sampled_at: datetime = Field(default_factory=datetime.utcnow)
    raw_payload: dict[str, Any] = Field(default_factory=dict)

    class Config:
        populate_by_name = True
