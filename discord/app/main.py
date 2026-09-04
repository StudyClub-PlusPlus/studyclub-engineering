"""Entry point: runs the FastAPI server and the Discord bot concurrently.

Both are asyncio-native and share one event loop, so neither blocks the other
and API routes can await the bot's Discord calls directly.
"""

from __future__ import annotations

import asyncio
import logging

import uvicorn
from discord.ext import commands

from app.api.server import create_app
from app.bot.client import create_bot
from app.config import SettingsStore, load_settings

logger = logging.getLogger("app")


async def run_api(store: SettingsStore, bot: commands.Bot | None) -> None:
    """Serve the FastAPI app with uvicorn until it stops."""
    settings = store.current
    config = uvicorn.Config(
        create_app(store, bot),
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.log_level.lower(),
    )
    await uvicorn.Server(config).serve()


async def run_bot(bot: commands.Bot, token: str) -> None:
    """Run the Discord bot until it disconnects."""
    async with bot:
        await bot.start(token)


async def run(store: SettingsStore) -> None:
    """Run both services. If either one fails or is cancelled, the TaskGroup
    cancels the other and waits for it to shut down before re-raising.

    Without a token no bot is created, so the TaskGroup is left with only the
    API task and keeps serving.
    """
    token = store.current.discord_token
    bot = create_bot(store) if token is not None else None
    if bot is None:
        logger.warning("DISCORD_TOKEN is not set - running the API only, Discord bot disabled")

    async with asyncio.TaskGroup() as tg:
        tg.create_task(run_api(store, bot), name="api")
        if bot is not None:
            tg.create_task(run_bot(bot, token), name="bot")


def main() -> None:
    """Load settings, configure logging, and start both services."""
    store = SettingsStore(load_settings())
    settings = store.current
    logging.basicConfig(level=settings.log_level.upper())
    logger.info("starting api on %s:%s and discord bot", settings.api_host, settings.api_port)
    asyncio.run(run(store))


if __name__ == "__main__":
    main()
