from __future__ import annotations

import hashlib
import logging
import os
import random
import re
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher
from math import asin, cos, radians, sin, sqrt
from typing import Any, Callable
from urllib.parse import parse_qs, quote_plus, unquote, urljoin, urlparse

try:
    from playwright.sync_api import (
        Browser,
        BrowserContext,
        Page,
        Playwright,
        TimeoutError as PlaywrightTimeoutError,
        sync_playwright,
    )
except Exception:  # pragma: no cover - runtime fallback for environments without Playwright.
    Browser = BrowserContext = Page = Playwright = Any  # type: ignore[assignment]
    PlaywrightTimeoutError = TimeoutError  # type: ignore[assignment]
    sync_playwright = None  # type: ignore[assignment]

logger = logging.getLogger("worker.naver_place")

MAP_MIN_CONFIDENCE = 0.50
MAX_RETRY_ATTEMPTS = 3

MAPPING_URLS = [
    "https://m.search.naver.com/search.naver?where=m&sm=mtp_hty.top&query={query}",
    "https://map.naver.com/p/search/{query}",
    "https://search.naver.com/search.naver?where=nexearch&sm=top_hty&query={query}",
]

REVIEW_URLS = [
    "https://pcmap.place.naver.com/restaurant/{place_id}/review/visitor",
    "https://m.place.naver.com/place/{place_id}/review/visitor",
]

PHOTO_URLS = [
    "https://pcmap.place.naver.com/restaurant/{place_id}/photo",
    "https://m.place.naver.com/place/{place_id}/photo",
]

REVIEW_MORE_BUTTON_SELECTORS = [
    "button:has-text('더보기')",
    "a:has-text('더보기')",
    "[role='button']:has-text('더보기')",
    "button:has-text('리뷰 더보기')",
]

REVIEW_TAB_SELECTORS = [
    "a:has-text('리뷰')",
    "button:has-text('리뷰')",
    "[role='tab']:has-text('리뷰')",
]

PHOTO_TAB_SELECTORS = [
    "a:has-text('사진')",
    "button:has-text('사진')",
    "[role='tab']:has-text('사진')",
]

REVIEW_ITEM_SELECTORS = [
    "li[data-review-id]",
    "li[class*='review']",
    "article[class*='review']",
    "div[class*='review']",
    "li:has(time)",
]

REVIEW_CONTENT_SELECTORS = [
    "span[class*='review']",
    "div[class*='review']",
    "p[class*='review']",
    "span[class*='text']",
    "p",
]

REVIEW_AUTHOR_SELECTORS = [
    "span[class*='nick']",
    "span[class*='author']",
    "a[class*='nick']",
    "span[class*='name']",
]

REVIEW_DATE_SELECTORS = [
    "time",
    "span[class*='date']",
    "span[class*='time']",
    "span[class*='day']",
]

PHOTO_ITEM_SELECTORS = [
    "img[src*='pstatic.net']",
    "img[src*='naver.net']",
    "div[class*='photo'] img[src]",
    "figure img[src]",
]

PHOTO_DATE_SELECTORS = [
    "time",
    "span[class*='date']",
    "span[class*='time']",
    "span[class*='day']",
]

PLACE_ID_PATTERNS = [
    re.compile(r"/place/(\d+)"),
    re.compile(r"/restaurant/(\d+)"),
    re.compile(r"entry/place/(\d+)"),
    re.compile(r"[?&]placeId=(\d+)"),
]

NON_WORD_PATTERN = re.compile(r"[^0-9a-z가-힣\\s]+", re.IGNORECASE)
DATE_PATTERN = re.compile(r"(?P<year>\d{2,4})[./-](?P<month>\d{1,2})[./-](?P<day>\d{1,2})")
RELATIVE_DATE_PATTERN = re.compile(r"(?P<count>\d+)\s*(?P<unit>분|시간|일|주|개월|달|년)\s*전")
NOISY_MAPPING_NAME_PATTERNS = [
    re.compile(r"^이미지수\s*\d+", re.IGNORECASE),
    re.compile(r"지도보기", re.IGNORECASE),
    re.compile(r"영업\s*중", re.IGNORECASE),
    re.compile(r"운영\s*중", re.IGNORECASE),
    re.compile(r"운영\s*종료", re.IGNORECASE),
]

RATING_SCORE_TEXT_PATTERNS = [
    re.compile(r"(?:별점|평점)\s*([0-5](?:[.,]\d{1,2})?)"),
    re.compile(r"([0-5](?:[.,]\d{1,2})?)\s*(?:점|/5)"),
]

RATING_COUNT_TEXT_PATTERNS = [
    re.compile(r"(?:평점|별점)\s*(?:참여|인원|인증)?\s*([0-9][0-9,]*)\s*명"),
    re.compile(r"([0-9][0-9,]*)\s*명(?:이|의)?\s*(?:평점|별점)"),
    re.compile(r"([0-9][0-9,]*)\s*명\s*참여"),
    re.compile(r"([0-9][0-9,]*)\s*개\s*평점"),
]

