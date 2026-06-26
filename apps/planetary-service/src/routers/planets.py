"""
FastAPI router for planetary ephemeris endpoints.
"""

from __future__ import annotations

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, HTTPException, Path, Request

from ..horizons_client import HORIZONS_BODY_IDS, HorizonsClient
from ..models.planetary import (
    ALL_BODY_IDS,
    AllPlanetsResponse,
    PlanetaryEphemerisResponse,
    SinglePlanetResponse,
    SolarSystemBodyId,
)

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/planets", tags=["Planetary Ephemeris"])


@router.get(
    "/",
    response_model=AllPlanetsResponse,
    summary="Get ephemeris for all solar system bodies",
    description=(
        "Returns current apparent position data for all tracked solar system bodies "
        "(Sun, 8 planets, Moon, Pluto) from NASA Horizons. Results are cached for 5 minutes."
    ),
)
async def get_all_planets(request: Request) -> AllPlanetsResponse:
    """
    Fetches ephemeris data for all solar system bodies concurrently.
    Bodies that fail are omitted (graceful partial response).
    """
    import asyncio

    async def fetch_one(body_id: SolarSystemBodyId) -> PlanetaryEphemerisResponse | None:
        try:
            async with HorizonsClient() as client:
                return await client.get_ephemeris(body_id)
        except Exception as exc:
            log.warning("Failed to fetch ephemeris", body=body_id, error=str(exc))
            return None

    results = await asyncio.gather(*[fetch_one(b) for b in ALL_BODY_IDS])
    data = [r for r in results if r is not None]

    return AllPlanetsResponse(
        data=data,
        count=len(data),
        timestamp=datetime.now(UTC).isoformat(),
        request_id=request.headers.get("x-request-id"),
    )


@router.get(
    "/{body_id}/ephemeris",
    response_model=SinglePlanetResponse,
    summary="Get ephemeris for a specific solar system body",
    description=(
        "Returns current apparent position, distance, and phase data for a single "
        "solar system body from NASA Horizons. Cached for 5 minutes."
    ),
    responses={
        404: {"description": "Unknown solar system body ID"},
        502: {"description": "NASA Horizons API unavailable"},
    },
)
async def get_planet_ephemeris(
    request: Request,
    body_id: SolarSystemBodyId = Path(
        ...,
        description="Solar system body ID",
        examples=["mars", "jupiter", "moon"],
    ),
) -> SinglePlanetResponse:
    """
    Returns ephemeris data for a single solar system body.

    Parameters:
        body_id: One of sun, mercury, venus, earth, moon, mars,
                 jupiter, saturn, uranus, neptune, pluto
    """
    if body_id not in HORIZONS_BODY_IDS:
        raise HTTPException(
            status_code=404,
            detail={
                "type": "https://zenith.api/errors/not-found",
                "title": "Not Found",
                "status": 404,
                "detail": f"Unknown solar system body: '{body_id}'. "
                          f"Valid values: {', '.join(ALL_BODY_IDS)}",
            },
        )

    try:
        async with HorizonsClient() as client:
            ephemeris = await client.get_ephemeris(body_id)
    except Exception as exc:
        log.error("Horizons API error", body=body_id, error=str(exc))
        raise HTTPException(
            status_code=502,
            detail={
                "type": "https://zenith.api/errors/upstream-error",
                "title": "Upstream Service Error",
                "status": 502,
                "detail": f"NASA Horizons API returned an error: {exc}",
            },
        ) from exc

    return SinglePlanetResponse(
        data=ephemeris,
        timestamp=datetime.now(UTC).isoformat(),
        request_id=request.headers.get("x-request-id"),
    )
