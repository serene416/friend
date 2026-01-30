from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional

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