RATING_SCORE_COUNT_HTML_PATTERNS = [
    re.compile(
        r'"visitorReviewsScore"\s*:\s*"?([0-5](?:\.\d{1,3})?)"?[\s\S]{0,240}?"visitorReviewsTotal"\s*:\s*"?([0-9][0-9,]*)"?',
        re.IGNORECASE,
    ),
    re.compile(
        r'"avgRating"\s*:\s*"?([0-5](?:\.\d{1,3})?)"?[\s\S]{0,240}?"totalCount"\s*:\s*"?([0-9][0-9,]*)"?',
        re.IGNORECASE,
    ),
]

RATING_SCORE_HTML_PATTERNS = [
    re.compile(r'"(?:visitorReviewScore|starScore|averageRating|ratingScore)"\s*:\s*"?([0-5](?:\.\d{1,3})?)"?', re.IGNORECASE),
    re.compile(r'"visitorReviewsScore"\s*:\s*"?([0-5](?:\.\d{1,3})?)"?', re.IGNORECASE),
    re.compile(r'"avgRating"\s*:\s*"?([0-5](?:\.\d{1,3})?)"?', re.IGNORECASE),
]

RATING_COUNT_HTML_PATTERNS = [
    re.compile(r'"(?:visitorReviewScoreCount|visitorReviewCount|ratingCount|starCount)"\s*:\s*"?([0-9][0-9,]*)"?', re.IGNORECASE),
    re.compile(r'"visitorReviewsTotal"\s*:\s*"?([0-9][0-9,]*)"?', re.IGNORECASE),
]


@dataclass(frozen=True)
class NaverCrawlerConfig:
    headless: bool
    timeout_ms: int
    review_max_clicks: int
    photo_max_scrolls: int
    no_growth_limit: int
    request_delay_ms: int
    user_agent: str | None


@dataclass
class BrowserSession:
    playwright: Playwright
    browser: Browser
    context: BrowserContext
    page: Page


class _NoGrowthGuard:
    def __init__(self, limit: int, baseline: int = 0) -> None:
        self.limit = max(1, limit)
        self.last_count = max(0, baseline)
        self.streak = 0

    def observe(self, current_count: int) -> bool:
        if current_count > self.last_count:
            self.last_count = current_count
            self.streak = 0
            return False
        self.streak += 1
        return self.streak >= self.limit


def _get_bool_env(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    logger.warning("Invalid bool env %s=%s; using default=%s", name, raw, default)
    return default


def _get_int_env(name: str, default: int, minimum: int = 1) -> int:
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except ValueError:
        logger.warning("Invalid int env %s=%s; using default=%s", name, raw, default)
        return default
    return max(minimum, parsed)


def _load_config() -> NaverCrawlerConfig:
    return NaverCrawlerConfig(
        headless=_get_bool_env("NAVER_CRAWLER_HEADLESS", True),
        timeout_ms=_get_int_env("NAVER_CRAWLER_TIMEOUT_MS", 12000),
        review_max_clicks=_get_int_env("NAVER_REVIEW_MAX_CLICKS", 20),
        photo_max_scrolls=_get_int_env("NAVER_PHOTO_MAX_SCROLLS", 30),
        no_growth_limit=_get_int_env("NAVER_NO_GROWTH_LIMIT", 3),
        request_delay_ms=_get_int_env("NAVER_REQUEST_DELAY_MS", 350, minimum=0),
        user_agent=(os.getenv("NAVER_CRAWLER_USER_AGENT") or "").strip() or None,
    )


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = NON_WORD_PATTERN.sub(" ", value.lower())
    return " ".join(cleaned.split())


def _clean_candidate_name(value: str | None) -> str:
    normalized = " ".join((value or "").split()).strip()
    if not normalized:
        return ""

    # Naver often appends category text ("상호명,카테고리") in the same anchor.
    if "," in normalized:
        normalized = normalized.split(",", 1)[0].strip()

    return normalized


def _is_noisy_candidate_name(value: str | None) -> bool:
    text = _clean_candidate_name(value)
    if not text:
        return True

    compact = text.replace(" ", "")
    if len(compact) < 2:
        return True

    if compact.isdigit():
        return True

    for pattern in NOISY_MAPPING_NAME_PATTERNS:
        if pattern.search(text):
            return True
    return False


def _name_similarity(left: str | None, right: str | None) -> float:
    left_norm = _normalize_text(left)
    right_norm = _normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0

    left_compact = left_norm.replace(" ", "")
    right_compact = right_norm.replace(" ", "")

    ratio_score = SequenceMatcher(None, left_compact, right_compact).ratio()
    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    token_overlap = 0.0
    if left_tokens and right_tokens:
        token_overlap = len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))

    score = (ratio_score * 0.8) + (token_overlap * 0.2)
    if left_compact in right_compact or right_compact in left_compact:
        score = max(score, min(0.99, ratio_score + 0.12))
    return max(0.0, min(1.0, score))


def _to_optional_float(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_optional_int(value: Any) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _parse_rating_score(value: str | None) -> float | None:
    if not value:
        return None
    normalized = value.strip().replace(",", ".")
    normalized = re.sub(r"[^0-9.]+", "", normalized)
    if not normalized:
        return None
    try:
        score = float(normalized)
    except ValueError:
        return None
    if score < 0 or score > 5:
        return None
    return round(score, 2)


def _parse_rating_count(value: str | None) -> int | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9]+", "", value)
    if not digits:
        return None
    count = _to_optional_int(digits)
    if count is None or count <= 0:
        return None
    return count


