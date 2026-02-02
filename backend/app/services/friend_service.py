from sqlmodel import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sql import User, Friendship, FriendshipStatus
from app.schemas.friends import FriendRequestCreate
from uuid import UUID
from fastapi import HTTPException
from datetime import datetime

class FriendService:
    async def send_request(
        self, session: AsyncSession, requester_id: UUID, request_data: FriendRequestCreate
    ) -> Friendship:
        # 1. Find target user
        target_user = None
        if request_data.target_user_id:
            target_user = await session.get(User, request_data.target_user_id)
        elif request_data.email:
            result = await session.execute(select(User).where(User.email == request_data.email))
            target_user = result.scalar_one_or_none()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        if target_user.id == requester_id:
            raise HTTPException(status_code=400, detail="Cannot add self")

        # 2. Check existing friendship
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.requester_id == requester_id, Friendship.addressee_id == target_user.id),
                and_(Friendship.requester_id == target_user.id, Friendship.addressee_id == requester_id)
            )
        )
        existing = await session.execute(stmt)
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Friendship already exists or pending")

        # 3. Create request
        friendship = Friendship(
            requester_id=requester_id,
            addressee_id=target_user.id,
            status=FriendshipStatus.PENDING
        )
        session.add(friendship)
        await session.commit()
        await session.refresh(friendship)
        return friendship

    async def list_friends(self, session: AsyncSession, user_id: UUID) -> list[User]:
        # Simple Join query to get friends
        # In SQLModel/SQLAlchemy async, this can be complex.
        # We query friendships where status=ACCEPTED and user is one of the parties.
        
        stmt = select(Friendship).where(
            Friendship.status == FriendshipStatus.ACCEPTED,
            or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id)
        )
        result = await session.execute(stmt)
        friendships = result.scalars().all()
        
        friend_ids = []
        for f in friendships:
            friend_ids.append(f.addressee_id if f.requester_id == user_id else f.requester_id)
        
        if not friend_ids:
            return []

        # Fetch Users
        u_stmt = select(User).where(User.id.in_(friend_ids))
        u_res = await session.execute(u_stmt)
        friends = u_res.scalars().all()
        now = datetime.utcnow()
        for friend in friends:
            if friend.status_message_expires_at and friend.status_message_expires_at < now:
                friend.status_message = None
                friend.status_message_expires_at = None
        return friends

    async def delete_friend(self, session: AsyncSession, user_id: UUID, friend_id: UUID) -> int:
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.requester_id == user_id, Friendship.addressee_id == friend_id),
                and_(Friendship.requester_id == friend_id, Friendship.addressee_id == user_id),
            )
        )
        result = await session.execute(stmt)
        friendships = result.scalars().all()

        if not friendships:
            raise HTTPException(status_code=404, detail="Friendship not found")

        for friendship in friendships:
            await session.delete(friendship)
        await session.commit()

        return len(friendships)
