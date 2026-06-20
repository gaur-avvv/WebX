"""Health check router for Kubernetes liveness and readiness probes."""

from __future__ import annotations

import time
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from ..cache import get_redis
from ..database import get_engine
from ..config import settings

router = APIRouter(tags=["Health"])

START_TIME = time.time()


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "unhealthy"]
    service: str
    version: str
    uptime_seconds: float
    timestamp: str
    checks: dict[str, Literal["ok", "error"]] = {}


@router.get("/health", summary="Liveness probe")
async def liveness() -> dict[str, str]:
    """Always returns 200 if the process is alive."""
    from datetime import UTC, datetime
    return {"status": "ok", "timestamp": datetime.now(UTC).isoformat()}


@router.get("/health/ready", response_model=HealthResponse, summary="Readiness probe")
async def readiness() -> HealthResponse:
    """Returns 200 only when PostgreSQL and Redis are reachable."""
    from datetime import UTC, datetime
    import asyncio

    checks: dict[str, Literal["ok", "error"]] = {}

    # Check Redis
    try:
        redis = await get_redis()
        await redis.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    # Check PostgreSQL
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception:
        checks["postgres"] = "error"

    all_ok = all(v == "ok" for v in checks.values())

    return HealthResponse(
        status="ok" if all_ok else "degraded",
        service="planetary-service",
        version=settings.VERSION,
        uptime_seconds=round(time.time() - START_TIME, 2),
        timestamp=datetime.now(UTC).isoformat(),
        checks=checks,
    )
