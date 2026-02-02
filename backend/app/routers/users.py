from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.users import (
    LocationUpdateRequest,
    LocationUpdateResponse,
    StatusMessageRequest,
    StatusMessageResponse,
)
from app.services.user_service import user_service

router = APIRouter()


@router.post("/status-message", response_model=StatusMessageResponse)
async def set_status_message(request: StatusMessageRequest, session: SessionDep):
    return await user_service.set_status_message(session, request.user_id, request.message)


@router.post("/location", response_model=LocationUpdateResponse)
async def set_current_location(request: LocationUpdateRequest, session: SessionDep):
    return await user_service.set_current_location(
        session,
        request.user_id,
        request.latitude,
        request.longitude,
        request.location_name,
    )
