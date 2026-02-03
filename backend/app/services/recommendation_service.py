import asyncio
import random

import httpx
from geoalchemy2.elements import WKTElement
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.sql import Place
from app.schemas.recommendation import (
    Midpoint,
    MidpointHotplace,
    MidpointHotplaceMeta,
    MidpointHotplaceRequest,
    MidpointHotplaceResponse,
    MidpointStation,
    PlaceResponse,
    RecommendationRequest,
)
from app.services.kakao_local_service import KakaoLocalService


class RecommendationService:
    def __init__(self) -> None:
        self.kakao_local_service = KakaoLocalService()

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

    @staticmethod
    def _normalize_station_name(raw_station_name: str) -> str:
        station_name = raw_station_name.strip()
        if station_name.endswith("역"):
            station_name = station_name[:-1].strip()
        return station_name or raw_station_name.strip()

    @staticmethod
    def _to_float(value: object | None, default: float = 0.0) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _to_optional_int(value: object | None) -> int | None:
        if value is None or value == "":
            return None
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _calculate_midpoint(request: MidpointHotplaceRequest) -> Midpoint:
        participant_count = len(request.participants)
        avg_lat = sum(participant.lat for participant in request.participants) / participant_count
        avg_lng = sum(participant.lng for participant in request.participants) / participant_count
        return Midpoint(lat=avg_lat, lng=avg_lng)

    def _build_station(self, station_doc: dict) -> MidpointStation | None:
        original_name = str(station_doc.get("place_name", "")).strip()
        station_id = str(station_doc.get("id", "")).strip()
        if not original_name or not station_id:
            return None

        return MidpointStation(
            kakao_place_id=station_id,
            station_name=self._normalize_station_name(original_name),
            original_name=original_name,
            category_name=station_doc.get("category_name"),
            address_name=station_doc.get("address_name"),
            road_address_name=station_doc.get("road_address_name"),
            place_url=station_doc.get("place_url"),
            x=self._to_float(station_doc.get("x")),
            y=self._to_float(station_doc.get("y")),
            distance=self._to_optional_int(station_doc.get("distance")),
        )

    def _build_hotplace(
        self,
        place_doc: dict,
        source_station: str,
        source_keyword: str,
    ) -> MidpointHotplace | None:
        place_id = str(place_doc.get("id", "")).strip()
        place_name = str(place_doc.get("place_name", "")).strip()
        if not place_id or not place_name:
            return None

        return MidpointHotplace(
            kakao_place_id=place_id,
            place_name=place_name,
            category_name=place_doc.get("category_name"),
            address_name=place_doc.get("address_name"),
            road_address_name=place_doc.get("road_address_name"),
            place_url=place_doc.get("place_url"),
            x=self._to_float(place_doc.get("x")),
            y=self._to_float(place_doc.get("y")),
            distance=self._to_optional_int(place_doc.get("distance")),
            source_station=source_station,
            source_keyword=source_keyword,
        )

    async def _fetch_keyword_page(
        self,
        client: httpx.AsyncClient,
        station: MidpointStation,
        keyword: str,
        request: MidpointHotplaceRequest,
        page: int,
    ) -> tuple[str, str, list[dict]]:
        query = f"{station.station_name} {keyword}".strip()
        documents = await self.kakao_local_service.search_places_by_keyword(
            client=client,
            query=query,
            x=station.x,
            y=station.y,
            radius=request.place_radius,
            size=request.size,
            page=page,
        )
        return station.station_name, keyword, documents

    async def get_midpoint_hotplaces(
        self, request: MidpointHotplaceRequest
    ) -> MidpointHotplaceResponse:
        midpoint = self._calculate_midpoint(request)

        async with httpx.AsyncClient(
            base_url=self.kakao_local_service.BASE_URL,
            timeout=self.kakao_local_service.timeout,
        ) as client:
            station_docs = await self.kakao_local_service.search_stations(
                client=client,
                mid_lat=midpoint.lat,
                mid_lng=midpoint.lng,
                radius=request.station_radius,
                limit=request.station_limit,
            )

            chosen_stations: list[MidpointStation] = []
            for station_doc in station_docs:
                station = self._build_station(station_doc)
                if station:
                    chosen_stations.append(station)

            chosen_stations = chosen_stations[: request.station_limit]

            if not chosen_stations:
                return MidpointHotplaceResponse(
                    midpoint=midpoint,
                    chosen_stations=[],
                    hotplaces=[],
                    meta=MidpointHotplaceMeta(
                        participant_count=len(request.participants),
                        station_radius=request.station_radius,
                        station_limit=request.station_limit,
                        place_radius=request.place_radius,
                        keywords=request.keywords,
                        size=request.size,
                        pages=request.pages,
                        station_count=0,
                        hotplace_count=0,
                        keyword_request_count=0,
                        kakao_api_call_count=1,
                    ),
                )

            tasks = [
                self._fetch_keyword_page(client, station, keyword, request, page)
                for station in chosen_stations
                for keyword in request.keywords
                for page in range(1, request.pages + 1)
            ]
            keyword_results = await asyncio.gather(*tasks)

        deduped_hotplaces: dict[str, MidpointHotplace] = {}
        for source_station, source_keyword, place_docs in keyword_results:
            for place_doc in place_docs:
                hotplace = self._build_hotplace(place_doc, source_station, source_keyword)
                if not hotplace:
                    continue
                if hotplace.kakao_place_id in deduped_hotplaces:
                    continue
                deduped_hotplaces[hotplace.kakao_place_id] = hotplace

        hotplaces = list(deduped_hotplaces.values())
        hotplaces.sort(
            key=lambda item: (item.distance is None, item.distance if item.distance is not None else 0)
        )

        return MidpointHotplaceResponse(
            midpoint=midpoint,
            chosen_stations=chosen_stations,
            hotplaces=hotplaces,
            meta=MidpointHotplaceMeta(
                participant_count=len(request.participants),
                station_radius=request.station_radius,
                station_limit=request.station_limit,
                place_radius=request.place_radius,
                keywords=request.keywords,
                size=request.size,
                pages=request.pages,
                station_count=len(chosen_stations),
                hotplace_count=len(hotplaces),
                keyword_request_count=len(tasks),
                kakao_api_call_count=1 + len(tasks),
            ),
        )
