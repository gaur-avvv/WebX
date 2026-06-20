"""
NASA Horizons API Client.

The NASA Horizons system provides highly accurate planetary ephemeris data.
This client wraps the JPL Horizons web API with:
  - Async HTTP via httpx (with HTTP/2 support)
  - Automatic retry with exponential back-off (tenacity)
  - Redis caching (5-minute TTL)
  - Response parsing into Pydantic models

API Docs: https://ssd-api.jpl.nasa.gov/doc/horizons.html

Note on rate limits:
  - No official rate limit, but JPL recommends <= 1 request per second
  - Use caching aggressively (we cache for 5 minutes by default)
  - Planetary positions change slowly; 5-min cache is more than adequate
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import structlog
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from .cache import cache_get, cache_set
from .config import settings
from .models.planetary import PlanetaryEphemerisResponse, SolarSystemBodyId

log = structlog.get_logger(__name__)

# ─────────────────────────────────────────────
# Horizons Body ID Mapping
# NASA Horizons uses numeric target IDs; the API also accepts names.
# We use the canonical numeric IDs for reliability.
# ─────────────────────────────────────────────

HORIZONS_BODY_IDS: dict[SolarSystemBodyId, str] = {
    "sun": "10",
    "mercury": "199",
    "venus": "299",
    "earth": "399",
    "moon": "301",
    "mars": "499",
    "jupiter": "599",
    "saturn": "699",
    "uranus": "799",
    "neptune": "899",
    "pluto": "999",
}

BODY_NAMES: dict[SolarSystemBodyId, str] = {
    "sun": "Sun",
    "mercury": "Mercury",
    "venus": "Venus",
    "earth": "Earth",
    "moon": "Moon (Luna)",
    "mars": "Mars",
    "jupiter": "Jupiter",
    "saturn": "Saturn",
    "uranus": "Uranus",
    "neptune": "Neptune",
    "pluto": "Pluto",
}

# ─────────────────────────────────────────────
# Horizons API Client
# ─────────────────────────────────────────────

class HorizonsClient:
    """
    Async HTTP client for the JPL Horizons web API.

    Usage:
        async with HorizonsClient() as client:
            ephemeris = await client.get_ephemeris("mars")
    """

    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> "HorizonsClient":
        self._client = httpx.AsyncClient(
            base_url=settings.NASA_HORIZONS_API_URL,
            timeout=httpx.Timeout(30.0, connect=10.0),
            http2=True,
            headers={
                "User-Agent": "Project-Zenith/1.0 (planetary-service; contact: admin@zenith.example)",
                "Accept": "application/json",
            },
        )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._client:
            await self._client.aclose()

    async def get_ephemeris(
        self,
        body_id: SolarSystemBodyId,
        observer_location: str = "500@399",  # Geocentric (Earth centre)
    ) -> PlanetaryEphemerisResponse:
        """
        Fetches current ephemeris data for a solar system body.

        The Horizons API is queried in OBSERVER table mode, which returns
        apparent RA/DEC, distance, and magnitude for a given observer location.

        Parameters:
            body_id: Solar system body identifier (e.g. "mars")
            observer_location: Horizons observer site code (default: geocentric)

        Returns:
            Parsed ephemeris data as a PlanetaryEphemerisResponse

        Raises:
            httpx.HTTPStatusError: On HTTP 4xx/5xx responses
            ValueError: If the Horizons response cannot be parsed
        """
        cache_key = f"zenith:planetary:{body_id}:{observer_location}"
        cached = await cache_get(cache_key)
        if cached:
            log.debug("Planetary cache hit", body=body_id)
            return PlanetaryEphemerisResponse.model_validate(cached)

        log.info("Fetching ephemeris from NASA Horizons", body=body_id)

        now = datetime.now(UTC)
        start_time = now.strftime("%Y-%m-%d %H:%M")
        stop_time = (now + timedelta(minutes=1)).strftime("%Y-%m-%d %H:%M")

        # Horizons API parameters for observer table
        # See: https://ssd-api.jpl.nasa.gov/doc/horizons.html
        params: dict[str, str] = {
            "format": "json",
            "COMMAND": f"'{HORIZONS_BODY_IDS[body_id]}'",
            "OBJ_DATA": "YES",
            "MAKE_EPHEM": "YES",
            "EPHEM_TYPE": "OBSERVER",
            "CENTER": f"'{observer_location}'",
            "START_TIME": f"'{start_time}'",
            "STOP_TIME": f"'{stop_time}'",
            "STEP_SIZE": "'1 m'",
            # Output quantities: 1=RA/DEC, 9=range/range-rate, 20=Observer range
            # 29=Constellation, 31=RA/DEC rates, 43=Phase angle, 24=Sun-Target-Observer ang
            "QUANTITIES": "'1,9,23,24,29,43'",
            "ANG_FORMAT": "DEG",
            "RANGE_UNITS": "AU",
            "SUPPRESS_RANGE_RATE": "NO",
            "SKIP_DAYLT": "NO",
            "EXTRA_PREC": "YES",
        }

        raw_data = await self._fetch_with_retry(params)
        return await self._parse_horizons_response(body_id, raw_data)

    async def _fetch_with_retry(self, params: dict[str, str]) -> dict[str, Any]:
        """Fetches from Horizons with exponential back-off retry."""
        assert self._client is not None, "Client not initialised — use async context manager"

        async for attempt in AsyncRetrying(
            stop=stop_after_attempt(3),
            wait=wait_exponential(multiplier=1, min=1, max=10),
            retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
            reraise=True,
        ):
            with attempt:
                resp = await self._client.get("", params=params)
                resp.raise_for_status()
                return resp.json()  # type: ignore[no-any-return]

        # Should not reach here — tenacity re-raises on final failure
        raise RuntimeError("Horizons fetch failed after all retries")

    async def _parse_horizons_response(
        self,
        body_id: SolarSystemBodyId,
        data: dict[str, Any],
    ) -> PlanetaryEphemerisResponse:
        """
        Parses the Horizons API text-format response into structured data.

        The Horizons API returns a semi-structured text block within the JSON
        "result" field. We parse the $$SOE ... $$EOE data section.
        """
        if data.get("signature", {}).get("source") != "NASA/JPL Horizons API":
            raise ValueError("Unexpected Horizons API response format")

        result_text: str = data.get("result", "")

        # Extract data between $$SOE (start of ephemeris) and $$EOE (end)
        soe_match = re.search(r"\$\$SOE\n(.+?)\n\$\$EOE", result_text, re.DOTALL)
        if not soe_match:
            raise ValueError(f"No ephemeris data in Horizons response for {body_id}")

        # Parse the first data line (we only requested 1-minute window)
        data_line = soe_match.group(1).strip().split("\n")[0]
        fields = data_line.split(",")

        # Horizons OBSERVER table column order for QUANTITIES 1,9,23,24,29,43:
        # Date/Time, _, RA_ICRF, DEC_ICRF, dRA*cosD, d(DEC)/dt, Azi, Elev,
        # _, _, range (AU), dRange/dt, _, _, S-O-T, S-T-O (phase angle), ...
        try:
            ra_deg = float(fields[2].strip())
            dec_deg = float(fields[3].strip())
            range_au = float(fields[10].strip())
            # AU to km: 1 AU = 149,597,870.7 km
            range_km = range_au * 149_597_870.7
            # Light travel time: d_km / c_km_per_s (c ≈ 299,792.458 km/s) → minutes
            light_travel_min = range_km / 299_792.458 / 60.0
            phase_angle_deg = float(fields[15].strip()) if len(fields) > 15 else 0.0
        except (IndexError, ValueError) as exc:
            raise ValueError(f"Failed to parse Horizons data line: {data_line!r}") from exc

        now_iso = datetime.now(UTC).isoformat()

        response = PlanetaryEphemerisResponse(
            body_id=body_id,
            body_name=BODY_NAMES[body_id],
            right_ascension_deg=ra_deg,
            declination_deg=dec_deg,
            distance_au=range_au,
            distance_km=range_km,
            light_travel_time_min=light_travel_min,
            phase_angle_deg=phase_angle_deg,
            timestamp=now_iso,
        )

        # Cache for configured TTL (default: 5 minutes)
        await cache_set(
            f"zenith:planetary:{body_id}:500@399",
            response.model_dump(),
            settings.PLANETARY_CACHE_TTL_SECONDS,
        )

        return response
