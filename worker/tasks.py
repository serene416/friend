import logging
import os
from datetime import datetime
from typing import Any
from uuid import uuid4

import psycopg2
from celery import Celery
from psycopg2.extras import Json, RealDictCursor
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, PyMongoError

from crawlers.instagram import crawl_instagram_trend
from crawlers.naver_place import crawl_naver_place_bundle

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("worker.ingestion")

BROKER_URL = os.getenv("CELERY_BROKER_URL") or os.getenv("REDIS_URL", "redis://redis:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND") or os.getenv("REDIS_URL", "redis://redis:6379/0")
FEATURE_REVIEW_SAMPLE_LIMIT = int(os.getenv("INGESTION_REVIEW_SAMPLE_LIMIT", "50"))
FEATURE_PHOTO_SAMPLE_LIMIT = int(os.getenv("INGESTION_PHOTO_SAMPLE_LIMIT", "50"))

app = Celery("tasks", broker=BROKER_URL, backend=RESULT_BACKEND)


def _get_postgres_connection() -> psycopg2.extensions.connection:
    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/main_db",
    )
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(db_url)


def _get_mongo_client_and_db() -> tuple[MongoClient, Any]:
    mongo_url = os.getenv("MONGODB_URL")
    if not mongo_url:
        mongo_user = os.getenv("MONGO_USER", "admin")
        mongo_password = os.getenv("MONGO_PASSWORD", "password")
        mongo_host = os.getenv("MONGO_HOST", "mongo")
        mongo_url = f"mongodb://{mongo_user}:{mongo_password}@{mongo_host}:27017"

    mongo_db_name = os.getenv("MONGO_DB_NAME", "our_today")
    client = MongoClient(mongo_url, serverSelectionTimeoutMS=5000)
    return client, client[mongo_db_name]


def _job_exists(cursor, job_id: str) -> bool:
    cursor.execute("SELECT 1 FROM ingestion_job WHERE id = %s", (job_id,))
    return cursor.fetchone() is not None


def _set_job_status(
    cursor,
    job_id: str,
    status: str,
    completed_items: int | None = None,
    failed_items: int | None = None,
) -> None:
    if completed_items is None or failed_items is None:
        cursor.execute(
            """
            UPDATE ingestion_job
            SET status = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (status, job_id),
        )
        return

    cursor.execute(
        """
        UPDATE ingestion_job
        SET status = %s,
            completed_items = %s,
            failed_items = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (status, completed_items, failed_items, job_id),
    )


def _get_job_items(cursor, job_id: str) -> list[dict[str, Any]]:
    cursor.execute(
        """
        SELECT id, job_id, kakao_place_id, place_name, x, y, source_keyword, source_station, retry_count
        FROM ingestion_job_item
        WHERE job_id = %s
        ORDER BY created_at ASC
        """,
        (job_id,),
    )
    return list(cursor.fetchall())


def _set_item_status(cursor, item_id: str, status: str) -> None:
    cursor.execute(
        """
        UPDATE ingestion_job_item
        SET status = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (status, item_id),
    )


def _set_item_failed(cursor, item_id: str, error_message: str) -> None:
    cursor.execute(
        """
        UPDATE ingestion_job_item
        SET status = 'FAILED',
            error_message = %s,
            retry_count = COALESCE(retry_count, 0) + 1,
            updated_at = NOW()
        WHERE id = %s
        """,
        (error_message[:1000], item_id),
    )


def _set_item_skipped(cursor, item_id: str, reason: str) -> None:
    cursor.execute(
        """
        UPDATE ingestion_job_item
        SET status = 'SKIPPED',
            error_message = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (reason[:1000], item_id),
    )


