from fastapi import APIRouter, Depends
from app.schemas.auth import GoogleLoginRequest, UserResponse, Token
from app.services.auth_service import AuthService
from app.api.deps import SessionDep

router = APIRouter()
auth_service = AuthService()

@router.post("/login", response_model=UserResponse)
async def login_google(
    login_data: GoogleLoginRequest,
    session: SessionDep
):
    """
    Login with Google ID Token.
    Returns User profile (and normally JWT, but simplified for prototype).
    """
    user = await auth_service.authenticate_google(session, login_data)
    return user

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    session: SessionDep
    # In real app, we would inject CurrentUser here using JWT
):
    # Mock return for prototype
    return UserResponse(
        id="00000000-0000-0000-0000-000000000000",
        email="mock@example.com",
        name="Mock User",
        firebase_uid="mock_uid"
    )
