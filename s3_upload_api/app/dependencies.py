"""
FastAPI dependency: get_current_partner

Accepts either:
  - Bearer <JWT>   — for VDI / user-facing clients
  - X-API-Key <key> — for machine-to-machine partner integrations
"""
from __future__ import annotations

import logging
from typing import Annotated, Optional

import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, HTTPAuthorizationCredentials, HTTPBearer

from app.config import settings

logger = logging.getLogger(__name__)

_bearer = HTTPBearer(auto_error=False)
_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_current_partner(
    bearer: Annotated[Optional[HTTPAuthorizationCredentials], Depends(_bearer)] = None,
    api_key: Annotated[Optional[str], Security(_api_key_header)] = None,
) -> dict:
    # --- API Key path ---
    if api_key:
        if api_key in settings.API_KEYS:
            return {"sub": api_key, "type": "api_key", "email": ""}
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Invalid API key"},
        )

    # --- JWT path ---
    if bearer:
        try:
            payload = jwt.decode(
                bearer.credentials,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM],
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "TOKEN_EXPIRED", "message": "JWT has expired"},
            )
        except jwt.InvalidTokenError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "INVALID_TOKEN", "message": str(exc)},
            )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"code": "UNAUTHORIZED", "message": "No credentials provided"},
        headers={"WWW-Authenticate": "Bearer"},
    )
