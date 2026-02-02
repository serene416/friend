from fastapi import APIRouter

from app.api.deps import SessionDep
from app.schemas.users import StatusMessageRequest, StatusMessageResponse
from app.services.user_service import user_service

router = APIRouter()


@router.post("/status-message", response_model=StatusMessageResponse)
async def set_status_message(request: StatusMessageRequest, session: SessionDep):
    return await user_service.set_status_message(session, request.user_id, request.message)
