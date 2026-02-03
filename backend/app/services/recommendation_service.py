import asyncio
import hashlib
import json
import logging
import os
import random
import time

import httpx
from fastapi import HTTPException, status
from geoalchemy2.elements import WKTElement
from redis.asyncio import Redis
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

logger = logging.getLogger("app.recommendation")

PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY: dict[str, list[str]] = {
    "실내 액티비티 & 스포츠": [
        "볼링장",
        "당구장",
        "포켓볼",
        "스크린야구",
        "스크린골프",
        "스크린테니스",
        "실내클라이밍",
        "양궁카페",
        "사격카페",
        "롤러스케이트장",
        "아이스링크",
        "탁구장",
        "풋살장",
    ],
    "게임 & 지적 유희": [
        "방탈출",
        "보드게임카페",
        "코인노래방",
        "노래연습장",
        "PC방",
        "오락실",
        "가챠샵",
        "홀덤펍",
        "마작카페",
        "레이싱카페",
    ],
    "문화 & 예술": [
        "영화관",
        "미술관",
        "전시회",
        "박물관",
        "소극장",
        "독립영화관",
        "팝업스토어",
        "북카페",
        "LP바",
    ],
    "이색 테마 카페": [
        "만화카페",
        "룸카페",
        "고양이카페",
        "강아지카페",
        "라쿤카페",
        "파충류카페",
        "드로잉카페",
        "심리상담카페",
        "족욕카페",
    ],
    "체험 & 원데이 클래스": [
        "공방",
        "향수공방",
        "도자기공방",
        "가죽공방",
        "베이킹클래스",
        "원데이클래스",
        "반지공방",
        "목공소",
    ],
    "기록 & 쇼핑": [
        "인생네컷",
        "셀프사진관",
        "포토이즘",
        "포토그레이",
        "소품샵",
        "편집샵",
        "유니크샵",
        "플리마켓",
    ],
}
PREDEFINED_PLAY_KEYWORDS: list[str] = [
    keyword
    for keywords in PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY.values()
    for keyword in keywords
]
FIXED_STATION_LIMIT = 1
FIXED_PAGES = 1


