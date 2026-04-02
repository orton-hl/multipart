"""
AuthMiddleware: lightweight outer guard.
- Bypasses /health and /docs* endpoints
- All business logic auth is handled in the dependency
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

BYPASS_PATHS = {"/health", "/docs", "/redoc", "/openapi.json"}


class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in BYPASS_PATHS or request.url.path.startswith("/docs"):
            return await call_next(request)
        return await call_next(request)
