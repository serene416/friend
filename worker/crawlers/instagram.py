from datetime import datetime


def _stable_seed(kakao_place_id: str) -> int:
    return sum(ord(char) for char in kakao_place_id)


def crawl_instagram_trend(kakao_place_id: str, place_name: str | None) -> dict:
    """Placeholder adapter returning deterministic trend metrics."""
    # TODO: Replace with real Instagram trend ingestion.
    # - Integrate authenticated API or legal scraping path.
    # - Add hashtag/location query planner and sampling strategy.
    # - Implement per-keyword and per-account rate-limit controls.
    seed = _stable_seed(kakao_place_id)
    freq_7d = float((seed % 40) + 10) / 7.0
    freq_30d = float((seed % 120) + 30) / 30.0

    return {
        "kakao_place_id": kakao_place_id,
        "place_name": place_name,
        "post_freq_7d": round(freq_7d, 4),
        "post_freq_30d": round(freq_30d, 4),
        "count_7d": int(round(freq_7d * 7)),
        "count_30d": int(round(freq_30d * 30)),
        "sampled_at": datetime.utcnow().isoformat(),
        "raw_payload": {
            "source": "placeholder",
            "seed": seed,
            "notes": "Deterministic placeholder metric",
        },
    }
