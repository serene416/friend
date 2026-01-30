from fastapi import APIRouter, Depends, HTTPException
from typing import List
from uuid import UUID
from app.schemas.friends import FriendRequestCreate, FriendshipResponse, FriendRequestAction
from app.schemas.auth import UserResponse
from app.services.friend_service import FriendService
from app.api.deps import SessionDep
from app.models.sql import User

router = APIRouter()
friend_service = FriendService()

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
async def list_my_friends(session: SessionDep):
    # Mock user
    from sqlmodel import select
    result = await session.execute(select(User))
    user = result.scalars().first()
    if not user: return []
    
    return await friend_service.list_friends(session, user.id)
