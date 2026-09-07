"""Health check endpoint used for liveness probes and smoke tests."""

from __future__ import annotations

import time

from fastapi import APIRouter, Request

from app import __version__

router = APIRouter(tags=["health"])

_STARTED_AT = time.monotonic()


@router.get("/health")
def health(request: Request) -> dict:
    """Report service liveness, version, uptime since import, and bot state.

    Stays 200 even with the bot disabled so the container healthcheck passes:
    the API itself is healthy, and ``bot`` carries the degraded detail.
    """
    return {
        "status": "ok",
        "version": __version__,
        "uptime_seconds": round(time.monotonic() - _STARTED_AT, 3),
        "bot": "running" if request.app.state.bot is not None else "disabled",
    }
