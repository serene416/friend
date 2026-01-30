from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional, List

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[UUID] = None

# Auth Schemas
# Auth Schemas
class KakaoLoginRequest(BaseModel):
    kakao_access_token: str
    nickname: Optional[str] = None
    profile_image: Optional[str] = None

# User Schemas
class UserResponse(BaseModel):
    id: UUID
    email: Optional[str]
    nickname: str
    kakao_id: str
    profile_image: Optional[str] = None
    preference_vector: List[float] = []

    class Config:
        from_attributes = True
