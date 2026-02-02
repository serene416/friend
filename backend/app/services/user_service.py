from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sql import User


class UserService:
    async def set_status_message(self, session: AsyncSession, user_id: UUID, message: str):
        user = await session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        cleaned = message.strip()
        if not cleaned:
            user.status_message = None
            user.status_message_expires_at = None
        else:
            user.status_message = cleaned
            user.status_message_expires_at = datetime.utcnow() + timedelta(hours=24)

        session.add(user)
        await session.commit()
        await session.refresh(user)
        return {
            "message": user.status_message,
            "expires_at": user.status_message_expires_at,
        }


user_service = UserService()
