from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from app.api.deps import SessionDep
from app.models.sql import IngestionJob
from app.schemas.ingestion import (
    CreateIngestionJobRequest,
    CreateIngestionJobResponse,
    IngestionJobStatusResponse,
)
from app.services.ingestion_service import create_ingestion_job_from_hotplaces

router = APIRouter()


@router.post("/jobs", response_model=CreateIngestionJobResponse, status_code=status.HTTP_201_CREATED)
async def create_ingestion_job(request: CreateIngestionJobRequest):
    job_id = await create_ingestion_job_from_hotplaces(
        hotplaces=[hotplace.model_dump() for hotplace in request.hotplaces],
        source=request.source,
        request_context=request.request_context,
    )
    return CreateIngestionJobResponse(job_id=job_id, status="PENDING")


@router.get("/jobs/{job_id}", response_model=IngestionJobStatusResponse)
async def get_ingestion_job_status(job_id: UUID, session: SessionDep):
    result = await session.execute(select(IngestionJob).where(IngestionJob.id == job_id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingestion job not found")

    return IngestionJobStatusResponse(
        job_id=job.id,
        source=job.source,
        status=job.status.value,
        total_items=job.total_items,
        completed_items=job.completed_items,
        failed_items=job.failed_items,
        created_at=job.created_at,
        updated_at=job.updated_at,
    )