def _write_raw_to_mongo(
    mongo_db,
    job_id: str,
    item: dict[str, Any],
    reviews: list[dict[str, Any]],
    photos: list[dict[str, Any]],
    trend_payload: dict[str, Any],
) -> None:
    ingested_at = datetime.utcnow()

    if reviews:
        mongo_db["place_reviews_raw"].insert_many(
            [
                {
                    "job_id": job_id,
                    "item_id": str(item["id"]),
                    "kakao_place_id": item["kakao_place_id"],
                    "place_name": item.get("place_name"),
                    "source": "NAVER_PLACE",
                    "raw_payload": review,
                    "ingested_at": ingested_at,
                }
                for review in reviews
            ]
        )

    if photos:
        mongo_db["place_photos_raw"].insert_many(
            [
                {
                    "job_id": job_id,
                    "item_id": str(item["id"]),
                    "kakao_place_id": item["kakao_place_id"],
                    "place_name": item.get("place_name"),
                    "source": "NAVER_PLACE",
                    "image_url": photo.get("image_url"),
                    "captured_at": photo.get("captured_at"),
                    "metadata": photo,
                    "ingested_at": ingested_at,
                }
                for photo in photos
            ]
        )

    mongo_db["place_trends_raw"].insert_one(
        {
            "job_id": job_id,
            "item_id": str(item["id"]),
            "kakao_place_id": item["kakao_place_id"],
            "source": "INSTAGRAM",
            "window_days": 30,
            "count": trend_payload.get("count_30d", 0),
            "sampled_at": trend_payload.get("sampled_at"),
            "raw_payload": trend_payload,
            "ingested_at": ingested_at,
        }
    )


def _upsert_place_ingestion_feature(
    cursor,
    item: dict[str, Any],
    reviews: list[dict[str, Any]],
    photos: list[dict[str, Any]],
    trend_payload: dict[str, Any],
    naver_mapping_payload: dict[str, Any] | None = None,
    naver_rating_summary: dict[str, Any] | None = None,
) -> None:
    review_sample = reviews[:FEATURE_REVIEW_SAMPLE_LIMIT]
    photo_sample = photos[:FEATURE_PHOTO_SAMPLE_LIMIT]
    feature_payload = {
        "latest_review_sample": review_sample,
        "latest_photo_sample": photo_sample,
        "instagram_raw": trend_payload,
        "naver_mapping": naver_mapping_payload or {},
        "naver_rating_summary": naver_rating_summary or {},
        "source_keyword": item.get("source_keyword"),
        "source_station": item.get("source_station"),
    }

    cursor.execute(
        """
        INSERT INTO place_ingestion_feature (
            id,
            place_id,
            kakao_place_id,
            latest_review_count,
            latest_photo_count,
            instagram_post_freq_7d,
            instagram_post_freq_30d,
            last_ingested_at,
            feature_payload
        )
        VALUES (
            %s,
            NULL,
            %s,
            %s,
            %s,
            %s,
            %s,
            NOW(),
            %s
        )
        ON CONFLICT (kakao_place_id)
        DO UPDATE SET
            latest_review_count = EXCLUDED.latest_review_count,
            latest_photo_count = EXCLUDED.latest_photo_count,
            instagram_post_freq_7d = EXCLUDED.instagram_post_freq_7d,
            instagram_post_freq_30d = EXCLUDED.instagram_post_freq_30d,
            last_ingested_at = EXCLUDED.last_ingested_at,
            feature_payload = EXCLUDED.feature_payload
        """,
        (
            str(uuid4()),
            item["kakao_place_id"],
            len(reviews),
            len(photos),
            float(trend_payload.get("post_freq_7d", 0.0)),
            float(trend_payload.get("post_freq_30d", 0.0)),
            Json(feature_payload),
        ),
    )


def _resolve_final_status(total_items: int, completed_items: int, failed_items: int) -> str:
    if total_items == 0:
        return "COMPLETED"
    if failed_items == 0:
        return "COMPLETED"
    if completed_items == 0:
        return "FAILED"
    return "PARTIAL"


