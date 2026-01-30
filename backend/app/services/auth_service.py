from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sql import User
from app.schemas.auth import GoogleLoginRequest, UserResponse
import uuid

class AuthService:
    async def authenticate_google(self, session: AsyncSession, login_data: GoogleLoginRequest) -> User:
        # 1. In production, verify login_data.id_token with Google
        # For prototype, we trust the client or use the provided email/name if available.
        # This allows us to test without a real Google Token.
        
        email = login_data.email or "test@example.com"
        firebase_uid = login_data.id_token # Using token as UID for mock simplicity
        
        # 2. Check if user exists
        statement = select(User).where(User.email == email)
        result = await session.execute(statement)
        user = result.scalar_one_or_none()
        
        if not user:
            # 3. Create new user
            user = User(
                email=email,
                name=login_data.name or "New User",
                firebase_uid=firebase_uid,
                preference_vector=[0.0] * 5 # Init 5-dim vector
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            
        return user