def _parse_naver_rating_summary(
    content_text: str | None,
    html: str | None = None,
) -> dict[str, Any]:
    text = " ".join((content_text or "").split())
    html_text = html or ""

    score: float | None = None
    rating_count: int | None = None

    for pattern in RATING_SCORE_COUNT_HTML_PATTERNS:
        match = pattern.search(html_text)
        if not match:
            continue
        parsed_score = _parse_rating_score(match.group(1))
        parsed_count = _parse_rating_count(match.group(2))
        if parsed_score is not None:
            score = parsed_score
        if parsed_count is not None:
            rating_count = parsed_count
        if score is not None and rating_count is not None:
            break

    for pattern in RATING_SCORE_TEXT_PATTERNS:
        match = pattern.search(text)
        if not match:
            continue
        parsed_score = _parse_rating_score(match.group(1))
        if parsed_score is not None:
            score = parsed_score
            break

    if score is None:
        for pattern in RATING_SCORE_HTML_PATTERNS:
            match = pattern.search(html_text)
            if not match:
                continue
            parsed_score = _parse_rating_score(match.group(1))
            if parsed_score is not None:
                score = parsed_score
                break

    if rating_count is None:
        for pattern in RATING_COUNT_TEXT_PATTERNS:
            match = pattern.search(text)
            if not match:
                continue
            parsed_count = _parse_rating_count(match.group(1))
            if parsed_count is not None:
                rating_count = parsed_count
                break

    if rating_count is None:
        for pattern in RATING_COUNT_HTML_PATTERNS:
            match = pattern.search(html_text)
            if not match:
                continue
            parsed_count = _parse_rating_count(match.group(1))
            if parsed_count is not None:
                rating_count = parsed_count
                break

    if score is None and rating_count is None:
        return {}

    return {
        "average_rating": score,
        "rating_count": rating_count,
    }


def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    earth_radius_m = 6371000.0
    d_lat = radians(lat2 - lat1)
    d_lon = radians(lon2 - lon1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lon / 2) ** 2
    c = 2 * asin(min(1.0, sqrt(a)))
    return earth_radius_m * c


def _distance_m(
    kakao_x: float | None,
    kakao_y: float | None,
    candidate_x: float | None,
    candidate_y: float | None,
) -> float | None:
    if None in (kakao_x, kakao_y, candidate_x, candidate_y):
        return None
    return _haversine_distance_m(kakao_y, kakao_x, candidate_y, candidate_x)


def _parse_place_id(href: str | None) -> str | None:
    if not href:
        return None
    for pattern in PLACE_ID_PATTERNS:
        match = pattern.search(href)
        if match:
            return match.group(1)
    return None


def _extract_coord_from_href(href: str | None, key: str) -> float | None:
    if not href:
        return None
    parsed = urlparse(href)
    query = parse_qs(parsed.query)
    values = query.get(key)
    if not values:
        return None
    return _to_optional_float(values[0])


def _safe_build_mapping_payload(
    kakao_place_id: str,
    place_name: str | None,
    x: float | None,
    y: float | None,
) -> dict[str, Any]:
    return {
        "kakao_place_id": kakao_place_id,
        "place_name": place_name,
        "input_x": x,
        "input_y": y,
        "status": "SKIPPED",
        "reason": "unresolved",
        "naver_place_id": None,
        "matched_name": None,
        "confidence": 0.0,
        "distance_m": None,
        "candidate_count": 0,
        "crawlable": False,
    }


