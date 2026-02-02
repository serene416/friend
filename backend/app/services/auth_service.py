import httpx
import logging
from fastapi import HTTPException, status
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.sql import User
from app.schemas.auth import KakaoAuthResponse

logger = logging.getLogger("app.auth")

class AuthService:
    KAKAO_TOKEN_INFO_URL = "https://kapi.kakao.com/v1/user/access_token_info"
    KAKAO_USER_INFO_URL = "https://kapi.kakao.com/v2/user/me"

    async def verify_kakao_token(self, access_token: str) -> None:
        """
        Verify the Kakao access token.
        Raises 401 Unauthorized if invalid.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.KAKAO_TOKEN_INFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if response.status_code != 200:
                    logger.warning(
                        "Kakao token verify failed: status=%s body=%s",
                        response.status_code,
                        response.text[:200],
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid Kakao access token"
                    )
            except httpx.RequestError:
                logger.exception("Failed to connect to Kakao token info API")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to connect to Kakao API"
                )

    async def get_kakao_user_info(self, access_token: str) -> dict:
        """
        Fetch user information from Kakao.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    self.KAKAO_USER_INFO_URL,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                if response.status_code != 200:
                    logger.warning(
                        "Kakao user info failed: status=%s body=%s",
                        response.status_code,
                        response.text[:200],
                    )
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Failed to fetch Kakao user info"
                    )
                return response.json()
            except httpx.RequestError:
                logger.exception("Failed to connect to Kakao user info API")
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Failed to connect to Kakao API"
                )

    async def authenticate_kakao(
        self, session: AsyncSession, access_token: str, nickname: str, profile_image: str | None = None
    ) -> KakaoAuthResponse:
        """
        Main entry point for Kakao authentication.
        Verifies token, fetches info, syncs with DB, and returns response.
        """
        # 1. Verify Token
        await self.verify_kakao_token(access_token)

        # 2. Get User Info
        # We need the unique Kakao ID (id) to identify the user
        user_info = await self.get_kakao_user_info(access_token)
        kakao_id = str(user_info.get("id"))

        if not kakao_id:
             raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kakao ID not found in user info"
            )

        # 3. DB Sync
        # Check if user exists
        statement = select(User).where(User.kakao_id == kakao_id)
        result = await session.execute(statement)
        user = result.scalars().first()
        is_new_user = False

        if not user:
            # Create new user
            is_new_user = True
            user = User(
                kakao_id=kakao_id,
                nickname=nickname,
                profile_image=profile_image,
            )
            session.add(user)
        else:
            # Update existing user
            if user.nickname != nickname:
                user.nickname = nickname
                session.add(user)
            if profile_image and user.profile_image != profile_image:
                user.profile_image = profile_image
                session.add(user)
        
        await session.commit()
        await session.refresh(user)

        return KakaoAuthResponse(
            user_id=user.id,
            kakao_id=user.kakao_id,
            nickname=user.nickname,
            is_new_user=is_new_user,
            profile_image=user.profile_image,
            access_token=access_token # Optionally return the same token
        )

auth_service = AuthService()
