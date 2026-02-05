import asyncio
from datetime import datetime
import os
import unittest
from unittest.mock import AsyncMock, patch

import httpx
from fastapi import HTTPException

from app.schemas.recommendation import MidpointHotplace, MidpointHotplaceRequest
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

    @staticmethod
    def _build_hotplace(
        *,
        kakao_place_id: str,
        source_keyword: str,
        x: float,
        y: float,
        rating: float,
        rating_count: int,
    ) -> MidpointHotplace:
        return MidpointHotplace(
            kakao_place_id=kakao_place_id,
            place_name=f"{kakao_place_id}-name",
            x=x,
            y=y,
            source_station="강남",
            source_keyword=source_keyword,
            naver_rating=rating,
            naver_rating_count=rating_count,
        )

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
                expected_query = f"강남역 {service._build_keyword_search_phrase(keyword)}"
                self.assertIn(expected_query, fake.keyword_queries)

    def test_build_keyword_search_phrase_applies_optimized_overrides(self):
        self.assertEqual(
            RecommendationService._build_keyword_search_phrase("방탈출"),
            "방탈출 카페",
        )
        self.assertEqual(
            RecommendationService._build_keyword_search_phrase("반지공방"),
            "반지만들기",
        )
        self.assertEqual(
            RecommendationService._build_keyword_search_phrase("소품샵"),
            "소품샵 구경",
        )
        self.assertEqual(
            RecommendationService._build_keyword_search_phrase("볼링장"),
            "볼링장",
        )

    def test_build_default_activity_intro_prefers_station_and_keyword(self):
        intro = RecommendationService._build_default_activity_intro(
            place_name="테스트 장소",
            source_station="강남역",
            source_keyword="보드게임카페",
            category_name="게임 카페",
        )
        self.assertEqual(
            intro,
            "테스트 장소은 강남역 근처에서 보드게임카페를 즐기기 좋은 장소예요.",
        )

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

    def test_extract_activity_intro_from_feature_payload(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        intro = service._extract_activity_intro_from_feature_payload(
            {"place_intro": "  강남역 근처에서 가볍게 즐기기 좋아요.  "}
        )
        self.assertEqual(intro, "강남역 근처에서 가볍게 즐기기 좋아요.")

    def test_extract_activity_intro_from_feature_payload_rejects_invalid_value(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        intro = service._extract_activity_intro_from_feature_payload({"place_intro": {"text": "invalid"}})
        self.assertIsNone(intro)

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

    def test_rank_hotplaces_prefers_indoor_category_for_rainy_weather(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        request = MidpointHotplaceRequest(
            participants=[
                {"lat": 37.5000, "lng": 127.0000},
                {"lat": 37.5000, "lng": 127.0600},
            ],
            weather_key="비",
        )
        indoor = self._build_hotplace(
            kakao_place_id="indoor-1",
            source_keyword="볼링장",
            x=127.0300,
            y=37.5000,
            rating=4.4,
            rating_count=500,
        )
        outdoor = self._build_hotplace(
            kakao_place_id="outdoor-1",
            source_keyword="인생네컷",
            x=127.0300,
            y=37.5000,
            rating=4.7,
            rating_count=400,
        )

        ranked = service._rank_hotplaces([outdoor, indoor], request)

        self.assertEqual(ranked[0].kakao_place_id, "indoor-1")
        self.assertIsNotNone(ranked[0].ranking_score)
        self.assertIsNotNone(ranked[1].ranking_score)
        self.assertGreater(ranked[0].ranking_score, ranked[1].ranking_score)

    def test_rank_hotplaces_prefers_outdoor_friendly_category_for_clear_weather(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        request = MidpointHotplaceRequest(
            participants=[
                {"lat": 37.5000, "lng": 127.0000},
                {"lat": 37.5000, "lng": 127.0600},
            ],
            weather_key="맑음",
        )
        indoor = self._build_hotplace(
            kakao_place_id="indoor-1",
            source_keyword="볼링장",
            x=127.0300,
            y=37.5000,
            rating=4.4,
            rating_count=500,
        )
        outdoor = self._build_hotplace(
            kakao_place_id="outdoor-1",
            source_keyword="인생네컷",
            x=127.0300,
            y=37.5000,
            rating=4.7,
            rating_count=400,
        )

        ranked = service._rank_hotplaces([indoor, outdoor], request)

        self.assertEqual(ranked[0].kakao_place_id, "outdoor-1")
        self.assertIsNotNone(ranked[0].ranking_score)
        self.assertIsNotNone(ranked[1].ranking_score)
        self.assertGreater(ranked[0].ranking_score, ranked[1].ranking_score)

    def test_rank_hotplaces_boosts_high_review_count_over_rating_gap(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        request = MidpointHotplaceRequest(
            participants=[
                {"lat": 37.5000, "lng": 127.0000},
                {"lat": 37.5000, "lng": 127.0600},
            ],
            weather_key=None,
        )
        high_rating_low_reviews = self._build_hotplace(
            kakao_place_id="high-rating-low-reviews",
            source_keyword="보드게임카페",
            x=127.0300,
            y=37.5000,
            rating=4.9,
            rating_count=5,
        )
        lower_rating_high_reviews = self._build_hotplace(
            kakao_place_id="lower-rating-high-reviews",
            source_keyword="보드게임카페",
            x=127.0300,
            y=37.5000,
            rating=4.2,
            rating_count=2000,
        )

        ranked = service._rank_hotplaces([high_rating_low_reviews, lower_rating_high_reviews], request)

        self.assertEqual(ranked[0].kakao_place_id, "lower-rating-high-reviews")
        self.assertGreater(ranked[0].ranking_score, ranked[1].ranking_score)

    def test_rank_hotplaces_filters_zero_rated_places_when_other_rated_places_exist(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        request = MidpointHotplaceRequest(
            participants=[
                {"lat": 37.5000, "lng": 127.0000},
                {"lat": 37.5000, "lng": 127.0600},
            ],
            weather_key=None,
        )
        zero_rating = self._build_hotplace(
            kakao_place_id="zero-rated",
            source_keyword="보드게임카페",
            x=127.0300,
            y=37.5000,
            rating=0.0,
            rating_count=120,
        )
        positive_rating = self._build_hotplace(
            kakao_place_id="positive-rated",
            source_keyword="보드게임카페",
            x=127.0300,
            y=37.5000,
            rating=4.1,
            rating_count=40,
        )

        ranked = service._rank_hotplaces([zero_rating, positive_rating], request)

        self.assertEqual(len(ranked), 1)
        self.assertEqual(ranked[0].kakao_place_id, "positive-rated")

    def test_cache_key_changes_when_weather_key_changes(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        base_request = _build_request()
        rainy_request = base_request.model_copy(update={"weather_key": "비"})

        base_key = service._build_cache_key(base_request)
        rainy_key = service._build_cache_key(rainy_request)

        self.assertNotEqual(base_key, rainy_key)

    def test_build_hotplace_filters_out_interior_related_places(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        excluded = service._build_hotplace(
            {
                "id": "interior-1",
                "place_name": "더좋은 인테리어",
                "category_name": "서비스,산업 > 건설,토목 > 인테리어",
                "x": "127.0276",
                "y": "37.4979",
            },
            source_station="강남",
            source_keyword="공방",
        )
        self.assertIsNone(excluded)
        excluded_design = service._build_hotplace(
            {
                "id": "design-1",
                "place_name": "모던디자인",
                "category_name": "서비스,산업 > 디자인",
                "x": "127.0276",
                "y": "37.4979",
            },
            source_station="강남",
            source_keyword="공방",
        )
        self.assertIsNone(excluded_design)

        kept = service._build_hotplace(
            {
                "id": "play-1",
                "place_name": "강남 보드게임카페",
                "category_name": "음식점 > 카페",
                "x": "127.0276",
                "y": "37.4979",
            },
            source_station="강남",
            source_keyword="보드게임카페",
        )
        self.assertIsNotNone(kept)

    def test_should_hide_hotplace_for_mapping_issue(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        self.assertTrue(
            service._should_hide_hotplace_for_mapping_issue(
                {"mapping_issue_reason": "low_confidence"}
            )
        )
        self.assertTrue(
            service._should_hide_hotplace_for_mapping_issue(
                {"photo_collection_reason": "no_candidates"}
            )
        )
        self.assertFalse(
            service._should_hide_hotplace_for_mapping_issue(
                {"mapping_issue_reason": "search_error"}
            )
        )

    def test_attach_hotplace_features_filters_mapping_issue_places(self):
        service = RecommendationService(kakao_local_service=FakeKakaoLocalService())
        target = MidpointHotplace(
            kakao_place_id="place-1",
            place_name="테스트 장소",
            x=127.0,
            y=37.0,
            source_station="강남",
            source_keyword="보드게임카페",
        )

        with patch.object(
            service,
            "_fetch_hotplace_feature_map",
            new=AsyncMock(
                return_value={
                    "place-1": {
                        "mapping_issue_reason": "low_confidence",
                        "photo_collection_reason": "low_confidence",
                    }
                }
            ),
        ):
            result = self._run(service._attach_hotplace_features([target], session=object()))

        self.assertEqual(result, [])


if __name__ == "__main__":
    unittest.main()
