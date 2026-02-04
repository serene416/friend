from datetime import datetime, timedelta


def _stable_seed(kakao_place_id: str) -> int:
    return sum(ord(char) for char in kakao_place_id)


def crawl_naver_reviews(kakao_place_id: str, place_name: str | None) -> list[dict]:
    """Placeholder adapter returning deterministic review-like data."""
    # TODO: Replace with real Naver Place crawler implementation.
    # - Implement authenticated session/cookie handling for protected pages.
    # - Parse review selectors reliably and handle pagination.
    # - Add rate-limit/backoff and bot-detection mitigation.
    seed = _stable_seed(kakao_place_id)
    now = datetime.utcnow()
    reviews = []
    for index in range(3):
        reviews.append(
            {
                "review_id": f"naver-review-{kakao_place_id}-{index}",
                "content": f"Placeholder review {index + 1} for {place_name or kakao_place_id}",
                "author": f"user_{(seed + index) % 17}",
                "posted_at": (now - timedelta(days=index + 1)).isoformat(),
                "rating": 3.0 + ((seed + index) % 20) / 10.0,
            }
        )
    return reviews


def crawl_naver_photos(kakao_place_id: str, place_name: str | None) -> list[dict]:
    """Placeholder adapter returning deterministic photo-like data."""
    # TODO: Replace with real Naver Place photo crawler implementation.
    # - Implement robust image extraction selectors for changing page DOM.
    # - Add duplicate-image filtering and source attribution metadata.
    # - Respect crawl quotas and delay policy to avoid throttling.
    seed = _stable_seed(kakao_place_id)
    captured_at = datetime.utcnow().isoformat()
    photos = []
    for index in range(2):
        photos.append(
            {
                "photo_id": f"naver-photo-{kakao_place_id}-{index}",
                "image_url": f"https://example.com/naver/{kakao_place_id}/{index}.jpg",
                "caption": f"Placeholder photo {index + 1} for {place_name or kakao_place_id}",
                "captured_at": captured_at,
                "quality_score": (seed + index) % 100,
            }
        )
    return photos
