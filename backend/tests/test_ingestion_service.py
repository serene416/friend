import unittest
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock

from app.services.ingestion_service import IngestionService


class IngestionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def test_create_ingestion_job_deduplicates_by_kakao_place_id(self):
        service = IngestionService(session_factory=MagicMock(), celery_instance=MagicMock())
        service._persist_job = AsyncMock(return_value=uuid4())
        service._enqueue_job = MagicMock()

        hotplaces = [
            {"kakao_place_id": "kakao-1", "place_name": "A"},
            {"kakao_place_id": "kakao-1", "place_name": "A-dup"},
            {"kakao_place_id": "kakao-2", "place_name": "B"},
            {"kakao_place_id": "", "place_name": "invalid"},
            {"place_name": "missing-id"},
        ]

        await service.create_ingestion_job_from_hotplaces(
            hotplaces=hotplaces,
            source="test-source",
            request_context={"request_id": "r1"},
        )

        service._persist_job.assert_awaited_once()
        _, kwargs = service._persist_job.await_args
        self.assertEqual(kwargs["source"], "test-source")
        self.assertEqual(len(kwargs["deduped_hotplaces"]), 2)
        self.assertEqual(
            [item["kakao_place_id"] for item in kwargs["deduped_hotplaces"]],
            ["kakao-1", "kakao-2"],
        )

    async def test_create_ingestion_job_enqueues_after_persist(self):
        celery_mock = MagicMock()
        signature_mock = MagicMock()
        celery_mock.signature.return_value = signature_mock
        service = IngestionService(session_factory=MagicMock(), celery_instance=celery_mock)
        job_id = uuid4()
        service._persist_job = AsyncMock(return_value=job_id)

        created_job_id = await service.create_ingestion_job_from_hotplaces(
            hotplaces=[{"kakao_place_id": "kakao-1", "place_name": "A"}],
            source="test-source",
            request_context={},
        )

        self.assertEqual(created_job_id, job_id)
        service._persist_job.assert_awaited_once()
        celery_mock.signature.assert_called_once_with("tasks.ingest_job")
        signature_mock.delay.assert_called_once_with(str(job_id))


if __name__ == "__main__":
    unittest.main()
