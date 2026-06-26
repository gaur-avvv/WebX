"""Pytest configuration and shared fixtures for planetary-service tests."""

import pytest
from httpx import AsyncClient, ASGITransport


@pytest.fixture
async def client():
    """Async HTTP test client for the planetary FastAPI app.

    Imports are done inline to avoid loading the full app module at collection
    time (which would try to connect to Postgres/Redis/Kafka).
    """
    # Import lazily so we can patch dependencies before the app initialises
    from unittest.mock import AsyncMock, patch

    async def _noop() -> None:
        pass

    patches = [
        patch("src.main.init_db", new=AsyncMock(side_effect=_noop)),
        patch("src.main.close_db", new=AsyncMock(side_effect=_noop)),
        patch("src.main.init_redis", new=AsyncMock(side_effect=_noop)),
        patch("src.main.close_redis", new=AsyncMock(side_effect=_noop)),
        patch("src.main.init_kafka_producer", new=AsyncMock(side_effect=_noop)),
        patch("src.main.close_kafka_producer", new=AsyncMock(side_effect=_noop)),
    ]

    for p in patches:
        p.start()

    try:
        from src.main import create_app

        app = create_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        for p in patches:
            p.stop()