def _select_best_mapping_candidate(
    place_name: str,
    candidates: list[dict[str, Any]],
    kakao_x: float | None = None,
    kakao_y: float | None = None,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    scored_candidates: list[dict[str, Any]] = []

    for candidate in candidates:
        naver_place_id = str(candidate.get("naver_place_id") or "").strip()
        matched_name = str(candidate.get("matched_name") or "").strip()
        if not naver_place_id or not matched_name:
            continue

        candidate_x = _to_optional_float(candidate.get("x"))
        candidate_y = _to_optional_float(candidate.get("y"))
        distance_m = _distance_m(kakao_x, kakao_y, candidate_x, candidate_y)

        name_score = _name_similarity(place_name, matched_name)
        confidence = name_score
        if distance_m is not None:
            distance_penalty = min(distance_m / 3000.0, 0.55)
            confidence = max(0.0, name_score - distance_penalty)

        scored = {
            "naver_place_id": naver_place_id,
            "matched_name": matched_name,
            "confidence": round(confidence, 4),
            "distance_m": round(distance_m, 2) if distance_m is not None else None,
            "x": candidate_x,
            "y": candidate_y,
            "source_url": candidate.get("source_url"),
        }
        scored_candidates.append(scored)

    if not scored_candidates:
        return None, []

    scored_candidates.sort(
        key=lambda row: (
            row["confidence"],
            -1 if row["distance_m"] is None else -row["distance_m"],
        ),
        reverse=True,
    )
    return scored_candidates[0], scored_candidates


def _paced_wait(page: Page, config: NaverCrawlerConfig, multiplier: float = 1.0) -> None:
    if config.request_delay_ms <= 0:
        return
    base_ms = int(config.request_delay_ms * max(multiplier, 0.0))
    jitter_range = max(1, int(base_ms * 0.35))
    jittered = max(0, base_ms + random.randint(-jitter_range, jitter_range))
    page.wait_for_timeout(jittered)


def _retry_action(
    action: Callable[[], Any],
    *,
    action_name: str,
    retries: int = MAX_RETRY_ATTEMPTS,
    retry_interval_sec: float = 0.2,
) -> Any:
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return action()
        except PlaywrightTimeoutError as exc:
            last_exc = exc
            logger.warning(
                "naver.action.timeout action=%s attempt=%s/%s error=%s",
                action_name,
                attempt,
                retries,
                str(exc),
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "naver.action.error action=%s attempt=%s/%s error=%s",
                action_name,
                attempt,
                retries,
                str(exc),
            )

        if attempt < retries:
            time.sleep(retry_interval_sec + random.uniform(0.05, 0.2))

    if last_exc:
        raise last_exc
    return None


def _create_browser_session(config: NaverCrawlerConfig) -> BrowserSession:
    if sync_playwright is None:
        raise RuntimeError("Playwright is not available in this environment")

    playwright = sync_playwright().start()
    browser = playwright.chromium.launch(headless=config.headless)
    context_kwargs: dict[str, Any] = {}
    if config.user_agent:
        context_kwargs["user_agent"] = config.user_agent

    context = browser.new_context(**context_kwargs)
    page = context.new_page()
    page.set_default_timeout(config.timeout_ms)
    return BrowserSession(playwright=playwright, browser=browser, context=context, page=page)


def _close_browser_session(session: BrowserSession | None) -> None:
    if session is None:
        return

    close_errors: list[str] = []
    for close_name, close_fn in (
        ("page", session.page.close),
        ("context", session.context.close),
        ("browser", session.browser.close),
        ("playwright", session.playwright.stop),
    ):
        try:
            close_fn()
        except Exception as exc:
            close_errors.append(f"{close_name}:{exc}")

    if close_errors:
        logger.warning("naver.cleanup.partial_failure details=%s", close_errors)


def _safe_goto(page: Page, url: str, timeout_ms: int) -> bool:
    try:
        _retry_action(
            lambda: page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms),
            action_name="goto",
        )
        return True
    except Exception:
        logger.warning("naver.goto.failed url=%s", url, exc_info=True)
        return False


def _safe_click(page: Page, selectors: list[str], timeout_ms: int, action_name: str) -> bool:
    for selector in selectors:
        try:
            locator = page.locator(selector)
            if locator.count() <= 0:
                continue

            def _click() -> None:
                target = locator.first
                target.scroll_into_view_if_needed(timeout=min(2000, timeout_ms))
                target.click(timeout=timeout_ms)

            _retry_action(_click, action_name=f"{action_name}:{selector}")
            return True
        except Exception:
            continue
    return False


def _safe_scroll(page: Page, scroll_px: int, action_name: str) -> bool:
    try:
        _retry_action(
            lambda: page.mouse.wheel(0, scroll_px),
            action_name=f"{action_name}:mouse_wheel",
        )
        return True
    except Exception:
        try:
            _retry_action(
                lambda: page.evaluate("(distance) => window.scrollBy(0, distance)", scroll_px),
                action_name=f"{action_name}:window_scroll",
            )
            return True
        except Exception:
            logger.warning("naver.scroll.failed action=%s", action_name, exc_info=True)
            return False


def _safe_extract(
    action: Callable[[], list[dict[str, Any]]],
    *,
    action_name: str,
) -> list[dict[str, Any]]:
    try:
        extracted = _retry_action(action, action_name=action_name)
        if isinstance(extracted, list):
            return extracted
    except Exception:
        logger.warning("naver.extract.failed action=%s", action_name, exc_info=True)
    return []


def _is_unusable_content_page(page: Page) -> bool:
    """
    Detect pages that technically load but have no crawlable content
    (common for some m.place routes in headless environments).
    """
    try:
        html_len = len(page.content())
    except Exception:
        return False

    if html_len >= 10000:
        return False

    try:
        interactive_count = page.locator("a, button, img").count()
    except Exception:
        interactive_count = 0

    return interactive_count < 5


def _extract_text(locator: Any, selectors: list[str]) -> str | None:
    for selector in selectors:
        try:
            nested = locator.locator(selector).first
            if nested.count() <= 0:
                continue
            text = (nested.inner_text(timeout=500) or "").strip()
            if text:
                return " ".join(text.split())
        except Exception:
            continue

    try:
        fallback = (locator.inner_text(timeout=500) or "").strip()
        if fallback:
            return " ".join(fallback.split())
    except Exception:
        pass
    return None


def _extract_attr(locator: Any, attributes: list[str]) -> str | None:
    for attr in attributes:
        try:
            value = locator.get_attribute(attr)
        except Exception:
            value = None
        if value:
            return value.strip()
    return None


def _extract_rating_summary(page: Page) -> dict[str, Any]:
    page_text = ""
    page_html = ""

    try:
        page_text = (page.inner_text("body", timeout=1500) or "").strip()
    except Exception:
        page_text = ""

    try:
        page_html = page.content() or ""
    except Exception:
        page_html = ""

    summary = _parse_naver_rating_summary(page_text, page_html)
    if summary:
        logger.info(
            "naver.review.rating_summary average=%s count=%s",
            summary.get("average_rating"),
            summary.get("rating_count"),
        )
    return summary


