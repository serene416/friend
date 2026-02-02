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
class KakaoAuthRequest(BaseModel):
    kakao_access_token: str
    nickname: str
    profile_image: Optional[str] = None

class KakaoAuthResponse(BaseModel):
    user_id: UUID
    kakao_id: str
    nickname: str
    is_new_user: bool
    profile_image: Optional[str] = None
    access_token: Optional[str] = None # Optional for future JWT integration

# User Schemas
class UserResponse(BaseModel):
    id: UUID
    email: Optional[str]
    nickname: str
    profile_image: Optional[str] = None
    preference_vector: List[float] = []

    class Config:
        from_attributes = True
