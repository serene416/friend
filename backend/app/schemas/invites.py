from datetime import datetime
from pydantic import BaseModel
from uuid import UUID


class InviteCreateRequest(BaseModel):
    inviter_user_id: UUID


class InviteCreateResponse(BaseModel):
    invite_link: str
    token: str
    expires_at: datetime


class InviteAcceptRequest(BaseModel):
    token: str
    acceptor_user_id: UUID


class InviteAcceptResponse(BaseModel):
    status: str
    inviter_user_id: UUID
    acceptor_user_id: UUID
    accepted_at: datetime
