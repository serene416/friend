
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from app.services.auth_service import AuthService
from app.schemas.auth import KakaoLoginRequest
from app.models.sql import User

@pytest.mark.asyncio
async def test_authenticate_kakao_success():
    # Mock data
    mock_token = "valid_token"
    mock_kakao_response = {
        "id": 123456789,
        "properties": {
            "nickname": "TestUser",
            "profile_image": "http://example.com/image.jpg"
        }
    }
    
    # Mock Session with AsyncMock
    mock_session = AsyncMock()
    # For scalars().all() or scalar_one_or_none(), we need to mock the result properly
    # session.execute returns a result object
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session.execute.return_value = mock_result
    
    # Mock requests.get
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_kakao_response
        mock_get.return_value = mock_response
        
        service = AuthService()
        login_data = KakaoLoginRequest(kakao_access_token=mock_token)
        
        # Call method
        user = await service.authenticate_kakao(mock_session, login_data)
        
        # Assertions
        assert user.kakao_id == "123456789"
        assert user.nickname == "TestUser"
        assert user.profile_image == "http://example.com/image.jpg"
        
        # Verify session usage
        mock_session.add.assert_called()
        mock_session.commit.assert_called()
        mock_session.refresh.assert_called()

@pytest.mark.asyncio
async def test_authenticate_kakao_existing_user_update():
    # Mock data
    mock_token = "valid_token"
    mock_kakao_response = {
        "id": 123456789,
        "properties": {
            "nickname": "NewName",
            "profile_image": "http://example.com/new.jpg"
        }
    }
    
    # Mock Existing User
    existing_user = User(kakao_id="123456789", nickname="OldName", profile_image="http://example.com/old.jpg")
    
    # Mock Session with AsyncMock
    mock_session = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_user
    mock_session.execute.return_value = mock_result
    
    with patch("requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = mock_kakao_response
        mock_get.return_value = mock_response
        
        service = AuthService()
        login_data = KakaoLoginRequest(kakao_access_token=mock_token)
        
        # Call method
        user = await service.authenticate_kakao(mock_session, login_data)
        
        # Assertions
        assert user.nickname == "NewName"
        assert user.profile_image == "http://example.com/new.jpg"
        
        # Verify update happened
        mock_session.add.assert_called_with(existing_user)
        mock_session.commit.assert_called()
