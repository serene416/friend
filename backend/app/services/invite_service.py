import os
from datetime import datetime, timedelta
from secrets import token_urlsafe
from typing import Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql import Friendship, FriendshipStatus, Invite, InviteStatus, User


def _build_invite_link(base_url: str, token: str) -> str:
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}token={token}"


class InviteService:
    async def create_invite(self, session: AsyncSession, inviter_id: UUID) -> Tuple[Invite, str]:
        inviter = await session.get(User, inviter_id)
        if not inviter:
            raise HTTPException(status_code=404, detail="Inviter not found")

        ttl_days = int(os.getenv("INVITE_TOKEN_TTL_DAYS", "7"))
        base_url = os.getenv("INVITE_BASE_URL", "myapp://invite")

        token = None
        for _ in range(5):
            candidate = token_urlsafe(32)
            existing = await session.execute(select(Invite).where(Invite.token == candidate))
            if not existing.scalar_one_or_none():
                token = candidate
                break
        if not token:
            raise HTTPException(status_code=500, detail="Failed to generate unique invite token")

        invite = Invite(
            token=token,
            inviter_id=inviter_id,
            expires_at=datetime.utcnow() + timedelta(days=ttl_days),
            status=InviteStatus.PENDING,
        )
        session.add(invite)
        await session.commit()
        await session.refresh(invite)

        invite_link = _build_invite_link(base_url, token)
        return invite, invite_link

    async def accept_invite(self, session: AsyncSession, token: str, acceptor_id: UUID) -> Invite:
        result = await session.execute(select(Invite).where(Invite.token == token))
        invite = result.scalar_one_or_none()
        if not invite:
            raise HTTPException(status_code=404, detail="Invite not found")

        if invite.status == InviteStatus.ACCEPTED:
            raise HTTPException(status_code=400, detail="Invite already used")

        now = datetime.utcnow()
        if invite.expires_at < now:
            invite.status = InviteStatus.EXPIRED
            await session.commit()
            raise HTTPException(status_code=400, detail="Invite expired")

        if invite.inviter_id == acceptor_id:
            raise HTTPException(status_code=400, detail="Cannot accept your own invite")

        existing_stmt = select(Friendship).where(
            or_(
                and_(Friendship.requester_id == invite.inviter_id, Friendship.addressee_id == acceptor_id),
                and_(Friendship.requester_id == acceptor_id, Friendship.addressee_id == invite.inviter_id),
            )
        )
        existing_result = await session.execute(existing_stmt)
        existing = existing_result.scalars().all()

        if any(f.status == FriendshipStatus.ACCEPTED for f in existing):
            raise HTTPException(status_code=400, detail="Already friends")

        for f in existing:
            f.status = FriendshipStatus.ACCEPTED

        has_inviter_to_acceptor = any(
            f.requester_id == invite.inviter_id and f.addressee_id == acceptor_id for f in existing
        )
        has_acceptor_to_inviter = any(
            f.requester_id == acceptor_id and f.addressee_id == invite.inviter_id for f in existing
        )

        if not has_inviter_to_acceptor:
            session.add(
                Friendship(
                    requester_id=invite.inviter_id,
                    addressee_id=acceptor_id,
                    status=FriendshipStatus.ACCEPTED,
                )
            )
        if not has_acceptor_to_inviter:
            session.add(
                Friendship(
                    requester_id=acceptor_id,
                    addressee_id=invite.inviter_id,
                    status=FriendshipStatus.ACCEPTED,
                )
            )

        invite.status = InviteStatus.ACCEPTED
        invite.accepted_by_id = acceptor_id
        invite.accepted_at = now

        await session.commit()
        await session.refresh(invite)
        return invite
