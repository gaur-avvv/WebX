"""Basic smoke tests for the planetary-service health endpoint."""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(client):  # type: ignore[no-untyped-def]
    """The /health endpoint should be reachable and return HTTP 200."""
    response = await client.get("/health")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_health_response_contains_status(client):  # type: ignore[no-untyped-def]
    """The /health response body should include a status field."""
    response = await client.get("/health")
    body = response.json()
    assert "status" in body
