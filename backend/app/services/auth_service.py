from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sql import User
from app.schemas.auth import KakaoLoginRequest, UserResponse
import uuid

class AuthService:
    async def authenticate_kakao(self, session: AsyncSession, login_data: KakaoLoginRequest) -> User:
        # 1. Verify access_token with Kakao API
        # https://kapi.kakao.com/v2/user/me
        
        headers = {
            "Authorization": f"Bearer {login_data.kakao_access_token}",
            "Content-type": "application/x-www-form-urlencoded;charset=utf-8"
        }
        
        # We use requests here as it is synchronous, but for high performance async context 
        # we might want to use httpx in the future. For now, following requirements.
        import requests
        try:
             response = requests.get("https://kapi.kakao.com/v2/user/me", headers=headers)
             response.raise_for_status()
             kakao_user_info = response.json()
             kakao_id = str(kakao_user_info.get("id"))
             properties = kakao_user_info.get("properties", {})
             nickname = properties.get("nickname", login_data.nickname or "Unknown User")
             profile_image = properties.get("profile_image", login_data.profile_image)
             
        except Exception as e:
            # Fallback for dev/mock if token is invalid or network fails (only if needed)
            # For now, we assume strict validation. 
            # If dev mode is needed, we could allow bypassing.
            # print(f"Kakao Auth Failed: {e}")
            raise ValueError("Invalid Kakao Access Token")

        # 2. Check if user exists
        statement = select(User).where(User.kakao_id == kakao_id)
        result = await session.execute(statement)
        user = result.scalar_one_or_none()
        
        if not user:
            # 3. Create new user
            user = User(
                kakao_id=kakao_id,
                nickname=nickname,
                profile_image=profile_image,
                preference_vector=[0.0] * 5 # Init 5-dim vector
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
        else:
            # Update info if changed
            if user.nickname != nickname or user.profile_image != profile_image:
                user.nickname = nickname
                user.profile_image = profile_image
                session.add(user)
                await session.commit()
                await session.refresh(user)
            
        return user
