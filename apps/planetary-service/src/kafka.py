"""Kafka producer for the planetary service."""

from __future__ import annotations

import json
from typing import Any

import structlog
from aiokafka import AIOKafkaProducer  # type: ignore[import-untyped]
from pydantic import BaseModel, Field

from .config import settings

log = structlog.get_logger(__name__)

_producer: AIOKafkaProducer | None = None

# ─── Schemas ──────────────────────────────────────────────────────────────────

class PlanetaryEphemeris(BaseModel):
    """Schema for planetary position updates."""
    bodyName: str
    coordinates: dict[str, float] = Field(..., description="x, y, z in AU")
    velocity: dict[str, float] = Field(..., description="vx, vy, vz in AU/day")
    epoch: str

KAFKA_TOPICS = {
    "PLANETARY_EPHEMERIS": "zenith.planetary.ephemeris",
}

# ─── Producer Logic ──────────────────────────────────────────────────────────

async def init_kafka_producer() -> None:
    global _producer
    _producer = AIOKafkaProducer(
        bootstrap_servers=settings.kafka_brokers_list,
        client_id="planetary-service",
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        compression_type="gzip",
        enable_idempotence=True,
    )
    await _producer.start()


async def close_kafka_producer() -> None:
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None


async def publish_event(topic: str, key: str, value: dict[str, Any]) -> None:
    if _producer is None:
        log.warning("Kafka producer not available — event dropped", topic=topic)
        return

    # Validate using Pydantic
    if topic == KAFKA_TOPICS["PLANETARY_EPHEMERIS"]:
        try:
            PlanetaryEphemeris(**value)
        except Exception as e:
            log.error("Planetary ephemeris validation failed", topic=topic, error=str(e), value=value)
            return

    try:
        await _producer.send_and_wait(topic, value=value, key=key.encode())
    except Exception as exc:
        log.error("Failed to publish Kafka event", topic=topic, error=str(exc))
