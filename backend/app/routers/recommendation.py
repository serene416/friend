from fastapi import APIRouter
from app.schemas.recommendation import (
    MidpointHotplaceRequest,
    MidpointHotplaceResponse,
    RecommendationRequest,
    RecommendationResponse,
)
from app.models.sql import Place
from app.services.recommendation_service import RecommendationService
from app.api.deps import SessionDep

router = APIRouter()
rec_service = RecommendationService()

@router.post("/", response_model=RecommendationResponse)
async def recommend_places(
    request: RecommendationRequest,
    session: SessionDep
):
    recommendations = await rec_service.get_recommendations(session, request)
    return RecommendationResponse(
        weather_summary="Sunny, 24°C (Mock)",
        recommendations=recommendations
    )


@router.post("/midpoint-hotplaces", response_model=MidpointHotplaceResponse)
async def recommend_midpoint_hotplaces(
    request: MidpointHotplaceRequest,
    session: SessionDep,
):
    return await rec_service.get_midpoint_hotplaces(request, session=session)

@router.post("/seed", status_code=201)
async def seed_place(place: Place, session: SessionDep):
    """Dev only: Create a place for testing"""
    session.add(place)
    await session.commit()
    await session.refresh(place)
    return place
