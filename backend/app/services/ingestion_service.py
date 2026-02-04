import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select

from app.core.celery_client import celery_app
from app.core.db import AsyncSessionLocal
from app.models.sql import IngestionJob, IngestionJobItem, IngestionJobStatus

logger = logging.getLogger("app.ingestion")


class IngestionService:
    def __init__(self, session_factory=AsyncSessionLocal, celery_instance=celery_app) -> None:
        self.session_factory = session_factory
        self.celery_instance = celery_instance

    @staticmethod
    def _extract_value(raw_hotplace: Any, field_name: str) -> Any:
        if isinstance(raw_hotplace, dict):
            return raw_hotplace.get(field_name)
        return getattr(raw_hotplace, field_name, None)

    def _deduplicate_hotplaces(self, hotplaces: list[Any]) -> list[dict[str, Any]]:
        deduped: dict[str, dict[str, Any]] = {}
        for raw_hotplace in hotplaces:
            kakao_place_id = self._extract_value(raw_hotplace, "kakao_place_id")
            if kakao_place_id is None:
                continue
            kakao_place_id = str(kakao_place_id).strip()
            if not kakao_place_id or kakao_place_id in deduped:
                continue

            deduped[kakao_place_id] = {
                "kakao_place_id": kakao_place_id,
                "place_name": self._extract_value(raw_hotplace, "place_name"),
                "x": self._extract_value(raw_hotplace, "x"),
                "y": self._extract_value(raw_hotplace, "y"),
                "source_keyword": self._extract_value(raw_hotplace, "source_keyword"),
                "source_station": self._extract_value(raw_hotplace, "source_station"),
            }

        return list(deduped.values())

    async def _persist_job(
        self,
        source: str,
        deduped_hotplaces: list[dict[str, Any]],
        request_context: dict[str, Any],
        original_count: int,
    ) -> UUID:
        async with self.session_factory() as session:
            now = datetime.utcnow()
            job = IngestionJob(
                source=source,
                status=IngestionJobStatus.PENDING,
                total_items=len(deduped_hotplaces),
                completed_items=0,
                failed_items=0,
                request_payload=request_context,
                meta={
                    "requested_item_count": original_count,
                    "deduplicated_item_count": len(deduped_hotplaces),
                },
                created_at=now,
                updated_at=now,
            )
            session.add(job)
            await session.flush()

            for hotplace in deduped_hotplaces:
                session.add(
                    IngestionJobItem(
                        job_id=job.id,
                        kakao_place_id=hotplace["kakao_place_id"],
                        place_name=hotplace.get("place_name"),
                        x=hotplace.get("x"),
                        y=hotplace.get("y"),
                        source_keyword=hotplace.get("source_keyword"),
                        source_station=hotplace.get("source_station"),
                    )
                )

            await session.commit()
            await session.refresh(job)
            return job.id

    def _enqueue_job(self, job_id: UUID) -> None:
        task_signature = self.celery_instance.signature("tasks.ingest_job")
        task_signature.delay(str(job_id))

    async def create_ingestion_job_from_hotplaces(
        self,
        hotplaces: list[Any],
        source: str,
        request_context: dict[str, Any],
    ) -> UUID:
        if not isinstance(hotplaces, list):
            raise ValueError("hotplaces must be a list")

        deduped_hotplaces = self._deduplicate_hotplaces(hotplaces)
        logger.info(
            "Creating ingestion job: source=%s requested_items=%s deduplicated_items=%s",
            source,
            len(hotplaces),
            len(deduped_hotplaces),
        )

        try:
            job_id = await self._persist_job(
                source=source,
                deduped_hotplaces=deduped_hotplaces,
                request_context=request_context or {},
                original_count=len(hotplaces),
            )
        except SQLAlchemyError:
            logger.exception("Failed to persist ingestion job for source=%s", source)
            raise
        except Exception:
            logger.exception("Unexpected failure while creating ingestion job for source=%s", source)
            raise

        try:
            self._enqueue_job(job_id)
        except Exception:
            logger.exception("Failed to enqueue ingestion job job_id=%s", job_id)
            raise

        logger.info("Ingestion job created and enqueued: job_id=%s source=%s", job_id, source)
        return job_id

    async def get_ingestion_job(self, job_id: UUID) -> IngestionJob | None:
        async with self.session_factory() as session:
            result = await session.execute(select(IngestionJob).where(IngestionJob.id == job_id))
            return result.scalar_one_or_none()


ingestion_service = IngestionService()


async def create_ingestion_job_from_hotplaces(
    hotplaces: list[Any], source: str, request_context: dict[str, Any]
) -> UUID:
    return await ingestion_service.create_ingestion_job_from_hotplaces(
        hotplaces=hotplaces,
        source=source,
        request_context=request_context,
    )
