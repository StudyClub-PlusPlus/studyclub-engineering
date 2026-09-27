"""FastAPI application factory."""

from __future__ import annotations

import logging
import time
from typing import Awaitable, Callable

from discord.ext import commands
from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app import __version__
from app.api.routes import health, ping, studies
from app.config import Settings
from app.study_reservations import StudyReservations

API_PREFIX = "/api/v1"

logger = logging.getLogger(__name__)


async def log_requests(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Log each request's method, path, status, and duration.

    The query string and body are left out so no PII or secrets reach the log.
    """
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.exception(
            "%s %s failed after %.1fms", request.method, request.url.path, elapsed_ms
        )
        raise
    elapsed_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed_ms,
    )
    return response


async def validation_error_as_400(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Answer a malformed request with 400, as the API docs specify, not FastAPI's 422."""
    return JSONResponse(status_code=400, content={"detail": jsonable_encoder(exc.errors())})


def create_app(settings: Settings, bot: commands.Bot | None = None) -> FastAPI:
    """Build the FastAPI app with the versioned routers mounted.

    ``bot`` is None when no Discord token is configured; the health route
    reports it so a bot-less deployment is visible to whoever polls, and the
    ping route refuses to send. Both the bot and the settings are held on
    ``app.state`` so routes can call Discord and read the configuration.
    """
    app = FastAPI(title="Discord Bot API", version=__version__)
    app.state.bot = bot
    app.state.settings = settings
    app.state.study_reservations = StudyReservations(settings.db_path)
    app.state.new_study_anchor_name = studies.DEFAULT_NEW_STUDY_ANCHOR_NAME
    app.middleware("http")(log_requests)
    app.exception_handler(RequestValidationError)(validation_error_as_400)
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(ping.router, prefix=API_PREFIX)
    app.include_router(studies.router, prefix=API_PREFIX)
    return app
