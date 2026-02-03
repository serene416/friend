import logging
import os
from typing import Any

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger("app.kakao_local")


class KakaoLocalService:
    BASE_URL = "https://dapi.kakao.com"
    CATEGORY_SEARCH_ENDPOINT = "/v2/local/search/category.json"
    KEYWORD_SEARCH_ENDPOINT = "/v2/local/search/keyword.json"

    def __init__(self) -> None:
        self.timeout = httpx.Timeout(10.0, connect=3.0)

    def _get_headers(self) -> dict[str, str]:
        rest_api_key = os.getenv("KAKAO_REST_API_KEY")
        if not rest_api_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="KAKAO_REST_API_KEY is not configured",
            )
        return {"Authorization": f"KakaoAK {rest_api_key}"}

    async def _request_documents(
        self,
        client: httpx.AsyncClient,
        endpoint: str,
        params: dict[str, Any],
        context: str,
    ) -> list[dict[str, Any]]:
        try:
            response = await client.get(
                endpoint,
                headers=self._get_headers(),
                params=params,
            )
        except httpx.RequestError:
            logger.exception("Kakao Local API request failed (%s)", context)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"Failed to connect to Kakao Local API for {context}",
            )

        if response.status_code != 200:
            logger.warning(
                "Kakao Local API returned status=%s for %s: %s",
                response.status_code,
                context,
                response.text[:200],
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=(
                    f"Kakao Local API error while requesting {context} "
                    f"(status={response.status_code})"
                ),
            )

        payload = response.json()
        return payload.get("documents", [])

    async def search_stations(
        self,
        client: httpx.AsyncClient,
        *,
        mid_lat: float,
        mid_lng: float,
        radius: int,
        limit: int,
    ) -> list[dict[str, Any]]:
        return await self._request_documents(
            client=client,
            endpoint=self.CATEGORY_SEARCH_ENDPOINT,
            params={
                "category_group_code": "SW8",
                "x": mid_lng,
                "y": mid_lat,
                "radius": radius,
                "sort": "distance",
                "size": limit,
                "page": 1,
            },
            context="station search",
        )

    async def search_places_by_keyword(
        self,
        client: httpx.AsyncClient,
        *,
        query: str,
        x: float,
        y: float,
        radius: int,
        size: int,
        page: int,
    ) -> list[dict[str, Any]]:
        return await self._request_documents(
            client=client,
            endpoint=self.KEYWORD_SEARCH_ENDPOINT,
            params={
                "query": query,
                "x": x,
                "y": y,
                "radius": radius,
                "size": size,
                "page": page,
            },
            context=f"keyword search: {query} (page={page})",
        )
