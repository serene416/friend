from datetime import datetime
from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class StatusMessageRequest(BaseModel):
    user_id: UUID
    message: str


class StatusMessageResponse(BaseModel):
    message: Optional[str] = None
    expires_at: Optional[datetime] = None
