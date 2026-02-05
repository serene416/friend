from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from typing import List, Literal, Optional


class RecommendationRequest(BaseModel):
    latitude: float
    longitude: float
    # List of friend IDs to hang out with (for preference matching)
    companion_ids: List[UUID] = []


class PlaceResponse(BaseModel):
    id: UUID
    name: str
    address: str
    category: str
    image_url: Optional[str] = None
    distance_meters: Optional[float] = None
    score: float = 0.0
    congestion_level: str = "NORMAL" # NORMAL, BUSY, CROWDED

    class Config:
        from_attributes = True


class RecommendationResponse(BaseModel):
    weather_summary: str
    recommendations: List[PlaceResponse]


class MidpointParticipant(BaseModel):
    lat: float
    lng: float

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, value: float) -> float:
        if value < -90 or value > 90:
            raise ValueError("lat must be between -90 and 90")
        return value

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, value: float) -> float:
        if value < -180 or value > 180:
            raise ValueError("lng must be between -180 and 180")
        return value


class MidpointHotplaceRequest(BaseModel):
    participants: List[MidpointParticipant] = Field(..., min_length=2)
    station_radius: int = Field(default=2000, ge=1, le=20000)
    station_limit: int = Field(default=2, ge=1, le=15)
    place_radius: int = Field(default=800, ge=1, le=20000)
    keywords: List[str] = Field(default_factory=lambda: ["맛집", "놀거리"], min_length=1)
    size: int = Field(default=15, ge=1, le=15)
    pages: int = Field(default=2, ge=1, le=45)
    weather_key: Optional[str] = Field(default=None, max_length=16)

    @field_validator("keywords")
    @classmethod
    def validate_keywords(cls, values: List[str]) -> List[str]:
        normalized = [value.strip() for value in values if value.strip()]
        if not normalized:
            raise ValueError("keywords must contain at least one non-empty value")
        return normalized

    @field_validator("weather_key")
    @classmethod
    def validate_weather_key(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class Midpoint(BaseModel):
    lat: float
    lng: float


class MidpointStation(BaseModel):
    kakao_place_id: str
    station_name: str
    original_name: str
    category_name: Optional[str] = None
    address_name: Optional[str] = None
    road_address_name: Optional[str] = None
    place_url: Optional[str] = None
    x: float
    y: float
    distance: Optional[int] = None


class MidpointHotplace(BaseModel):
    kakao_place_id: str
    place_name: str
    category_name: Optional[str] = None
    address_name: Optional[str] = None
    road_address_name: Optional[str] = None
    place_url: Optional[str] = None
    x: float
    y: float
    distance: Optional[int] = None
    source_station: str
    source_keyword: str
    activity_intro: Optional[str] = None
    representative_image_url: Optional[str] = None
    photo_urls: List[str] = Field(default_factory=list)
    naver_rating: Optional[float] = None
    naver_rating_count: Optional[int] = None
    photo_collection_status: Literal["PENDING", "READY", "EMPTY", "FAILED"] = "PENDING"
    photo_collection_reason: Optional[str] = None
    ranking_score: Optional[float] = None
    ranking_reasons: List[str] = Field(default_factory=list)


class MidpointHotplaceMeta(BaseModel):
    participant_count: int
    station_radius: int
    station_limit: int
    place_radius: int
    keywords: List[str]
    size: int
    pages: int
    station_count: int
    hotplace_count: int
    keyword_request_count: int
    kakao_api_call_count: int
    executed_keyword_count: int
    expected_kakao_api_call_count: int
    actual_kakao_api_call_count: int
    ranking_weather_key: Optional[str] = None
    cache_hit: bool = False
    cache_backend: str = "memory"
    cache_ttl_seconds: int = 900


class MidpointHotplaceResponse(BaseModel):
    midpoint: Midpoint
    chosen_stations: List[MidpointStation]
    hotplaces: List[MidpointHotplace]
    meta: MidpointHotplaceMeta
