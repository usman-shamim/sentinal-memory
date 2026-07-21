"""
Authentication middleware — Bearer token validation.
All endpoints except /health require Authorization: Bearer <token>.
"""

import os
from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse

AUTH_TOKEN = os.environ.get("AUTH_TOKEN", "")

EXEMPT_PATHS = {"/health", "/docs", "/openapi.json", "/redoc"}


async def auth_middleware(request: Request, call_next):
    """Validate Bearer token on all endpoints except exempt paths."""
    # Skip auth for exempt paths
    if request.url.path in EXEMPT_PATHS:
        return await call_next(request)
    
    # Skip if no AUTH_TOKEN configured (dev mode)
    if not AUTH_TOKEN:
        return await call_next(request)
    
    # Check Authorization header
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"error": "Missing Authorization header. Expected: Bearer <token>"},
        )
    
    token = auth_header[7:]  # Remove "Bearer " prefix
    if token != AUTH_TOKEN:
        return JSONResponse(
            status_code=403,
            content={"error": "Invalid token"},
        )
    
    return await call_next(request)
