"""
Zenith Planetary Service — FastAPI Application Entry Point

Provides real-time planetary ephemeris data sourced from the NASA Horizons
System API (https://ssd.jpl.nasa.gov/horizons/), with async Redis caching
and Kafka event publishing.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from .cache import close_redis, init_redis
from .config import settings
from .database import close_db, init_db
from .kafka import close_kafka_producer, init_kafka_producer
from .middleware.logging import StructlogMiddleware
from .middleware.request_id import RequestIdMiddleware
from .routers import health, planets

log = structlog.get_logger(__name__)


# ─────────────────────────────────────────────
# Lifespan: startup + shutdown events
# ─────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Manage application lifecycle: connect/disconnect all external services."""
    log.info("🚀 Starting Zenith Planetary Service...", version=settings.VERSION)

    # Startup sequence
    await init_db()
    log.info("✅ PostgreSQL connected")

    await init_redis()
    log.info("✅ Redis connected")

    try:
        await init_kafka_producer()
        log.info("✅ Kafka producer ready")
    except Exception as exc:
        # Kafka is non-critical for REST functionality
        log.warning("Kafka producer failed — running in degraded mode", error=str(exc))

    log.info("✅ Planetary Service ready", port=settings.PORT)

    yield  # Application runs here

    # Shutdown sequence
    log.info("Shutting down Planetary Service...")
    await close_kafka_producer()
    await close_redis()
    await close_db()
    log.info("Goodbye 🌌")


# ─────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────

def create_app() -> FastAPI:
    """Application factory — creates and configures the FastAPI instance."""
    app = FastAPI(
        title="Zenith Planetary Service",
        description="Real-time planetary ephemeris data from NASA Horizons",
        version=settings.VERSION,
        docs_url="/docs" if settings.APP_ENV != "production" else None,
        redoc_url="/redoc" if settings.APP_ENV != "production" else None,
        lifespan=lifespan,
    )

    # ─── Middleware (order matters — first registered = outermost) ───

    # Request ID propagation (must be first for tracing)
    app.add_middleware(RequestIdMiddleware)

    # Structured logging
    app.add_middleware(StructlogMiddleware)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
    )

    # GZip compression for large response bodies (orbit paths, etc.)
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    # ─── Prometheus metrics ───
    Instrumentator(
        should_group_status_codes=True,
        excluded_handlers=["/health", "/metrics"],
    ).instrument(app).expose(app, endpoint="/metrics")

    # ─── Routes ───
    app.include_router(health.router)
    app.include_router(planets.router, prefix="/api/v1")

    # ─── Global exception handler (RFC 7807 Problem Details) ───
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        log.error("Unhandled exception", path=request.url.path, error=str(exc), exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "type": "https://zenith.api/errors/internal-server-error",
                "title": "Internal Server Error",
                "status": 500,
                "detail": str(exc) if settings.APP_ENV == "development" else
                          "An unexpected error occurred.",
                "instance": str(request.url.path),
            },
        )

    return app


app = create_app()
