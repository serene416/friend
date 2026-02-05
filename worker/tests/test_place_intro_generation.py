import unittest

from tasks import _build_place_intro, _extract_review_texts


class PlaceIntroGenerationTests(unittest.TestCase):
    def test_extract_review_texts_deduplicates_and_trims(self):
        reviews = [
            {"content": "  분위기가 좋아요  "},
            {"content": "분위기가    좋아요"},
            {"content": "ok"},
            {"content": None},
        ]

        extracted = _extract_review_texts(reviews)

        self.assertEqual(extracted, ["분위기가 좋아요"])

    def test_build_place_intro_uses_review_signals_and_rating(self):
        intro = _build_place_intro(
            item={
                "place_name": "테스트 플레이스",
                "source_keyword": "보드게임카페",
                "source_station": "강남역",
            },
            reviews=[
                {"content": "분위기도 좋고 서비스가 친절해서 만족했어요."},
                {"content": "가성비가 괜찮고 인테리어가 깔끔해요."},
            ],
            naver_rating_summary={"average_rating": 4.36, "rating_count": 231},
        )

        self.assertIn("강남역 근처", intro)
        self.assertIn("분위기", intro)
        self.assertIn("네이버 평점 4.4점(231명)", intro)

    def test_build_place_intro_falls_back_when_reviews_are_missing(self):
        intro = _build_place_intro(
            item={"place_name": "테스트 플레이스", "source_station": "잠실역"},
            reviews=[],
            naver_rating_summary={},
        )

        self.assertIn("잠실역 근처", intro)
        self.assertIn("기본 정보 중심", intro)


if __name__ == "__main__":
    unittest.main()
