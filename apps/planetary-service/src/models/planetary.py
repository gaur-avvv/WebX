"""
Pydantic models for planetary ephemeris data.
These are the data contracts between the planetary service and its consumers.
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict

# All valid solar system body IDs
SolarSystemBodyId = Literal[
    "sun", "mercury", "venus", "earth", "moon",
    "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"
]

ALL_BODY_IDS: list[SolarSystemBodyId] = [
    "sun", "mercury", "venus", "earth", "moon",
    "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"
]


class PlanetaryEphemerisResponse(BaseModel):
    """
    Planetary ephemeris data from NASA Horizons.
    Represents the apparent position of a solar system body as seen from Earth.
    """
    model_config = ConfigDict(frozen=True)

    body_id: SolarSystemBodyId
    body_name: str

    # Apparent position (ICRF/J2000 frame)
    right_ascension_deg: float = Field(
        ...,
        ge=0.0,
        lt=360.0,
        description="Right Ascension in decimal degrees (J2000/ICRF)",
    )
    declination_deg: float = Field(
        ...,
        ge=-90.0,
        le=90.0,
        description="Declination in decimal degrees (J2000/ICRF)",
    )

    # Distance from Earth
    distance_au: float = Field(
        ...,
        gt=0.0,
        description="Distance from Earth in Astronomical Units (AU)",
    )
    distance_km: float = Field(
        ...,
        gt=0.0,
        description="Distance from Earth in kilometres",
    )

    # Light travel time
    light_travel_time_min: float = Field(
        ...,
        ge=0.0,
        description="One-way light travel time from body to Earth, in minutes",
    )

    # Phase angle (illumination)
    phase_angle_deg: float | None = Field(
        default=None,
        ge=0.0,
        le=180.0,
        description="Sun-Target-Observer phase angle in degrees",
    )

    # Visual magnitude (optional, not all bodies have this from Horizons)
    apparent_magnitude: float | None = Field(
        default=None,
        description="Apparent visual magnitude",
    )

    timestamp: str = Field(description="ISO 8601 timestamp of this ephemeris fix")


class PlanetaryBodySummary(BaseModel):
    """Lightweight summary for the /planets list endpoint."""
    model_config = ConfigDict(frozen=True)

    body_id: SolarSystemBodyId
    body_name: str
    distance_au: float
    timestamp: str


class AllPlanetsResponse(BaseModel):
    """Response envelope for GET /api/v1/planets."""
    model_config = ConfigDict(frozen=True)

    success: bool = True
    data: list[PlanetaryEphemerisResponse]
    count: int
    timestamp: str
    request_id: str | None = None


class SinglePlanetResponse(BaseModel):
    """Response envelope for GET /api/v1/planets/:id/ephemeris."""
    model_config = ConfigDict(frozen=True)

    success: bool = True
    data: PlanetaryEphemerisResponse
    timestamp: str
    request_id: str | None = None
