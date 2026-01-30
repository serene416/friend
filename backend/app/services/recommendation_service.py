from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from geoalchemy2.functions import ST_Distance
from geoalchemy2.elements import WKTElement
from app.models.sql import Place
from app.schemas.recommendation import RecommendationRequest, PlaceResponse
import random

class RecommendationService:
    async def get_recommendations(
        self, session: AsyncSession, request: RecommendationRequest
    ) -> list[PlaceResponse]:
        # 1. Create Point
        # PostGIS WKT format: POINT(lon lat)
        user_point = WKTElement(f"POINT({request.longitude} {request.latitude})", srid=4326)

        # 2. Query Places within radius (e.g. 5km)
        # Note: ST_Distance returns degrees for 4326, unless cast to geography.
        # Ideally: ST_Distance(Place.location, user_point, use_spheroid=True)
        # For prototype simplicity with limited data, we just fetch all and calculate distance approx or mock it.
        
        # Let's try to fetch all places first (assuming DB is small)
        result = await session.execute(select(Place))
        places = result.scalars().all()
        
        response_list = []
        for place in places:
            # Mock Distance (since we might not have real geo data loaded yet)
            distance = random.uniform(100, 5000) 
            
            # Mock Congestion (SK Open API placeholder)
            congestion = random.choice(["RELAXED", "NORMAL", "BUSY", "CROWDED"])
            
            # Mock Score (0-100) based on 'weather' or 'trend'
            score = place.trend_score + random.uniform(0, 20)

            response_list.append(PlaceResponse(
                id=place.id,
                name=place.name,
                address=place.address,
                category=place.category,
                distance_meters=round(distance, 1),
                score=round(score, 1),
                congestion_level=congestion,
                image_url=place.place_metadata.get("image_url") if place.place_metadata else None
            ))
            
        # Sort by score desc
        response_list.sort(key=lambda x: x.score, reverse=True)
        return response_list
