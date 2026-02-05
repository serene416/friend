import asyncio
from datetime import datetime
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

from app.schemas.recommendation import MidpointHotplaceRequest
from app.services.recommendation_service import (
    PREDEFINED_PLAY_KEYWORDS,
    RecommendationService,
)


class FakeKakaoLocalService:
    BASE_URL = "https://example.com"
    timeout = httpx.Timeout(5.0)

    def __init__(self, fail_keyword: str | None = None) -> None:
        self.fail_keyword = fail_keyword
        self.station_calls = 0
        self.keyword_queries: list[str] = []

    async def search_stations(self, **kwargs):
        self.station_calls += 1
        return [
            {
                "id": "station-1",
                "place_name": "강남역",
                "x": "127.0276",
                "y": "37.4979",
                "distance": "80",
            }
        ]

    async def search_places_by_keyword(self, *, query: str, **kwargs):
        self.keyword_queries.append(query)
        if self.fail_keyword and query.endswith(f" {self.fail_keyword}"):
            raise HTTPException(status_code=503, detail=f"forced keyword failure: {query}")

        keyword = query.split(" ", 1)[1]
        return [
            {
                "id": f"place-{keyword}",
                "place_name": f"{keyword}-테스트장소",
                "x": "127.0276",
                "y": "37.4979",
                "distance": "120",
            }
        ]


def _build_request() -> MidpointHotplaceRequest:
    return MidpointHotplaceRequest(
        participants=[
            {"lat": 37.0, "lng": 127.0},
            {"lat": 37.5, "lng": 127.5},
        ],
        station_radius=2000,
        station_limit=7,
        place_radius=800,
        keywords=["맛집"],
        size=5,
        pages=9,
    )