def _parse_posted_at_iso(raw_value: str | None) -> str | None:
    if not raw_value:
        return None

    text = " ".join(raw_value.split())
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if "오늘" in text:
        return now.replace(microsecond=0).isoformat()
    if "어제" in text:
        return (now - timedelta(days=1)).replace(microsecond=0).isoformat()
    if "방금" in text:
        return now.replace(microsecond=0).isoformat()

    relative_match = RELATIVE_DATE_PATTERN.search(text)
    if relative_match:
        count = int(relative_match.group("count"))
        unit = relative_match.group("unit")
        if unit == "분":
            parsed = now - timedelta(minutes=count)
        elif unit == "시간":
            parsed = now - timedelta(hours=count)
        elif unit == "일":
            parsed = now - timedelta(days=count)
        elif unit == "주":
            parsed = now - timedelta(weeks=count)
        elif unit in {"개월", "달"}:
            parsed = now - timedelta(days=count * 30)
        else:
            parsed = now - timedelta(days=count * 365)
        return parsed.replace(microsecond=0).isoformat()

    date_match = DATE_PATTERN.search(text)
    if not date_match:
        return None

    year = int(date_match.group("year"))
    month = int(date_match.group("month"))
    day = int(date_match.group("day"))
    if year < 100:
        year += 2000

    try:
        parsed = datetime(year=year, month=month, day=day)
        return parsed.isoformat()
    except ValueError:
        return None


def _review_hash(content: str, author: str | None, posted_at: str | None) -> str:
    payload = "|".join([content.strip(), (author or "").strip(), (posted_at or "").strip()])
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()


def _dedupe_reviews(reviews: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}

    for review in reviews:
        content = str(review.get("content") or "").strip()
        if not content:
            continue

        author = str(review.get("author") or "").strip() or None
        posted_at_raw = str(review.get("posted_at") or "").strip() or None
        posted_at_iso = review.get("posted_at_iso") or _parse_posted_at_iso(posted_at_raw)
        review_id = str(review.get("review_id") or "").strip() or None

        if not review_id:
            review_id = f"review-{_review_hash(content, author, posted_at_raw)}"

        if review_id in deduped:
            continue

        deduped[review_id] = {
            "review_id": review_id,
            "content": content,
            "author": author,
            "posted_at": posted_at_raw,
            "posted_at_iso": posted_at_iso,
        }

    return list(deduped.values())


def _normalize_image_url(url: str) -> str:
    raw_url = url.strip()
    parsed = urlparse(raw_url)
    if "search.pstatic.net" in parsed.netloc and parsed.path.startswith("/common"):
        src_param = parse_qs(parsed.query).get("src", [None])[0]
        if src_param:
            return unquote(src_param).strip()
    return parsed._replace(query="", fragment="").geturl()


def _photo_dedupe_key(url: str) -> str:
    parsed = urlparse(url.strip())
    if "search.pstatic.net" in parsed.netloc and parsed.path.startswith("/common"):
        src_param = parse_qs(parsed.query).get("src", [None])[0]
        if src_param:
            return unquote(src_param).strip()
    return parsed._replace(query="", fragment="").geturl()


def _dedupe_photos(photos: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}

    for photo in photos:
        image_url_raw = str(photo.get("image_url") or "").strip()
        if not image_url_raw:
            continue

        image_url = _normalize_image_url(image_url_raw)
        dedupe_key = _photo_dedupe_key(image_url_raw)
        if not image_url or not dedupe_key or dedupe_key in deduped:
            continue

        captured_at = str(photo.get("captured_at") or "").strip() or None
        captured_at_iso = photo.get("captured_at_iso") or _parse_posted_at_iso(captured_at)
        metadata = photo.get("metadata")
        if not isinstance(metadata, dict):
            metadata = {}

        deduped[dedupe_key] = {
            "photo_id": f"photo-{hashlib.sha1(image_url.encode('utf-8')).hexdigest()[:16]}",
            "image_url": image_url,
            "captured_at": captured_at,
            "captured_at_iso": captured_at_iso,
            "metadata": metadata,
        }

    return list(deduped.values())


