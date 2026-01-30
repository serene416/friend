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
class GoogleLoginRequest(BaseModel):
    id_token: str
    # Optional fields for mock/dev
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    photo_url: Optional[str] = None

# User Schemas
class UserResponse(BaseModel):
    id: UUID
    email: Optional[str]
    name: str
    firebase_uid: str
    preference_vector: List[float] = []

    class Config:
        from_attributes = True
