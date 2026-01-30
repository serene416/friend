from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional, List
from datetime import datetime
from app.schemas.auth import UserResponse

class FriendRequestCreate(BaseModel):
    # Can send request by email or user_id
    email: Optional[EmailStr] = None
    target_user_id: Optional[UUID] = None

class FriendshipResponse(BaseModel):
    id: UUID
    requester_id: UUID
    addressee_id: UUID
    status: str
    created_at: datetime
    # Optional expanded user info
    friend_info: Optional[UserResponse] = None

class FriendRequestAction(BaseModel):
    request_id: UUID
    accept: bool