@app.task(
    name="tasks.ingest_job",
    bind=True,
    autoretry_for=(psycopg2.OperationalError, AutoReconnect, PyMongoError),
    retry_backoff=True,
    retry_jitter=True,
    retry_kwargs={"max_retries": 3},
)
def ingest_job(self, job_id: str) -> dict[str, Any]:
    logger.info("Starting ingestion job job_id=%s", job_id)

    pg_conn = _get_postgres_connection()
    mongo_client, mongo_db = _get_mongo_client_and_db()
    completed_items = 0
    failed_items = 0
    skipped_items = 0
    total_items = 0

    try:
        with pg_conn:
            with pg_conn.cursor(cursor_factory=RealDictCursor) as cursor:
                if not _job_exists(cursor, job_id):
                    logger.warning("Ingestion job not found: job_id=%s", job_id)
                    return {"job_id": job_id, "status": "NOT_FOUND"}
                _set_job_status(cursor, job_id, "PROCESSING")
                items = _get_job_items(cursor, job_id)
                total_items = len(items)

        for item in items:
            item_id = str(item["id"])
            try:
                with pg_conn:
                    with pg_conn.cursor() as cursor:
                        _set_item_status(cursor, item_id, "PROCESSING")

                naver_bundle = crawl_naver_place_bundle(
                    kakao_place_id=item["kakao_place_id"],
                    place_name=item.get("place_name"),
                    x=item.get("x"),
                    y=item.get("y"),
                )
                reviews = naver_bundle.get("reviews", [])
                photos = naver_bundle.get("photos", [])
                naver_mapping = naver_bundle.get("mapping", {}) or {}
                naver_rating_summary = naver_bundle.get("rating_summary", {}) or {}
                trend_payload = crawl_instagram_trend(item["kakao_place_id"], item.get("place_name"))

                _write_raw_to_mongo(
                    mongo_db=mongo_db,
                    job_id=job_id,
                    item=item,
                    reviews=reviews,
                    photos=photos,
                    trend_payload=trend_payload,
                )

                with pg_conn:
                    with pg_conn.cursor() as cursor:
                        _upsert_place_ingestion_feature(
                            cursor=cursor,
                            item=item,
                            reviews=reviews,
                            photos=photos,
                            trend_payload=trend_payload,
                            naver_mapping_payload=naver_mapping,
                            naver_rating_summary=naver_rating_summary,
                        )
                        if naver_bundle.get("status") == "SKIPPED":
                            _set_item_skipped(
                                cursor,
                                item_id,
                                naver_bundle.get("skip_reason") or "naver_target_unavailable",
                            )
                            skipped_items += 1
                        else:
                            _set_item_status(cursor, item_id, "COMPLETED")

                completed_items += 1
            except PyMongoError:
                raise
            except Exception as exc:
                logger.exception(
                    "Item ingestion failed: job_id=%s item_id=%s kakao_place_id=%s",
                    job_id,
                    item_id,
                    item["kakao_place_id"],
                )
                failed_items += 1
                with pg_conn:
                    with pg_conn.cursor() as cursor:
                        _set_item_failed(cursor, item_id, str(exc))

        final_status = _resolve_final_status(total_items, completed_items, failed_items)
        with pg_conn:
            with pg_conn.cursor() as cursor:
                _set_job_status(
                    cursor,
                    job_id,
                    final_status,
                    completed_items=completed_items,
                    failed_items=failed_items,
                )

        logger.info(
            "Finished ingestion job job_id=%s status=%s total=%s completed=%s failed=%s skipped=%s",
            job_id,
            final_status,
            total_items,
            completed_items,
            failed_items,
            skipped_items,
        )
        return {
            "job_id": job_id,
            "status": final_status,
            "total_items": total_items,
            "completed_items": completed_items,
            "failed_items": failed_items,
        }
    except Exception:
        logger.exception("Ingestion job failed unexpectedly: job_id=%s", job_id)
        with pg_conn:
            with pg_conn.cursor() as cursor:
                _set_job_status(
                    cursor,
                    job_id,
                    "FAILED",
                    completed_items=completed_items,
                    failed_items=max(failed_items, 1),
                )
        raise
    finally:
        try:
            mongo_client.close()
        except Exception:
            logger.warning("Failed to close Mongo client cleanly", exc_info=True)
        pg_conn.close()