class RecommendationService:
    def __init__(self, kakao_local_service: KakaoLocalService | None = None) -> None:
        self.kakao_local_service = kakao_local_service or KakaoLocalService()
        self.fixed_station_limit = FIXED_STATION_LIMIT
        self.fixed_pages = FIXED_PAGES
        self.keyword_concurrency = self._get_int_env(
            "MIDPOINT_KEYWORD_CONCURRENCY", default=8, minimum=1
        )
        self.max_kakao_calls_per_request = self._get_int_env(
            "MAX_KAKAO_CALLS_PER_REQUEST", default=70, minimum=1
        )
        self.cache_ttl_seconds = self._get_int_env(
            "MIDPOINT_CACHE_TTL_SECONDS", default=900, minimum=1
        )

        self._redis_client: Redis | None = None
        self._redis_enabled = False
        redis_url = os.getenv("REDIS_URL")
        if redis_url:
            try:
                self._redis_client = Redis.from_url(
                    redis_url, encoding="utf-8", decode_responses=True
                )
                self._redis_enabled = True
            except Exception:
                logger.exception("Failed to initialize Redis cache client; using memory cache")
                self._redis_client = None
                self._redis_enabled = False
        self._memory_cache: dict[str, tuple[float, str]] = {}
        self._memory_cache_lock = asyncio.Lock()

    @staticmethod
    def _get_int_env(name: str, default: int, minimum: int) -> int:
        raw_value = os.getenv(name)
        if raw_value is None:
            return default
        try:
            parsed = int(raw_value)
        except ValueError:
            logger.warning("Invalid %s=%s; using default=%s", name, raw_value, default)
            return default
        return max(minimum, parsed)

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

    @staticmethod
    def _calculate_expected_kakao_calls(
        station_limit: int, keyword_count: int, pages: int
    ) -> int:
        return 1 + (station_limit * keyword_count * pages)

    def _build_cache_key(self, request: MidpointHotplaceRequest) -> str:
        participant_locations = sorted(
            (round(participant.lat, 6), round(participant.lng, 6))
            for participant in request.participants
        )
        payload = {
            "participants": participant_locations,
            "station_radius": request.station_radius,
            "place_radius": request.place_radius,
            "size": request.size,
            "station_limit": self.fixed_station_limit,
            "pages": self.fixed_pages,
            "keywords": PREDEFINED_PLAY_KEYWORDS,
        }
        serialized = json.dumps(payload, sort_keys=True, ensure_ascii=False)
        digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        return f"midpoint-hotplaces:{digest}"

    async def _get_cached_response(
        self, cache_key: str
    ) -> tuple[MidpointHotplaceResponse | None, str]:
        if self._redis_enabled and self._redis_client is not None:
            try:
                payload = await self._redis_client.get(cache_key)
                if payload:
                    return MidpointHotplaceResponse.model_validate_json(payload), "redis"
                return None, "redis"
            except Exception:
                logger.exception(
                    "Redis cache lookup failed for key=%s. Falling back to in-memory cache.",
                    cache_key,
                )
                self._redis_enabled = False

        now = time.monotonic()
        async with self._memory_cache_lock:
            cached = self._memory_cache.get(cache_key)
            if not cached:
                return None, "memory"
            expires_at, payload = cached
            if expires_at <= now:
                self._memory_cache.pop(cache_key, None)
                return None, "memory"
        try:
            return MidpointHotplaceResponse.model_validate_json(payload), "memory"
        except Exception:
            logger.exception("Failed to deserialize memory cache payload for key=%s", cache_key)
            async with self._memory_cache_lock:
                self._memory_cache.pop(cache_key, None)
            return None, "memory"

    async def _set_cached_response(self, cache_key: str, response: MidpointHotplaceResponse) -> str:
        payload = response.model_dump_json()
        if self._redis_enabled and self._redis_client is not None:
            try:
                await self._redis_client.setex(cache_key, self.cache_ttl_seconds, payload)
                return "redis"
            except Exception:
                logger.exception(
                    "Redis cache write failed for key=%s. Falling back to in-memory cache.",
                    cache_key,
                )
                self._redis_enabled = False

        expires_at = time.monotonic() + self.cache_ttl_seconds
        async with self._memory_cache_lock:
            self._memory_cache[cache_key] = (expires_at, payload)
        return "memory"

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
        page: int,
        request: MidpointHotplaceRequest,
        semaphore: asyncio.Semaphore,
    ) -> tuple[str, str, list[dict]]:
        query = f"{station.station_name} {keyword}".strip()
        try:
            async with semaphore:
                documents = await self.kakao_local_service.search_places_by_keyword(
                    client=client,
                    query=query,
                    x=station.x,
                    y=station.y,
                    radius=request.place_radius,
                    size=request.size,
                    page=page,
                )
        except Exception:
            logger.exception(
                "Keyword search failed at station=%s keyword=%s page=%s query=%s",
                station.original_name,
                keyword,
                page,
                query,
            )
            raise

        logger.info(
            "Keyword search success: query=%s station=%s keyword=%s page=%s result_count=%s sample=%s",
            query,
            station.original_name,
            keyword,
            page,
            len(documents),
            [doc.get("place_name") for doc in documents[:3]],
        )
        return station.station_name, keyword, documents

    async def get_midpoint_hotplaces(
        self, request: MidpointHotplaceRequest
    ) -> MidpointHotplaceResponse:
        applied_keywords = PREDEFINED_PLAY_KEYWORDS
        applied_station_limit = self.fixed_station_limit
        applied_pages = self.fixed_pages
        expected_kakao_calls = self._calculate_expected_kakao_calls(
            station_limit=applied_station_limit,
            keyword_count=len(applied_keywords),
            pages=applied_pages,
        )
        if expected_kakao_calls > self.max_kakao_calls_per_request:
            detail = (
                "Expected Kakao API calls exceed guard "
                f"(expected={expected_kakao_calls}, limit={self.max_kakao_calls_per_request}). "
                f"station_limit={applied_station_limit}, keyword_count={len(applied_keywords)}, pages={applied_pages}"
            )
            logger.warning("Midpoint hotplace request blocked by call guard: %s", detail)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

        midpoint = self._calculate_midpoint(request)
        cache_key = self._build_cache_key(request)
        cached_response, cache_backend = await self._get_cached_response(cache_key)
        if cached_response is not None:
            logger.info(
                "Midpoint hotplace cache hit: backend=%s midpoint=(%.6f, %.6f)",
                cache_backend,
                midpoint.lat,
                midpoint.lng,
            )
            cached_meta = cached_response.meta.model_copy(
                update={
                    "participant_count": len(request.participants),
                    "station_radius": request.station_radius,
                    "station_limit": applied_station_limit,
                    "place_radius": request.place_radius,
                    "keywords": applied_keywords,
                    "pages": applied_pages,
                    "cache_hit": True,
                    "cache_backend": cache_backend,
                    "cache_ttl_seconds": self.cache_ttl_seconds,
                    "executed_keyword_count": 0,
                    "expected_kakao_api_call_count": expected_kakao_calls,
                    "actual_kakao_api_call_count": 0,
                    "kakao_api_call_count": 0,
                }
            )
            return cached_response.model_copy(update={"meta": cached_meta})

        logger.info(
            "Midpoint hotplace request: participants=%s midpoint=(%.6f, %.6f) station_radius=%s "
            "requested_station_limit=%s applied_station_limit=%s place_radius=%s requested_keywords=%s "
            "applied_keyword_count=%s size=%s requested_pages=%s applied_pages=%s expected_calls=%s",
            len(request.participants),
            midpoint.lat,
            midpoint.lng,
            request.station_radius,
            request.station_limit,
            applied_station_limit,
            request.place_radius,
            request.keywords,
            len(applied_keywords),
            request.size,
            request.pages,
            applied_pages,
            expected_kakao_calls,
        )
        if request.keywords != applied_keywords:
            logger.info(
                "Ignoring request keywords due to fixed policy. requested=%s applied_count=%s",
                request.keywords,
                len(applied_keywords),
            )

        async with httpx.AsyncClient(
            base_url=self.kakao_local_service.BASE_URL,
            timeout=self.kakao_local_service.timeout,
        ) as client:
            station_docs = await self.kakao_local_service.search_stations(
                client=client,
                mid_lat=midpoint.lat,
                mid_lng=midpoint.lng,
                radius=request.station_radius,
                limit=applied_station_limit,
            )
            actual_kakao_calls = 1

            chosen_stations: list[MidpointStation] = []
            for station_doc in station_docs:
                station = self._build_station(station_doc)
                if station:
                    chosen_stations.append(station)

            chosen_stations = chosen_stations[:applied_station_limit]

            if not chosen_stations:
                logger.info(
                    "Midpoint hotplace result: no stations found near midpoint=(%.6f, %.6f)",
                    midpoint.lat,
                    midpoint.lng,
                )
                return MidpointHotplaceResponse(
                    midpoint=midpoint,
                    chosen_stations=[],
                    hotplaces=[],
                    meta=MidpointHotplaceMeta(
                        participant_count=len(request.participants),
                        station_radius=request.station_radius,
                        station_limit=applied_station_limit,
                        place_radius=request.place_radius,
                        keywords=applied_keywords,
                        size=request.size,
                        pages=applied_pages,
                        station_count=0,
                        hotplace_count=0,
                        keyword_request_count=0,
                        kakao_api_call_count=actual_kakao_calls,
                        executed_keyword_count=0,
                        expected_kakao_api_call_count=expected_kakao_calls,
                        actual_kakao_api_call_count=actual_kakao_calls,
                        cache_hit=False,
                        cache_backend=cache_backend,
                        cache_ttl_seconds=self.cache_ttl_seconds,
                    ),
                )

            semaphore = asyncio.Semaphore(self.keyword_concurrency)
            tasks = [
                self._fetch_keyword_page(
                    client=client,
                    station=station,
                    keyword=keyword,
                    page=page,
                    request=request,
                    semaphore=semaphore,
                )
                for station in chosen_stations
                for keyword in applied_keywords
                for page in range(1, applied_pages + 1)
            ]
            try:
                keyword_results = await asyncio.gather(*tasks)
            except Exception as exc:
                logger.exception(
                    "Midpoint keyword batch failed: midpoint=(%.6f, %.6f) stations=%s",
                    midpoint.lat,
                    midpoint.lng,
                    [station.original_name for station in chosen_stations],
                )
                if isinstance(exc, HTTPException):
                    raise HTTPException(
                        status_code=exc.status_code,
                        detail=(
                            f"{exc.detail}. "
                            "The entire midpoint-hotplaces request failed due to all-or-nothing policy."
                        ),
                    ) from exc
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=(
                        "Midpoint-hotplaces request failed due to one or more keyword search failures "
                        "(all-or-nothing policy)."
                    ),
                ) from exc
            actual_kakao_calls += len(tasks)

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

        logger.info(
            "Midpoint hotplace result: midpoint=(%.6f, %.6f) stations=%s hotplaces=%s sample_stations=%s sample_hotplaces=%s",
            midpoint.lat,
            midpoint.lng,
            len(chosen_stations),
            len(hotplaces),
            [station.original_name for station in chosen_stations[:3]],
            [hotplace.place_name for hotplace in hotplaces[:5]],
        )

        response = MidpointHotplaceResponse(
            midpoint=midpoint,
            chosen_stations=chosen_stations,
            hotplaces=hotplaces,
            meta=MidpointHotplaceMeta(
                participant_count=len(request.participants),
                station_radius=request.station_radius,
                station_limit=applied_station_limit,
                place_radius=request.place_radius,
                keywords=applied_keywords,
                size=request.size,
                pages=applied_pages,
                station_count=len(chosen_stations),
                hotplace_count=len(hotplaces),
                keyword_request_count=len(tasks),
                kakao_api_call_count=actual_kakao_calls,
                executed_keyword_count=len(applied_keywords),
                expected_kakao_api_call_count=expected_kakao_calls,
                actual_kakao_api_call_count=actual_kakao_calls,
                cache_hit=False,
                cache_backend=cache_backend,
                cache_ttl_seconds=self.cache_ttl_seconds,
            ),
        )

        cache_backend = await self._set_cached_response(cache_key, response)
        response.meta.cache_backend = cache_backend
        return response
