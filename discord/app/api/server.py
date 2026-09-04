"""FastAPI application factory."""

from __future__ import annotations

from discord.ext import commands
from fastapi import FastAPI

from app import __version__
from app.api.routes import health, ping
from app.config import Settings

API_PREFIX = "/api/v1"


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
    app.include_router(health.router, prefix=API_PREFIX)
    app.include_router(ping.router, prefix=API_PREFIX)
    return app