def _extract_mapping_candidates(
    page: Page,
    place_name: str,
    config: NaverCrawlerConfig,
) -> list[dict[str, Any]]:
    candidates: dict[str, dict[str, Any]] = {}
    query = place_name.strip()

    for template in MAPPING_URLS:
        target_url = template.format(query=quote_plus(query))
        if not _safe_goto(page, target_url, timeout_ms=config.timeout_ms):
            continue

        _paced_wait(page, config, multiplier=0.8)

        for selector in (
            "a[href*='m.place.naver.com/place/']",
            "a[href*='pcmap.place.naver.com/restaurant/']",
            "a[href*='entry/place/']",
            "a[href*='/place/']",
        ):
            try:
                locator = page.locator(selector)
                count = min(locator.count(), 30)
            except Exception:
                count = 0

            for index in range(count):
                anchor = locator.nth(index)
                href = _extract_attr(anchor, ["href"])
                if not href:
                    continue

                resolved_href = urljoin(page.url, href)
                if "/place/list" in resolved_href:
                    continue
                if "/photo" in urlparse(resolved_href).path:
                    continue

                naver_place_id = _parse_place_id(resolved_href)
                if not naver_place_id:
                    continue

                anchor_text = _extract_text(anchor, ["span", "strong", "em"])
                if not anchor_text:
                    try:
                        anchor_text = (
                            anchor.evaluate("(el) => (el.getAttribute('title') || el.getAttribute('aria-label') || '').trim()")
                            or ""
                        ).strip()
                    except Exception:
                        anchor_text = ""

                matched_name = _clean_candidate_name(anchor_text)
                if _is_noisy_candidate_name(matched_name):
                    continue

                candidate_x = _extract_coord_from_href(resolved_href, "x")
                candidate_y = _extract_coord_from_href(resolved_href, "y")
                if candidate_x is None:
                    candidate_x = _extract_coord_from_href(resolved_href, "lng")
                if candidate_y is None:
                    candidate_y = _extract_coord_from_href(resolved_href, "lat")

                current_candidate = {
                    "naver_place_id": naver_place_id,
                    "matched_name": matched_name,
                    "x": candidate_x,
                    "y": candidate_y,
                    "source_url": target_url,
                }
                existing = candidates.get(naver_place_id)
                if existing is None:
                    candidates[naver_place_id] = current_candidate
                    continue

                existing_score = _name_similarity(place_name, existing.get("matched_name"))
                current_score = _name_similarity(place_name, current_candidate.get("matched_name"))
                if current_score > existing_score:
                    candidates[naver_place_id] = current_candidate

        logger.info(
            "naver.mapping.search_iter url=%s candidates=%s",
            target_url,
            len(candidates),
        )
        if candidates:
            break

    return list(candidates.values())


def resolve_naver_place_mapping(
    kakao_place_id: str,
    place_name: str | None,
    x: float | None = None,
    y: float | None = None,
    *,
    _config: NaverCrawlerConfig | None = None,
) -> dict[str, Any]:
    config = _config or _load_config()
    payload = _safe_build_mapping_payload(kakao_place_id, place_name, x, y)

    if not place_name or not place_name.strip():
        payload["reason"] = "missing_place_name"
        logger.info(
            "naver.mapping.skipped kakao_place_id=%s reason=%s",
            kakao_place_id,
            payload["reason"],
        )
        return payload

    session: BrowserSession | None = None
    try:
        session = _create_browser_session(config)
        candidates = _extract_mapping_candidates(session.page, place_name, config)
        payload["candidate_count"] = len(candidates)

        best_candidate, scored_candidates = _select_best_mapping_candidate(
            place_name=place_name,
            candidates=candidates,
            kakao_x=x,
            kakao_y=y,
        )

        if not best_candidate:
            payload["reason"] = "no_candidates"
            logger.info(
                "naver.mapping.failed kakao_place_id=%s reason=%s candidate_count=%s",
                kakao_place_id,
                payload["reason"],
                payload["candidate_count"],
            )
            return payload

        payload["confidence"] = best_candidate["confidence"]
        payload["distance_m"] = best_candidate.get("distance_m")
        payload["matched_name"] = best_candidate["matched_name"]
        payload["top_candidates"] = scored_candidates[:3]

        if best_candidate["confidence"] < MAP_MIN_CONFIDENCE:
            payload["reason"] = "low_confidence"
            logger.info(
                "naver.mapping.failed kakao_place_id=%s reason=%s confidence=%.4f threshold=%.2f",
                kakao_place_id,
                payload["reason"],
                best_candidate["confidence"],
                MAP_MIN_CONFIDENCE,
            )
            return payload

        payload.update(
            {
                "status": "MAPPED",
                "reason": None,
                "naver_place_id": best_candidate["naver_place_id"],
                "matched_name": best_candidate["matched_name"],
                "confidence": best_candidate["confidence"],
                "distance_m": best_candidate.get("distance_m"),
                "crawlable": True,
            }
        )
        logger.info(
            "naver.mapping.success kakao_place_id=%s naver_place_id=%s confidence=%.4f distance_m=%s candidates=%s",
            kakao_place_id,
            payload["naver_place_id"],
            payload["confidence"],
            payload.get("distance_m"),
            payload["candidate_count"],
        )
        return payload
    except Exception as exc:
        payload["reason"] = "search_error"
        payload["error"] = str(exc)
        logger.warning(
            "naver.mapping.error kakao_place_id=%s reason=%s",
            kakao_place_id,
            payload["reason"],
            exc_info=True,
        )
        return payload
    finally:
        _close_browser_session(session)


def _extract_reviews(page: Page, naver_place_id: str) -> list[dict[str, Any]]:
    extracted: list[dict[str, Any]] = []

    for selector in REVIEW_ITEM_SELECTORS:
        try:
            locator = page.locator(selector)
            count = min(locator.count(), 500)
        except Exception:
            count = 0

        if count <= 0:
            continue

        for index in range(count):
            item = locator.nth(index)
            review_id = _extract_attr(item, ["data-review-id", "data-id", "id"])

            content = _extract_text(item, REVIEW_CONTENT_SELECTORS)
            if not content:
                continue

            content = content.replace("더보기", "").strip()
            if not content or len(content) < 2:
                continue

            author = _extract_text(item, REVIEW_AUTHOR_SELECTORS)
            posted_at = _extract_text(item, REVIEW_DATE_SELECTORS)

            extracted.append(
                {
                    "review_id": review_id,
                    "content": content,
                    "author": author,
                    "posted_at": posted_at,
                    "posted_at_iso": _parse_posted_at_iso(posted_at),
                    "naver_place_id": naver_place_id,
                }
            )

    return extracted


