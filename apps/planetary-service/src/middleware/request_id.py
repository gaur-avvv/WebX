"""Request ID propagation middleware."""

import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach a unique X-Request-Id to every request/response."""

    async def dispatch(self, request: Request, call_next: object) -> Response:
        request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())
        response: Response = await call_next(request)  # type: ignore[arg-type]
        response.headers["X-Request-Id"] = request_id
        return response
