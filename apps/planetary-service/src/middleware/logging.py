"""Structured logging middleware using structlog."""

import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

log = structlog.get_logger(__name__)


class StructlogMiddleware(BaseHTTPMiddleware):
    """Middleware that logs each request/response using structlog."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        start = time.perf_counter()

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        try:
            response: Response = await call_next(request)  # type: ignore[arg-type]
        except Exception as exc:
            log.error("Unhandled request error", exc_info=exc)
            raise

        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        log.info(
            "request",
            status_code=response.status_code,
            duration_ms=duration_ms,
        )
        return response
