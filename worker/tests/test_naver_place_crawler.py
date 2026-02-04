import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from worker.crawlers import naver_place


class NaverPlaceCrawlerTests(unittest.TestCase):
    def test_parse_naver_rating_summary_from_text(self):
        summary = naver_place._parse_naver_rating_summary("별점 4.6 평점 1,234명")
        self.assertEqual(summary["average_rating"], 4.6)
        self.assertEqual(summary["rating_count"], 1234)

    def test_parse_naver_rating_summary_from_html_fallback(self):
        summary = naver_place._parse_naver_rating_summary(
            "",
            '{"visitorReviewScore":4.28,"visitorReviewScoreCount":321}',
        )
        self.assertEqual(summary["average_rating"], 4.28)
        self.assertEqual(summary["rating_count"], 321)

    def test_parse_naver_rating_summary_from_visitor_reviews_payload(self):
        summary = naver_place._parse_naver_rating_summary(
            "",
            '{"visitorReviewsTotal":54,"visitorReviewsScore":4.31}',
        )
        self.assertEqual(summary["average_rating"], 4.31)
        self.assertEqual(summary["rating_count"], 54)

    def test_parse_naver_rating_summary_from_avg_rating_payload(self):
        summary = naver_place._parse_naver_rating_summary(
            "",
            '{"review":{"avgRating":4.13,"totalCount":42}}',
        )
        self.assertEqual(summary["average_rating"], 4.13)
        self.assertEqual(summary["rating_count"], 42)

    def test_parse_naver_rating_summary_from_participant_text(self):
        summary = naver_place._parse_naver_rating_summary("별점 4.5 31명 참여")
        self.assertEqual(summary["average_rating"], 4.5)
        self.assertEqual(summary["rating_count"], 31)

    def test_parse_naver_rating_summary_ignores_irrelevant_review_count(self):
        summary = naver_place._parse_naver_rating_summary("방문자 리뷰 120")
        self.assertEqual(summary, {})

    def test_mapping_name_cleaning_and_noise_filter(self):
        self.assertEqual(
            naver_place._clean_candidate_name("무늬와 공간갤러리,화랑"),
            "무늬와 공간갤러리",
        )
        self.assertTrue(naver_place._is_noisy_candidate_name("이미지수 4"))
        self.assertTrue(naver_place._is_noisy_candidate_name("운영 종료10:00에 운영 시작"))
        self.assertFalse(naver_place._is_noisy_candidate_name("무늬와 공간갤러리"))

    def test_mapping_score_selection_prefers_better_combined_score(self):
        candidates = [
            {
                "naver_place_id": "111",
                "matched_name": "강남 볼링장",
                "x": 127.2000,
                "y": 37.6000,
            },
            {
                "naver_place_id": "222",
                "matched_name": "강남역 볼링센터",
                "x": 127.0277,
                "y": 37.4981,
            },
        ]

        best, scored = naver_place._select_best_mapping_candidate(
            place_name="강남 볼링장",
            candidates=candidates,
            kakao_x=127.0276,
            kakao_y=37.4981,
        )

        self.assertIsNotNone(best)
        self.assertEqual(best["naver_place_id"], "222")
        self.assertEqual(len(scored), 2)

    def test_no_growth_guard_stops_after_limit(self):
        guard = naver_place._NoGrowthGuard(limit=2, baseline=5)

        self.assertFalse(guard.observe(5))
        self.assertTrue(guard.observe(5))
        self.assertFalse(guard.observe(6))
        self.assertFalse(guard.observe(6))
        self.assertTrue(guard.observe(6))

    def test_review_and_photo_dedup(self):
        deduped_reviews = naver_place._dedupe_reviews(
            [
                {"review_id": "r1", "content": "좋아요", "author": "u1", "posted_at": "2025.01.01."},
                {"review_id": "r1", "content": "좋아요", "author": "u1", "posted_at": "2025.01.01."},
                {"content": "재방문", "author": "u2", "posted_at": "2025.01.02."},
                {"content": "재방문", "author": "u2", "posted_at": "2025.01.02."},
            ]
        )
        self.assertEqual(len(deduped_reviews), 2)

        deduped_photos = naver_place._dedupe_photos(
            [
                {"image_url": "https://example.com/a.jpg?type=w400"},
                {"image_url": "https://example.com/a.jpg?type=w800"},
                {"image_url": "https://example.com/b.jpg"},
            ]
        )
        self.assertEqual(len(deduped_photos), 2)
        self.assertEqual({photo["image_url"] for photo in deduped_photos}, {"https://example.com/a.jpg", "https://example.com/b.jpg"})

        proxy_url_a = (
            "https://search.pstatic.net/common/?type=f&src="
            "https%3A%2F%2Fldb-phinf.pstatic.net%2Fabc.jpg"
        )
        proxy_url_b = (
            "https://search.pstatic.net/common/?type=g&src="
            "https%3A%2F%2Fldb-phinf.pstatic.net%2Fabc.jpg"
        )
        deduped_proxy_photos = naver_place._dedupe_photos(
            [
                {"image_url": proxy_url_a},
                {"image_url": proxy_url_b},
            ]
        )
        self.assertEqual(len(deduped_proxy_photos), 1)
        self.assertEqual(
            deduped_proxy_photos[0]["image_url"],
            "https://ldb-phinf.pstatic.net/abc.jpg",
        )

    def test_mapping_failure_returns_safe_payload(self):
        fake_session = MagicMock()

        with patch.object(naver_place, "_create_browser_session", return_value=fake_session), patch.object(
            naver_place,
            "_extract_mapping_candidates",
            side_effect=RuntimeError("mock playwright/network failure"),
        ), patch.object(naver_place, "_close_browser_session", return_value=None):
            payload = naver_place.resolve_naver_place_mapping(
                kakao_place_id="kakao-1",
                place_name="강남 볼링장",
                x=127.0276,
                y=37.4981,
            )

        self.assertEqual(payload["status"], "SKIPPED")
        self.assertEqual(payload["reason"], "search_error")
        self.assertFalse(payload["crawlable"])
        self.assertIsNone(payload["naver_place_id"])


if __name__ == "__main__":
    unittest.main()
