"""Redis cache utilities for the planetary service."""

from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis
import structlog

from .config import settings

log = structlog.get_logger(__name__)

_redis: aioredis.Redis | None = None  # type: ignore[type-arg]


async def init_redis() -> None:
    global _redis
    _redis = aioredis.from_url(
        settings.REDIS_URL,
        encoding="utf-8",
        decode_responses=True,
        max_connections=10,
    )
    await _redis.ping()


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None


async def get_redis() -> aioredis.Redis:  # type: ignore[type-arg]
    if _redis is None:
        raise RuntimeError("Redis not initialised. Call init_redis() first.")
    return _redis


async def cache_get(key: str) -> Any | None:
    try:
        redis = await get_redis()
        raw = await redis.get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        log.warning("Cache get failed", key=key, error=str(exc))
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int) -> None:
    try:
        redis = await get_redis()
        await redis.setex(key, ttl_seconds, json.dumps(value))
    except Exception as exc:
        log.warning("Cache set failed", key=key, error=str(exc))
