"""Kafka producer for the planetary service."""

from __future__ import annotations

import json

import structlog
from aiokafka import AIOKafkaProducer

from .config import settings

log = structlog.get_logger(__name__)

_producer: AIOKafkaProducer | None = None

KAFKA_TOPICS = {
    "PLANETARY_EPHEMERIS": "zenith.planetary.ephemeris",
}


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


async def publish_event(topic: str, key: str, value: dict) -> None:  # type: ignore[type-arg]
    if _producer is None:
        log.warning("Kafka producer not available — event dropped", topic=topic)
        return
    try:
        await _producer.send_and_wait(topic, value=value, key=key.encode())
    except Exception as exc:
        log.error("Failed to publish Kafka event", topic=topic, error=str(exc))