class RecommendationServiceTests(unittest.TestCase):
    @staticmethod
    def _run(coro):
        return asyncio.run(coro)

    def test_midpoint_hotplaces_blocks_when_expected_calls_exceed_guard(self):
        with patch.dict(
            os.environ,
            {"MAX_KAKAO_CALLS_PER_REQUEST": "50", "MIDPOINT_CACHE_TTL_SECONDS": "900"},
            clear=False,
        ):
            os.environ.pop("REDIS_URL", None)
            fake = FakeKakaoLocalService()
            service = RecommendationService(kakao_local_service=fake)

            with self.assertRaises(HTTPException) as context:
                self._run(service.get_midpoint_hotplaces(_build_request()))

            self.assertEqual(context.exception.status_code, 400)
            self.assertIn("Expected Kakao API calls exceed guard", str(context.exception.detail))
            self.assertEqual(fake.station_calls, 0)
            self.assertEqual(fake.keyword_queries, [])

    def test_midpoint_hotplaces_uses_all_predefined_keywords(self):
        with patch.dict(
            os.environ,
            {"MAX_KAKAO_CALLS_PER_REQUEST": "70", "MIDPOINT_CACHE_TTL_SECONDS": "900"},
            clear=False,
        ):
            os.environ.pop("REDIS_URL", None)
            fake = FakeKakaoLocalService()
            service = RecommendationService(kakao_local_service=fake)
            response = self._run(service.get_midpoint_hotplaces(_build_request()))

            self.assertEqual(response.meta.station_limit, 1)
            self.assertEqual(response.meta.pages, 1)
            self.assertEqual(response.meta.executed_keyword_count, len(PREDEFINED_PLAY_KEYWORDS))
            self.assertEqual(response.meta.expected_kakao_api_call_count, 58)
            self.assertEqual(response.meta.actual_kakao_api_call_count, 58)
            self.assertEqual(fake.station_calls, 1)
            self.assertEqual(len(fake.keyword_queries), len(PREDEFINED_PLAY_KEYWORDS))
            self.assertTrue(all(query.startswith("강남역 ") for query in fake.keyword_queries))
            for keyword in PREDEFINED_PLAY_KEYWORDS:
                self.assertIn(f"강남역 {keyword}", fake.keyword_queries)

    def test_midpoint_hotplaces_cache_hit_and_miss(self):
        with patch.dict(
            os.environ,
            {"MAX_KAKAO_CALLS_PER_REQUEST": "70", "MIDPOINT_CACHE_TTL_SECONDS": "900"},
            clear=False,
        ):
            os.environ.pop("REDIS_URL", None)
            fake = FakeKakaoLocalService()
            service = RecommendationService(kakao_local_service=fake)
            first = self._run(service.get_midpoint_hotplaces(_build_request()))
            second = self._run(service.get_midpoint_hotplaces(_build_request()))

            self.assertFalse(first.meta.cache_hit)
            self.assertTrue(second.meta.cache_hit)
            self.assertEqual(second.meta.actual_kakao_api_call_count, 0)
            self.assertEqual(fake.station_calls, 1)
            self.assertEqual(len(fake.keyword_queries), len(PREDEFINED_PLAY_KEYWORDS))

    def test_extract_rating_summary_from_feature_payload(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        rating, rating_count = service._extract_rating_summary_from_feature_payload(
            {
                "naver_rating_summary": {
                    "average_rating": 4.37,
                    "rating_count": 1289,
                }
            }
        )
        self.assertEqual(rating, 4.37)
        self.assertEqual(rating_count, 1289)

    def test_extract_photo_collection_status_marks_failed_on_mapping_reason(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        status_value, reason = service._extract_photo_collection_status_from_feature_payload(
            {"naver_mapping": {"reason": "no_candidates"}},
            has_photo=False,
            last_ingested_at=datetime.utcnow(),
        )
        self.assertEqual(status_value, "FAILED")
        self.assertEqual(reason, "no_candidates")

    def test_extract_photo_collection_status_marks_empty_when_crawled_without_photos(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        status_value, reason = service._extract_photo_collection_status_from_feature_payload(
            {},
            has_photo=False,
            last_ingested_at=datetime.utcnow(),
        )
        self.assertEqual(status_value, "EMPTY")
        self.assertIsNone(reason)

    def test_midpoint_hotplaces_fails_entire_request_on_single_keyword_error(self):
        with patch.dict(
            os.environ,
            {
                "MAX_KAKAO_CALLS_PER_REQUEST": "70",
                "MIDPOINT_KEYWORD_CONCURRENCY": "1",
                "MIDPOINT_CACHE_TTL_SECONDS": "900",
            },
            clear=False,
        ):
            os.environ.pop("REDIS_URL", None)
            fake = FakeKakaoLocalService(fail_keyword="볼링장")
            service = RecommendationService(kakao_local_service=fake)

            with self.assertRaises(HTTPException) as context:
                self._run(service.get_midpoint_hotplaces(_build_request()))

            self.assertEqual(context.exception.status_code, 503)
            self.assertIn("all-or-nothing policy", str(context.exception.detail))
            self.assertEqual(fake.station_calls, 1)

    def test_midpoint_hotplaces_response_unchanged_when_ingestion_enqueue_fails(self):
        with patch.dict(
            os.environ,
            {
                "MAX_KAKAO_CALLS_PER_REQUEST": "70",
                "MIDPOINT_ENABLE_INGESTION_ENQUEUE": "true",
                "MIDPOINT_CACHE_TTL_SECONDS": "900",
            },
            clear=False,
        ):
            os.environ.pop("REDIS_URL", None)
            fake = FakeKakaoLocalService()
            service = RecommendationService(kakao_local_service=fake)

            with patch(
                "app.services.recommendation_service.create_ingestion_job_from_hotplaces",
                new=AsyncMock(side_effect=RuntimeError("enqueue failed")),
            ) as mock_enqueue:
                response = self._run(service.get_midpoint_hotplaces(_build_request()))

            self.assertGreater(response.meta.hotplace_count, 0)
            self.assertEqual(response.meta.actual_kakao_api_call_count, 58)
            mock_enqueue.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