def _crawl_reviews_with_page(
    page: Page,
    naver_place_id: str,
    config: NaverCrawlerConfig,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    selected_url = None
    for template in REVIEW_URLS:
        candidate_url = template.format(place_id=naver_place_id)
        if _safe_goto(page, candidate_url, timeout_ms=config.timeout_ms):
            _paced_wait(page, config, multiplier=0.8)
            if _is_unusable_content_page(page):
                logger.info(
                    "naver.review.url_rejected naver_place_id=%s url=%s reason=thin_content",
                    naver_place_id,
                    candidate_url,
                )
                continue
            selected_url = candidate_url
            break

    if not selected_url:
        logger.warning("naver.review.open_failed naver_place_id=%s", naver_place_id)
        return [], {}

    _safe_click(page, REVIEW_TAB_SELECTORS, timeout_ms=config.timeout_ms, action_name="review_open_tab")
    _paced_wait(page, config)
    rating_summary = _extract_rating_summary(page)

    collected = _dedupe_reviews(_safe_extract(lambda: _extract_reviews(page, naver_place_id), action_name="review_extract"))
    guard = _NoGrowthGuard(config.no_growth_limit, baseline=len(collected))

    logger.info(
        "naver.review.start naver_place_id=%s initial_count=%s max_clicks=%s no_growth_limit=%s",
        naver_place_id,
        len(collected),
        config.review_max_clicks,
        config.no_growth_limit,
    )

    for click_index in range(1, config.review_max_clicks + 1):
        clicked = _safe_click(
            page,
            REVIEW_MORE_BUTTON_SELECTORS,
            timeout_ms=config.timeout_ms,
            action_name=f"review_more_click_{click_index}",
        )
        if not clicked:
            logger.info(
                "naver.review.stop naver_place_id=%s reason=button_unavailable click_iteration=%s count=%s",
                naver_place_id,
                click_index,
                len(collected),
            )
            break

        _paced_wait(page, config)
        latest = _dedupe_reviews(_safe_extract(lambda: _extract_reviews(page, naver_place_id), action_name="review_extract"))
        collected = _dedupe_reviews([*collected, *latest])
        current_count = len(collected)

        logger.info(
            "naver.review.iteration naver_place_id=%s click_iteration=%s count=%s",
            naver_place_id,
            click_index,
            current_count,
        )

        if guard.observe(current_count):
            logger.info(
                "naver.review.stop naver_place_id=%s reason=no_growth click_iteration=%s count=%s",
                naver_place_id,
                click_index,
                current_count,
            )
            break

    logger.info(
        "naver.review.done naver_place_id=%s count=%s rating=%s rating_count=%s",
        naver_place_id,
        len(collected),
        rating_summary.get("average_rating"),
        rating_summary.get("rating_count"),
    )
    return collected, rating_summary


def _extract_photos(page: Page, naver_place_id: str) -> list[dict[str, Any]]:
    extracted: list[dict[str, Any]] = []
    page_url = page.url
    seen_urls: set[str] = set()
    max_total = 120

    for selector in PHOTO_ITEM_SELECTORS:
        if len(extracted) >= max_total:
            break
        try:
            locator = page.locator(selector)
            count = min(locator.count(), 40)
        except Exception:
            count = 0

        for index in range(count):
            image = locator.nth(index)
            image_url = _extract_attr(
                image,
                ["src", "data-src", "data-original", "data-lazy-src", "data-image-src"],
            )
            if not image_url or image_url.startswith("data:"):
                continue

            normalized_key = _photo_dedupe_key(image_url)
            if not normalized_key or normalized_key in seen_urls:
                continue
            seen_urls.add(normalized_key)

            alt = _extract_attr(image, ["alt"])
            title = _extract_attr(image, ["title"])
            captured_at = None

            extracted.append(
                {
                    "image_url": image_url,
                    "captured_at": captured_at,
                    "captured_at_iso": _parse_posted_at_iso(captured_at),
                    "metadata": {
                        "alt": alt,
                        "title": title,
                        "source_url": page_url,
                        "naver_place_id": naver_place_id,
                    },
                }
            )
            if len(extracted) >= max_total:
                break

    return extracted


def _crawl_photos_with_page(
    page: Page,
    naver_place_id: str,
    config: NaverCrawlerConfig,
) -> list[dict[str, Any]]:
    selected_url = None
    for template in PHOTO_URLS:
        candidate_url = template.format(place_id=naver_place_id)
        if _safe_goto(page, candidate_url, timeout_ms=config.timeout_ms):
            _paced_wait(page, config, multiplier=0.8)
            if _is_unusable_content_page(page):
                logger.info(
                    "naver.photo.url_rejected naver_place_id=%s url=%s reason=thin_content",
                    naver_place_id,
                    candidate_url,
                )
                continue
            selected_url = candidate_url
            break

    if not selected_url:
        logger.warning("naver.photo.open_failed naver_place_id=%s", naver_place_id)
        return []

    _safe_click(page, PHOTO_TAB_SELECTORS, timeout_ms=config.timeout_ms, action_name="photo_open_tab")
    _paced_wait(page, config)

    collected = _dedupe_photos(_safe_extract(lambda: _extract_photos(page, naver_place_id), action_name="photo_extract"))
    guard = _NoGrowthGuard(config.no_growth_limit, baseline=len(collected))

    logger.info(
        "naver.photo.start naver_place_id=%s initial_count=%s max_scrolls=%s no_growth_limit=%s",
        naver_place_id,
        len(collected),
        config.photo_max_scrolls,
        config.no_growth_limit,
    )

    for scroll_index in range(1, config.photo_max_scrolls + 1):
        if not _safe_scroll(page, 1800, action_name=f"photo_scroll_{scroll_index}"):
            logger.info(
                "naver.photo.stop naver_place_id=%s reason=scroll_failed iteration=%s count=%s",
                naver_place_id,
                scroll_index,
                len(collected),
            )
            break

        _paced_wait(page, config)
        latest = _dedupe_photos(_safe_extract(lambda: _extract_photos(page, naver_place_id), action_name="photo_extract"))
        collected = _dedupe_photos([*collected, *latest])
        current_count = len(collected)

        logger.info(
            "naver.photo.iteration naver_place_id=%s scroll_iteration=%s count=%s",
            naver_place_id,
            scroll_index,
            current_count,
        )

        if guard.observe(current_count):
            logger.info(
                "naver.photo.stop naver_place_id=%s reason=no_growth iteration=%s count=%s",
                naver_place_id,
                scroll_index,
                current_count,
            )
            break

    logger.info(
        "naver.photo.done naver_place_id=%s count=%s",
        naver_place_id,
        len(collected),
    )
    return collected


def crawl_naver_place_bundle(
    kakao_place_id: str,
    place_name: str | None,
    x: float | None = None,
    y: float | None = None,
) -> dict[str, Any]:
    config = _load_config()
    mapping = resolve_naver_place_mapping(kakao_place_id, place_name, x=x, y=y, _config=config)

    result: dict[str, Any] = {
        "mapping": mapping,
        "status": "SKIPPED" if not mapping.get("crawlable") else "COMPLETED",
        "skip_reason": mapping.get("reason"),
        "reviews": [],
        "photos": [],
        "rating_summary": {},
    }

    if not mapping.get("crawlable"):
        logger.info(
            "naver.crawl.skip kakao_place_id=%s place_name=%s reason=%s",
            kakao_place_id,
            place_name,
            mapping.get("reason"),
        )
        return result

    naver_place_id = mapping.get("naver_place_id")
    if not naver_place_id:
        result["status"] = "SKIPPED"
        result["skip_reason"] = "missing_naver_place_id"
        return result

    session: BrowserSession | None = None
    warnings: list[str] = []
    try:
        session = _create_browser_session(config)

        try:
            reviews, rating_summary = _crawl_reviews_with_page(session.page, naver_place_id, config)
            result["reviews"] = reviews
            result["rating_summary"] = rating_summary
        except Exception as exc:
            warnings.append(f"review_error:{exc}")
            logger.warning(
                "naver.review.error kakao_place_id=%s naver_place_id=%s",
                kakao_place_id,
                naver_place_id,
                exc_info=True,
            )
            result["reviews"] = []
            result["rating_summary"] = {}

        try:
            result["photos"] = _crawl_photos_with_page(session.page, naver_place_id, config)
        except Exception as exc:
            warnings.append(f"photo_error:{exc}")
            logger.warning(
                "naver.photo.error kakao_place_id=%s naver_place_id=%s",
                kakao_place_id,
                naver_place_id,
                exc_info=True,
            )
            result["photos"] = []

        if warnings:
            result["status"] = "PARTIAL"
            result["warnings"] = warnings

        logger.info(
            "naver.crawl.done kakao_place_id=%s naver_place_id=%s review_count=%s photo_count=%s rating=%s rating_count=%s status=%s",
            kakao_place_id,
            naver_place_id,
            len(result["reviews"]),
            len(result["photos"]),
            result.get("rating_summary", {}).get("average_rating"),
            result.get("rating_summary", {}).get("rating_count"),
            result["status"],
        )
        return result
    except Exception as exc:
        logger.warning(
            "naver.crawl.failed kakao_place_id=%s place_name=%s error=%s",
            kakao_place_id,
            place_name,
            str(exc),
            exc_info=True,
        )
        result["status"] = "SKIPPED"
        result["skip_reason"] = "crawler_error"
        result["warnings"] = [f"crawler_error:{exc}"]
        return result
    finally:
        _close_browser_session(session)


def crawl_naver_reviews(
    kakao_place_id: str,
    place_name: str | None,
    x: float | None = None,
    y: float | None = None,
) -> list[dict[str, Any]]:
    bundle = crawl_naver_place_bundle(kakao_place_id=kakao_place_id, place_name=place_name, x=x, y=y)
    return bundle.get("reviews", [])


def crawl_naver_photos(
    kakao_place_id: str,
    place_name: str | None,
    x: float | None = None,
    y: float | None = None,
) -> list[dict[str, Any]]:
    bundle = crawl_naver_place_bundle(kakao_place_id=kakao_place_id, place_name=place_name, x=x, y=y)
    return bundle.get("photos", [])


__all__ = [
    "crawl_naver_place_bundle",
    "crawl_naver_reviews",
    "crawl_naver_photos",
    "resolve_naver_place_mapping",
]
