"""Common request headers (docs/discord-development-guide/api/common-header.md).

Each header is a FastAPI dependency, so it is parsed once at the request
boundary and routes receive the checked value.
"""

from __future__ import annotations

import re
import secrets

from fastapi import Header, HTTPException, Request

# int() and str.isdigit() both accept more than ASCII digits, so match instead.
_SNOWFLAKE = re.compile(r"[0-9]{17,20}")


def require_api_key(request: Request, x_api_key: str | None = Header(default=None)) -> None:
    """Reject the request unless ``X-API-Key`` matches ``DISCORD_API_KEY``.

    With no key configured every request is rejected, rather than let through.
    """
    expected = request.app.state.settings.api_key
    if (
        expected is None
        or x_api_key is None
        or not secrets.compare_digest(x_api_key.encode(), expected.encode())
    ):
        raise HTTPException(status_code=401, detail="missing or invalid X-API-Key")


def discord_user_id(x_discord_user_id: str | None = Header(default=None)) -> int:
    """Return ``X-Discord-User-ID`` as the int discord.py looks members up by."""
    if x_discord_user_id is None:
        raise HTTPException(status_code=400, detail="X-Discord-User-ID is required")
    if not _SNOWFLAKE.fullmatch(x_discord_user_id):
        raise HTTPException(status_code=400, detail="X-Discord-User-ID is not a Discord user ID")
    return int(x_discord_user_id)


def idempotency_key(idempotency_key: str | None = Header(default=None)) -> str:
    """Return ``Idempotency-Key``. It is only logged, never stored or replayed."""
    if idempotency_key is None or not idempotency_key.strip():
        raise HTTPException(status_code=400, detail="Idempotency-Key is required")
    return idempotency_key
