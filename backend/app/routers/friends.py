from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List
from uuid import UUID
from app.schemas.friends import (
    FriendDeleteResponse,
    FriendRequestAction,
    FriendRequestCreate,
    FriendshipResponse,
)
from app.schemas.invites import (
    InviteAcceptRequest,
    InviteAcceptResponse,
    InviteCreateRequest,
    InviteCreateResponse,
)
from app.schemas.auth import UserResponse
from app.services.friend_service import FriendService
from app.services.invite_service import InviteService
from app.api.deps import SessionDep
from app.models.sql import User

router = APIRouter()
friend_service = FriendService()
invite_service = InviteService()

# Mock current user for prototype
async def get_current_user_id():
    # In real app, extract from JWT
    # Returning a fixed UUID or fetching "me" 
    # For now, we rely on the client passing user_id in headers or just picking the first user in DB
    # Let's assume the client sends 'X-User-ID' header for prototype simplicity
    return None 

@router.post("/request", response_model=FriendshipResponse)
async def send_friend_request(
    request: FriendRequestCreate,
    session: SessionDep,
    # x_user_id: UUID = Header(...) # Simplified for prototype
):
    # Fallback to a test user logic if header missing (for manual swagger testing)
    # Ideally find the first user
    from sqlmodel import select
    result = await session.execute(select(User))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="No users in DB")
    
    return await friend_service.send_request(session, user.id, request)

@router.get("/", response_model=List[UserResponse])
async def list_my_friends(session: SessionDep, user_id: UUID | None = Query(default=None)):
    if user_id is None:
        # Mock user fallback for prototype testing
        from sqlmodel import select
        result = await session.execute(select(User))
        user = result.scalars().first()
        if not user:
            return []
        user_id = user.id

    return await friend_service.list_friends(session, user_id)


@router.delete("/", response_model=FriendDeleteResponse)
async def delete_friend(session: SessionDep, user_id: UUID = Query(...), friend_id: UUID = Query(...)):
    deleted_count = await friend_service.delete_friend(session, user_id, friend_id)
    return FriendDeleteResponse(deleted_count=deleted_count)


@router.post("/invite", response_model=InviteCreateResponse)
async def create_invite_link(request: InviteCreateRequest, session: SessionDep):
    invite, invite_link = await invite_service.create_invite(session, request.inviter_user_id)
    return InviteCreateResponse(invite_link=invite_link, token=invite.token, expires_at=invite.expires_at)


@router.post("/invite/accept", response_model=InviteAcceptResponse)
async def accept_invite_link(request: InviteAcceptRequest, session: SessionDep):
    invite = await invite_service.accept_invite(session, request.token, request.acceptor_user_id)
    return InviteAcceptResponse(
        status="accepted",
        inviter_user_id=invite.inviter_id,
        acceptor_user_id=invite.accepted_by_id,
        accepted_at=invite.accepted_at,
    )
