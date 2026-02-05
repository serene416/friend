import asyncio
from datetime import datetime, timedelta
import hashlib
import json
import logging
import math
import os
import random
import time

import httpx
from fastapi import HTTPException, status
from geoalchemy2.elements import WKTElement
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.models.sql import Place, PlaceIngestionFeature
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
from app.services.ingestion_service import create_ingestion_job_from_hotplaces

logger = logging.getLogger("app.recommendation")

PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY: dict[str, list[str]] = {
    "액티브 & 스포츠": [
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
    "게임 & 소셜": [
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
    "창작 & 클래스": [
        "공방",
        "향수공방",
        "도자기공방",
        "가죽공방",
        "베이킹클래스",
        "원데이클래스",
        "반지공방",
        "목공소",
    ],
    "힐링 & 테마 카페": [
        "만화카페",
        "룸카페",
        "고양이카페",
        "강아지카페",
        "라쿤카페",
        "파충류카페",
        "드로잉카페",
        "심리상담카페",
        "족욕카페",
        "북카페",
        "LP바",
    ],
    "문화 & 예술": [
        "영화관",
        "미술관",
        "전시회",
        "박물관",
        "소극장",
        "독립영화관",
        "팝업스토어",
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


def _normalize_keyword(keyword: str) -> str:
    return "".join(keyword.split()).lower()


KEYWORD_TO_PLAY_CATEGORY: dict[str, str] = {
    _normalize_keyword(keyword): category
    for category, keywords in PREDEFINED_PLAY_KEYWORDS_BY_CATEGORY.items()
    for keyword in keywords
}
KEYWORD_TO_SEARCH_PHRASE: dict[str, str] = {
    _normalize_keyword("방탈출"): "방탈출 카페",
    _normalize_keyword("보드게임카페"): "보드게임 카페",
    _normalize_keyword("공방"): "공방 체험",
    _normalize_keyword("반지공방"): "반지만들기",
    _normalize_keyword("강아지카페"): "애견카페",
    _normalize_keyword("만화카페"): "이색카페 만화카페",
    _normalize_keyword("소극장"): "소극장 공연",
    _normalize_keyword("소품샵"): "소품샵 구경",
}
IRRELEVANT_PLACE_STRONG_FILTER_TERMS = {
    "인테리어",
    "종합장식",
    "설비",
    "공사",
    "interior",
}
IRRELEVANT_PLACE_DESIGN_TERMS = {"디자인", "design"}
IRRELEVANT_PLACE_DESIGN_CONTEXT_TERMS = {
    "건축",
    "건설",
    "토목",
    "시공",
    "리모델링",
    "집수리",
    "도배",
    "장판",
    "타일",
    "샷시",
}
HIDE_HOTPLACE_MAPPING_REASONS = {
    # Mapping issue buckets we decided to hide from the client.
    "no_candidates",
    "low_confidence",
}

FIXED_STATION_LIMIT = 1
FIXED_PAGES = 1
PHOTO_COLLECTION_FAILURE_REASONS = {
    "missing_place_name",
    "no_candidates",
    "low_confidence",
    "search_error",
    "missing_naver_place_id",
    "crawler_error",
    "naver_target_unavailable",
}

EARTH_RADIUS_KM = 6371.0
DISTANCE_DECAY_KM = 2.5
DISTANCE_FAIRNESS_DECAY_KM = 1.0
RATING_BASELINE = 3.5
RATING_SPAN = 1.5
RATING_CONFIDENCE_MAX_COUNT = 2000
BAYESIAN_PRIOR_MEAN = 4.2
BAYESIAN_PRIOR_WEIGHT = 80.0
REVIEW_COUNT_SCORE_EXPONENT = 1.35
NEUTRAL_COMPONENT_SCORE = 0.5
RAINY_WEATHER_KEYS = {"비", "눈"}
SUPPORTED_WEATHER_KEYS = {"맑음", "구름많음", "흐림", "비", "눈", "default"}
DEFAULT_RANKING_WEIGHTS = {
    "distance": 0.30,
    "rating": 0.05,
    "weather": 0.20,
    "confidence": 0.45,
}
RAINY_RANKING_WEIGHTS = {
    "distance": 0.25,
    "rating": 0.05,
    "weather": 0.25,
    "confidence": 0.45,
}
WEATHER_CATEGORY_SUITABILITY: dict[str, dict[str, float]] = {
    "맑음": {
        "액티브 & 스포츠": 0.78,
        "게임 & 소셜": 0.76,
        "문화 & 예술": 0.84,
        "힐링 & 테마 카페": 0.86,
        "창작 & 클래스": 0.82,
        "기록 & 쇼핑": 0.90,
        "기타": 0.75,
    },
    "구름많음": {
        "액티브 & 스포츠": 0.82,
        "게임 & 소셜": 0.82,
        "문화 & 예술": 0.85,
        "힐링 & 테마 카페": 0.87,
        "창작 & 클래스": 0.84,
        "기록 & 쇼핑": 0.84,
        "기타": 0.76,
    },
    "흐림": {
        "액티브 & 스포츠": 0.86,
        "게임 & 소셜": 0.86,
        "문화 & 예술": 0.88,
        "힐링 & 테마 카페": 0.88,
        "창작 & 클래스": 0.85,
        "기록 & 쇼핑": 0.78,
        "기타": 0.75,
    },
    "비": {
        "액티브 & 스포츠": 0.95,
        "게임 & 소셜": 0.95,
        "문화 & 예술": 0.90,
        "힐링 & 테마 카페": 0.92,
        "창작 & 클래스": 0.88,
        "기록 & 쇼핑": 0.70,
        "기타": 0.62,
    },
    "눈": {
        "액티브 & 스포츠": 0.95,
        "게임 & 소셜": 0.95,
        "문화 & 예술": 0.91,
        "힐링 & 테마 카페": 0.92,
        "창작 & 클래스": 0.88,
        "기록 & 쇼핑": 0.66,
        "기타": 0.60,
    },
    "default": {
        "액티브 & 스포츠": NEUTRAL_COMPONENT_SCORE,
        "게임 & 소셜": NEUTRAL_COMPONENT_SCORE,
        "문화 & 예술": NEUTRAL_COMPONENT_SCORE,
        "힐링 & 테마 카페": NEUTRAL_COMPONENT_SCORE,
        "창작 & 클래스": NEUTRAL_COMPONENT_SCORE,
        "기록 & 쇼핑": NEUTRAL_COMPONENT_SCORE,
        "기타": NEUTRAL_COMPONENT_SCORE,
    },
}


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
        self.log_full_kakao_results = self._get_bool_env(
            "MIDPOINT_LOG_FULL_KAKAO_RESULTS", default=False
        )
        self.enable_ingestion_enqueue = self._get_bool_env(
            "MIDPOINT_ENABLE_INGESTION_ENQUEUE", default=False
        )
        self.ingestion_min_recrawl_minutes = self._get_int_env(
            "MIDPOINT_INGESTION_MIN_RECRAWL_MINUTES", default=180, minimum=0
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

    @staticmethod
    def _get_bool_env(name: str, default: bool) -> bool:
        raw_value = os.getenv(name)
        if raw_value is None:
            return default
        normalized = raw_value.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        logger.warning("Invalid %s=%s; using default=%s", name, raw_value, default)
        return default

    @staticmethod
    def _to_json_log(data: object) -> str:
        try:
            return json.dumps(data, ensure_ascii=False)
        except TypeError:
            return str(data)

    @staticmethod
    def _normalize_photo_urls(raw_urls: object, max_count: int = 5) -> list[str]:
        if not isinstance(raw_urls, list):
            return []

        deduped: list[str] = []
        seen: set[str] = set()
        for value in raw_urls:
            if not isinstance(value, str):
                continue
            url = value.strip()
            if not url or not url.startswith("http") or url in seen:
                continue
            deduped.append(url)
            seen.add(url)
            if len(deduped) >= max_count:
                break
        return deduped

    @staticmethod
    def _to_optional_rating(value: object) -> float | None:
        if value is None or value == "":
            return None
        try:
            parsed = float(value)
        except (TypeError, ValueError):
            return None
        if parsed < 0 or parsed > 5:
            return None
        return round(parsed, 2)

    @staticmethod
    def _to_optional_positive_int(value: object) -> int | None:
        if value is None or value == "":
            return None
        try:
            parsed = int(float(value))
        except (TypeError, ValueError):
            return None
        if parsed <= 0:
            return None
        return parsed

    @staticmethod
    def _normalize_activity_intro(value: object) -> str | None:
        if not isinstance(value, str):
            return None
        normalized = " ".join(value.split()).strip()
        return normalized or None

    def _extract_photo_urls_from_feature_payload(self, feature_payload: object) -> list[str]:
        if not isinstance(feature_payload, dict):
            return []

        raw_samples = feature_payload.get("latest_photo_sample")
        if not isinstance(raw_samples, list):
            return []

        photo_urls = []
        for sample in raw_samples:
            if not isinstance(sample, dict):
                continue
            photo_urls.append(sample.get("image_url"))
        return self._normalize_photo_urls(photo_urls)

    def _extract_rating_summary_from_feature_payload(
        self,
        feature_payload: object,
    ) -> tuple[float | None, int | None]:
        if not isinstance(feature_payload, dict):
            return None, None

        raw_summary = feature_payload.get("naver_rating_summary")
        if not isinstance(raw_summary, dict):
            return None, None

        average_rating = self._to_optional_rating(raw_summary.get("average_rating"))
        rating_count = self._to_optional_positive_int(raw_summary.get("rating_count"))
        return average_rating, rating_count

    def _extract_activity_intro_from_feature_payload(
        self,
        feature_payload: object,
    ) -> str | None:
        if not isinstance(feature_payload, dict):
            return None
        return self._normalize_activity_intro(feature_payload.get("place_intro"))

    @staticmethod
    def _extract_mapping_reason_from_feature_payload(feature_payload: object) -> str | None:
        if not isinstance(feature_payload, dict):
            return None
        raw_mapping = feature_payload.get("naver_mapping")
        if not isinstance(raw_mapping, dict):
            return None
        reason = str(raw_mapping.get("reason") or "").strip().lower()
        return reason or None

    @staticmethod
    def _normalize_reason(value: object) -> str | None:
        reason = str(value or "").strip().lower()
        return reason or None

    @classmethod
    def _should_hide_hotplace_for_mapping_issue(cls, feature: object) -> bool:
        if not isinstance(feature, dict):
            return False

        mapping_reason = cls._normalize_reason(feature.get("mapping_issue_reason"))
        if mapping_reason in HIDE_HOTPLACE_MAPPING_REASONS:
            return True

        photo_reason = cls._normalize_reason(feature.get("photo_collection_reason"))
        return photo_reason in HIDE_HOTPLACE_MAPPING_REASONS

    def _extract_photo_collection_status_from_feature_payload(
        self,
        feature_payload: object,
        *,
        has_photo: bool,
        last_ingested_at: datetime | None,
    ) -> tuple[str, str | None]:
        if has_photo:
            return "READY", None

        if not isinstance(feature_payload, dict):
            return ("EMPTY", None) if last_ingested_at else ("PENDING", None)

        crawl_payload = feature_payload.get("naver_crawl")
        mapping_payload = feature_payload.get("naver_mapping")
        if not isinstance(crawl_payload, dict):
            crawl_payload = {}
        if not isinstance(mapping_payload, dict):
            mapping_payload = {}

        crawl_status = str(crawl_payload.get("status") or "").strip().upper()
        reason = (
            str(crawl_payload.get("skip_reason") or mapping_payload.get("reason") or "")
            .strip()
            .lower()
            or None
        )
        warnings = crawl_payload.get("warnings")
        if not isinstance(warnings, list):
            warnings = []

        if crawl_status in {"FAILED", "SKIPPED"}:
            return "FAILED", reason or "crawl_skipped"
        if reason in PHOTO_COLLECTION_FAILURE_REASONS:
            return "FAILED", reason
        if any("error" in str(warning).lower() for warning in warnings):
            return "FAILED", reason or "crawler_partial_error"
        if last_ingested_at:
            return "EMPTY", None
        return "PENDING", None

    async def _fetch_hotplace_feature_map(
        self,
        session: AsyncSession | None,
        kakao_place_ids: list[str],
    ) -> dict[str, dict[str, object]]:
        if session is None or not kakao_place_ids:
            return {}

        try:
            rows = (
                await session.execute(
                    select(PlaceIngestionFeature).where(
                        PlaceIngestionFeature.kakao_place_id.in_(kakao_place_ids)
                    )
                )
            ).scalars().all()
        except Exception:
            logger.warning(
                "Failed to load place_ingestion_feature data; continuing without ingestion features",
                exc_info=True,
            )
            return {}

        feature_map: dict[str, dict[str, object]] = {}
        for row in rows:
            photo_urls = self._extract_photo_urls_from_feature_payload(row.feature_payload)
            naver_rating, naver_rating_count = self._extract_rating_summary_from_feature_payload(
                row.feature_payload
            )
            activity_intro = self._extract_activity_intro_from_feature_payload(row.feature_payload)
            mapping_issue_reason = self._extract_mapping_reason_from_feature_payload(
                row.feature_payload
            )
            photo_collection_status, photo_collection_reason = (
                self._extract_photo_collection_status_from_feature_payload(
                    row.feature_payload,
                    has_photo=bool(photo_urls),
                    last_ingested_at=row.last_ingested_at,
                )
            )
            feature_map[row.kakao_place_id] = {
                "photo_urls": photo_urls,
                "naver_rating": naver_rating,
                "naver_rating_count": naver_rating_count,
                "activity_intro": activity_intro,
                "mapping_issue_reason": mapping_issue_reason,
                "photo_collection_status": photo_collection_status,
                "photo_collection_reason": photo_collection_reason,
                "last_ingested_at": row.last_ingested_at,
            }
        return feature_map

    async def _attach_hotplace_features(
        self,
        hotplaces: list[MidpointHotplace],
        session: AsyncSession | None,
    ) -> list[MidpointHotplace]:
        if not hotplaces:
            return hotplaces

        kakao_place_ids = [hotplace.kakao_place_id for hotplace in hotplaces]
        feature_map = await self._fetch_hotplace_feature_map(session, kakao_place_ids)
        if not feature_map:
            return hotplaces

        enriched: list[MidpointHotplace] = []
        filtered_by_mapping_issue = 0
        for hotplace in hotplaces:
            feature = feature_map.get(hotplace.kakao_place_id, {})
            if self._should_hide_hotplace_for_mapping_issue(feature):
                filtered_by_mapping_issue += 1
                continue

            raw_photo_urls = feature.get("photo_urls")
            photo_urls = (
                self._normalize_photo_urls(raw_photo_urls) if isinstance(raw_photo_urls, list) else []
            )
            representative = photo_urls[0] if photo_urls else hotplace.representative_image_url
            naver_rating = self._to_optional_rating(feature.get("naver_rating"))
            naver_rating_count = self._to_optional_positive_int(feature.get("naver_rating_count"))
            photo_collection_status = str(feature.get("photo_collection_status") or "").upper()
            if photo_collection_status not in {"PENDING", "READY", "EMPTY", "FAILED"}:
                photo_collection_status = hotplace.photo_collection_status
            photo_collection_reason = feature.get("photo_collection_reason")
            if not isinstance(photo_collection_reason, str):
                photo_collection_reason = hotplace.photo_collection_reason
            activity_intro = self._normalize_activity_intro(feature.get("activity_intro"))

            enriched.append(
                hotplace.model_copy(
                    update={
                        "photo_urls": photo_urls if photo_urls else hotplace.photo_urls,
                        "representative_image_url": representative,
                        "naver_rating": (
                            naver_rating if naver_rating is not None else hotplace.naver_rating
                        ),
                        "naver_rating_count": (
                            naver_rating_count
                            if naver_rating_count is not None
                            else hotplace.naver_rating_count
                        ),
                        "activity_intro": activity_intro
                        if activity_intro is not None
                        else hotplace.activity_intro,
                        "photo_collection_status": photo_collection_status,
                        "photo_collection_reason": photo_collection_reason,
                    }
                )
            )

        if filtered_by_mapping_issue:
            logger.info(
                "Filtered hotplaces due to mapping issues: filtered=%s total=%s reasons=%s",
                filtered_by_mapping_issue,
                len(hotplaces),
                sorted(HIDE_HOTPLACE_MAPPING_REASONS),
            )
        return enriched

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
    def _build_station_keyword(raw_station_name: str) -> str:
        station_name = raw_station_name.strip()
        if not station_name:
            return raw_station_name.strip()

        station_suffix_index = station_name.find("역")
        if station_suffix_index >= 0:
            # Keep only "<역명>역" to avoid extra line info like "월평역 대전 1호선".
            return station_name[: station_suffix_index + 1].strip()

        # Fallback: use the first token only.
        return station_name.split()[0]

    @staticmethod
    def _build_keyword_search_phrase(keyword: str) -> str:
        normalized = _normalize_keyword(keyword)
        return KEYWORD_TO_SEARCH_PHRASE.get(normalized, keyword)

    @staticmethod
    def _normalize_place_filter_text(raw_text: object | None) -> str:
        if not isinstance(raw_text, str):
            return ""
        return "".join(raw_text.strip().lower().split())

    @classmethod
    def _is_irrelevant_place_for_play(cls, place_doc: dict) -> bool:
        place_name = cls._normalize_place_filter_text(place_doc.get("place_name"))
        category_name = cls._normalize_place_filter_text(place_doc.get("category_name"))
        address_name = cls._normalize_place_filter_text(place_doc.get("address_name"))
        road_address_name = cls._normalize_place_filter_text(place_doc.get("road_address_name"))

        searchable = " ".join(
            token
            for token in (place_name, category_name, address_name, road_address_name)
            if token
        )
        if any(term in searchable for term in IRRELEVANT_PLACE_STRONG_FILTER_TERMS):
            return True

        searchable_name_category = " ".join(
            token for token in (place_name, category_name) if token
        )
        has_design_term = any(term in searchable_name_category for term in IRRELEVANT_PLACE_DESIGN_TERMS)
        if not has_design_term:
            return False

        if any(term in searchable_name_category for term in IRRELEVANT_PLACE_STRONG_FILTER_TERMS):
            return True
        if any(term in searchable_name_category for term in IRRELEVANT_PLACE_DESIGN_CONTEXT_TERMS):
            return True
        return category_name.endswith("디자인") or place_name.endswith("디자인")

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
            (round(participant.lat, 4), round(participant.lng, 4))
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
            "weather_key": self._normalize_weather_key(request.weather_key),
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
        if self._is_irrelevant_place_for_play(place_doc):
            return None

        default_intro = self._build_default_activity_intro(
            place_name=place_name,
            source_station=source_station,
            source_keyword=source_keyword,
            category_name=place_doc.get("category_name"),
        )

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
            activity_intro=default_intro,
        )

    @classmethod
    def _build_default_activity_intro(
        cls,
        *,
        place_name: str,
        source_station: str | None,
        source_keyword: str | None,
        category_name: object,
    ) -> str:
        station = (source_station or "").strip()
        keyword = (source_keyword or "").strip()
        category = category_name.strip() if isinstance(category_name, str) else ""

        if station and keyword:
            return f"{place_name}은 {station} 근처에서 {keyword}를 즐기기 좋은 장소예요."
        if station and category:
            return f"{place_name}은 {station} 인근에서 {category} 분위기를 즐기기 좋아요."
        if keyword:
            return f"{place_name}은 {keyword} 중심의 활동을 찾을 때 가볍게 들르기 좋아요."
        if category:
            return f"{place_name}은 {category} 카테고리로 추천되는 장소예요."
        return f"{place_name}은 친구들과 함께 방문하기 좋은 장소예요."

    @staticmethod
    def _map_keyword_to_play_category(
        source_keyword: str | None,
        fallback_category: str | None,
    ) -> str:
        if source_keyword:
            mapped = KEYWORD_TO_PLAY_CATEGORY.get(_normalize_keyword(source_keyword))
            if mapped:
                return mapped
        fallback = (fallback_category or "").strip()
        return fallback or "기타"

    @staticmethod
    def _clamp_unit(value: float) -> float:
        if value < 0:
            return 0.0
        if value > 1:
            return 1.0
        return value

    @staticmethod
    def _normalize_weather_key(raw_weather_key: str | None) -> str | None:
        if raw_weather_key is None:
            return None
        normalized = raw_weather_key.strip()
        if not normalized:
            return None
        if normalized in {"빗방울", "비/눈", "빗방울눈날림", "소나기"}:
            return "비"
        if normalized in {"눈날림"}:
            return "눈"
        if normalized not in SUPPORTED_WEATHER_KEYS:
            return "default"
        return normalized

    @staticmethod
    def _normalize_activity_category_for_weather(activity_category: str) -> str:
        if activity_category in WEATHER_CATEGORY_SUITABILITY["default"]:
            return activity_category

        compact = activity_category.replace(" ", "").lower()
        if any(
            token in compact
            for token in (
                "볼링",
                "당구",
                "클라이밍",
                "스크린",
                "풋살",
                "탁구",
                "양궁",
                "사격",
                "스케이트",
                "아이스링크",
                "스포츠",
            )
        ):
            return "액티브 & 스포츠"
        if any(
            token in compact
            for token in (
                "방탈출",
                "보드게임",
                "노래",
                "코인",
                "pc",
                "오락",
                "가챠",
                "홀덤",
                "마작",
                "게임",
            )
        ):
            return "게임 & 소셜"
        if any(token in compact for token in ("영화", "미술", "박물", "전시", "소극장", "극장", "아트")):
            return "문화 & 예술"
        if any(
            token in compact
            for token in ("공방", "클래스", "체험", "베이킹", "향수", "도자기", "가죽", "목공", "반지")
        ):
            return "창작 & 클래스"
        if any(
            token in compact
            for token in ("인생네컷", "셀프사진", "포토", "소품", "편집샵", "쇼핑", "플리마켓")
        ):
            return "기록 & 쇼핑"
        if "카페" in compact:
            return "힐링 & 테마 카페"
        return "기타"

    @staticmethod
    def _haversine_distance_km(
        from_lat: float,
        from_lng: float,
        to_lat: float,
        to_lng: float,
    ) -> float:
        lat_delta = math.radians(to_lat - from_lat)
        lng_delta = math.radians(to_lng - from_lng)
        from_lat_rad = math.radians(from_lat)
        to_lat_rad = math.radians(to_lat)
        haversine = (
            math.sin(lat_delta / 2) ** 2
            + math.cos(from_lat_rad) * math.cos(to_lat_rad) * (math.sin(lng_delta / 2) ** 2)
        )
        haversine = max(0.0, min(1.0, haversine))
        arc = 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
        return EARTH_RADIUS_KM * arc

    def _calculate_distance_score(
        self,
        hotplace: MidpointHotplace,
        request: MidpointHotplaceRequest,
    ) -> tuple[float, float | None, float | None]:
        if not (-90 <= hotplace.y <= 90 and -180 <= hotplace.x <= 180):
            return NEUTRAL_COMPONENT_SCORE, None, None
        if abs(hotplace.x) < 1e-9 and abs(hotplace.y) < 1e-9:
            return NEUTRAL_COMPONENT_SCORE, None, None

        participant_distances = [
            self._haversine_distance_km(
                from_lat=participant.lat,
                from_lng=participant.lng,
                to_lat=hotplace.y,
                to_lng=hotplace.x,
            )
            for participant in request.participants
        ]
        if not participant_distances:
            return NEUTRAL_COMPONENT_SCORE, None, None

        avg_distance = sum(participant_distances) / len(participant_distances)
        if len(participant_distances) > 1:
            variance = sum(
                (distance_km - avg_distance) ** 2 for distance_km in participant_distances
            ) / len(participant_distances)
            distance_std = math.sqrt(variance)
        else:
            distance_std = 0.0

        score = math.exp(-avg_distance / DISTANCE_DECAY_KM) * math.exp(
            -distance_std / DISTANCE_FAIRNESS_DECAY_KM
        )
        return self._clamp_unit(score), avg_distance, distance_std

    def _calculate_rating_score_and_confidence(
        self,
        hotplace: MidpointHotplace,
    ) -> tuple[float, float, float | None]:
        if hotplace.naver_rating is None:
            return NEUTRAL_COMPONENT_SCORE, NEUTRAL_COMPONENT_SCORE, None

        rating_count = max(hotplace.naver_rating_count or 0, 0)
        bayesian_rating = (
            (rating_count / (rating_count + BAYESIAN_PRIOR_WEIGHT)) * hotplace.naver_rating
            + (BAYESIAN_PRIOR_WEIGHT / (rating_count + BAYESIAN_PRIOR_WEIGHT))
            * BAYESIAN_PRIOR_MEAN
        )
        rating_score = self._clamp_unit((bayesian_rating - RATING_BASELINE) / RATING_SPAN)
        confidence_score = (
            self._clamp_unit(
                (
                    self._clamp_unit(math.log1p(rating_count) / math.log1p(RATING_CONFIDENCE_MAX_COUNT))
                )
                ** REVIEW_COUNT_SCORE_EXPONENT
            )
            if hotplace.naver_rating_count is not None
            else NEUTRAL_COMPONENT_SCORE
        )
        return rating_score, confidence_score, bayesian_rating

    def _calculate_weather_suitability_score(
        self,
        weather_key: str | None,
        activity_category: str,
    ) -> float:
        if weather_key is None:
            return NEUTRAL_COMPONENT_SCORE
        category_key = self._normalize_activity_category_for_weather(activity_category)
        weather_matrix = WEATHER_CATEGORY_SUITABILITY.get(
            weather_key, WEATHER_CATEGORY_SUITABILITY["default"]
        )
        score = weather_matrix.get(
            category_key, weather_matrix.get("기타", NEUTRAL_COMPONENT_SCORE)
        )
        return self._clamp_unit(score)

    @staticmethod
    def _resolve_ranking_weights(weather_key: str | None) -> dict[str, float]:
        return RAINY_RANKING_WEIGHTS if weather_key in RAINY_WEATHER_KEYS else DEFAULT_RANKING_WEIGHTS

    def _build_ranking_reasons(
        self,
        hotplace: MidpointHotplace,
        *,
        weather_key: str | None,
        activity_category: str,
        weather_score: float,
        avg_distance_km: float | None,
    ) -> list[str]:
        reasons: list[str] = []
        if avg_distance_km is not None:
            reasons.append(f"참여자 평균 이동거리 {avg_distance_km:.1f}km")

        if weather_key and weather_key != "default" and weather_score >= 0.85:
            reasons.append(f"{weather_key} 날씨에 잘 맞는 {activity_category}")

        if hotplace.naver_rating is not None:
            if hotplace.naver_rating_count is not None:
                reasons.append(
                    "네이버 평점 "
                    f"{hotplace.naver_rating:.1f}점 ({hotplace.naver_rating_count:,}명)"
                )
            else:
                reasons.append(f"네이버 평점 {hotplace.naver_rating:.1f}점")

        if not reasons:
            return ["거리·날씨·별점 균형 점수"]
        return reasons[:3]

    def _rank_hotplaces(
        self,
        hotplaces: list[MidpointHotplace],
        request: MidpointHotplaceRequest,
    ) -> list[MidpointHotplace]:
        if not hotplaces:
            return hotplaces

        weather_key = self._normalize_weather_key(request.weather_key)
        weights = self._resolve_ranking_weights(weather_key)
        ranked_hotplaces: list[MidpointHotplace] = []

        for hotplace in hotplaces:
            activity_category = self._map_keyword_to_play_category(
                hotplace.source_keyword,
                hotplace.category_name,
            )
            distance_score, avg_distance_km, _distance_std_km = self._calculate_distance_score(
                hotplace,
                request,
            )
            rating_score, confidence_score, _bayesian_rating = (
                self._calculate_rating_score_and_confidence(hotplace)
            )
            weather_score = self._calculate_weather_suitability_score(
                weather_key,
                activity_category,
            )
            final_score = self._clamp_unit(
                (weights["distance"] * distance_score)
                + (weights["rating"] * rating_score)
                + (weights["weather"] * weather_score)
                + (weights["confidence"] * confidence_score)
            )
            ranking_reasons = self._build_ranking_reasons(
                hotplace,
                weather_key=weather_key,
                activity_category=activity_category,
                weather_score=weather_score,
                avg_distance_km=avg_distance_km,
            )
            ranked_hotplaces.append(
                hotplace.model_copy(
                    update={
                        "ranking_score": round(final_score, 4),
                        "ranking_reasons": ranking_reasons,
                    }
                )
            )

        ranked_hotplaces.sort(
            key=lambda item: (
                -(item.ranking_score or 0.0),
                -(item.naver_rating_count or 0),
                item.distance is None,
                item.distance if item.distance is not None else float("inf"),
                item.kakao_place_id,
            )
        )
        return ranked_hotplaces

    async def _maybe_enqueue_ingestion_job(
        self,
        request: MidpointHotplaceRequest,
        midpoint: Midpoint,
        hotplaces: list[MidpointHotplace],
        session: AsyncSession | None = None,
    ) -> None:
        if not self.enable_ingestion_enqueue:
            return
        if not hotplaces:
            logger.info("Skipping ingestion enqueue because there are no hotplaces")
            return

        hotplaces_to_enqueue = hotplaces
        if session is not None and self.ingestion_min_recrawl_minutes > 0:
            feature_map = await self._fetch_hotplace_feature_map(
                session,
                [hotplace.kakao_place_id for hotplace in hotplaces],
            )
            threshold = timedelta(minutes=self.ingestion_min_recrawl_minutes)
            now = datetime.utcnow()
            filtered_hotplaces: list[MidpointHotplace] = []
            skipped_recently_ingested = 0

            for hotplace in hotplaces:
                feature = feature_map.get(hotplace.kakao_place_id, {})
                last_ingested_at = feature.get("last_ingested_at")
                if (
                    isinstance(last_ingested_at, datetime)
                    and now - last_ingested_at < threshold
                ):
                    skipped_recently_ingested += 1
                    continue
                filtered_hotplaces.append(hotplace)

            if skipped_recently_ingested:
                logger.info(
                    "Skipping %s hotplaces for ingestion due to recrawl cooldown (%s minutes)",
                    skipped_recently_ingested,
                    self.ingestion_min_recrawl_minutes,
                )
            hotplaces_to_enqueue = filtered_hotplaces

        if not hotplaces_to_enqueue:
            logger.info("Skipping ingestion enqueue because all hotplaces are within recrawl cooldown")
            return

        try:
            job_id = await create_ingestion_job_from_hotplaces(
                hotplaces=[hotplace.model_dump() for hotplace in hotplaces_to_enqueue],
                source="midpoint-hotplaces",
                request_context={
                    "participant_count": len(request.participants),
                    "station_radius": request.station_radius,
                    "place_radius": request.place_radius,
                    "size": request.size,
                    "pages": request.pages,
                    "midpoint": {"lat": midpoint.lat, "lng": midpoint.lng},
                    "requested_hotplace_count": len(hotplaces),
                    "enqueued_hotplace_count": len(hotplaces_to_enqueue),
                },
            )
            logger.info("Enqueued ingestion job from midpoint-hotplaces: job_id=%s", job_id)
        except Exception:
            logger.warning(
                "Failed to enqueue ingestion job for midpoint-hotplaces; continuing response flow",
                exc_info=True,
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
        query_station_name = self._build_station_keyword(station.original_name)
        keyword_search_phrase = self._build_keyword_search_phrase(keyword)
        query = f"{query_station_name} {keyword_search_phrase}".strip()
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
            "Keyword search success: query=%s station=%s keyword=%s phrase=%s page=%s result_count=%s sample=%s",
            query,
            station.original_name,
            keyword,
            keyword_search_phrase,
            page,
            len(documents),
            [doc.get("place_name") for doc in documents[:3]],
        )
        if self.log_full_kakao_results:
            logger.info(
                "KAKAO_RAW_KEYWORD_RESULTS query=%s station=%s keyword=%s phrase=%s page=%s documents=%s",
                query,
                station.original_name,
                keyword,
                keyword_search_phrase,
                page,
                self._to_json_log(documents),
            )
        return station.station_name, keyword, documents

    async def get_midpoint_hotplaces(
        self,
        request: MidpointHotplaceRequest,
        session: AsyncSession | None = None,
    ) -> MidpointHotplaceResponse:
        applied_keywords = PREDEFINED_PLAY_KEYWORDS
        applied_station_limit = self.fixed_station_limit
        applied_pages = self.fixed_pages
        normalized_weather_key = self._normalize_weather_key(request.weather_key)
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
                    "ranking_weather_key": normalized_weather_key,
                }
            )
            cached_hotplaces = await self._attach_hotplace_features(cached_response.hotplaces, session)
            ranked_hotplaces = self._rank_hotplaces(cached_hotplaces, request)
            return cached_response.model_copy(
                update={"meta": cached_meta, "hotplaces": ranked_hotplaces}
            )

        logger.info(
            "Midpoint hotplace request: participants=%s midpoint=(%.6f, %.6f) station_radius=%s "
            "requested_station_limit=%s applied_station_limit=%s place_radius=%s requested_keywords=%s "
            "applied_keyword_count=%s size=%s requested_pages=%s applied_pages=%s expected_calls=%s weather_key=%s",
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
            normalized_weather_key,
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
            if self.log_full_kakao_results:
                logger.info(
                    "KAKAO_RAW_STATION_RESULTS midpoint=(%.6f, %.6f) documents=%s",
                    midpoint.lat,
                    midpoint.lng,
                    self._to_json_log(station_docs),
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
                        ranking_weather_key=normalized_weather_key,
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
        hotplaces = await self._attach_hotplace_features(hotplaces, session)
        hotplaces = self._rank_hotplaces(hotplaces, request)

        if self.log_full_kakao_results:
            mapped_hotplaces = [
                {
                    "kakao_place_id": hotplace.kakao_place_id,
                    "place_name": hotplace.place_name,
                    "kakao_category_name": hotplace.category_name,
                    "source_keyword": hotplace.source_keyword,
                    "activity_category": self._map_keyword_to_play_category(
                        hotplace.source_keyword,
                        hotplace.category_name,
                    ),
                    "representative_image_url": hotplace.representative_image_url,
                    "photo_count": len(hotplace.photo_urls),
                    "naver_rating": hotplace.naver_rating,
                    "naver_rating_count": hotplace.naver_rating_count,
                    "ranking_score": hotplace.ranking_score,
                    "ranking_reasons": hotplace.ranking_reasons,
                }
                for hotplace in hotplaces
            ]
            logger.info(
                "MIDPOINT_MAPPED_HOTPLACE_RESULTS total=%s documents=%s",
                len(mapped_hotplaces),
                self._to_json_log(mapped_hotplaces),
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
                ranking_weather_key=normalized_weather_key,
                cache_hit=False,
                cache_backend=cache_backend,
                cache_ttl_seconds=self.cache_ttl_seconds,
            ),
        )

        cache_backend = await self._set_cached_response(cache_key, response)
        response.meta.cache_backend = cache_backend
        await self._maybe_enqueue_ingestion_job(
            request=request,
            midpoint=midpoint,
            hotplaces=hotplaces,
            session=session,
        )
        return response
