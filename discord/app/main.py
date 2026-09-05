"""Entry point: runs the FastAPI server and the Discord bot concurrently.

Both are asyncio-native and share one event loop, so neither blocks the other
and API routes can await the bot's Discord calls directly. This module also
owns the process signals, so a stop drains both services before exiting.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import signal
from typing import Iterator

import uvicorn
from discord.ext import commands

from app.api.server import create_app
from app.bot.client import create_bot
from app.config import Settings, load_settings

logger = logging.getLogger("app")

SHUTDOWN_SIGNALS = (signal.SIGINT, signal.SIGTERM)


class _Server(uvicorn.Server):
    """A uvicorn server that leaves the process signals to :func:`run`.

    Stock uvicorn installs its own SIGINT/SIGTERM handlers and, once it has
    drained itself, re-raises the signal with the disposition it replaced.
    That kills the process before the bot is ever closed -- and as PID 1 in a
    container the default disposition is discarded instead, so nothing exits
    at all and ``docker stop`` waits out the grace period and SIGKILLs us.
    """

    @contextlib.contextmanager
    def capture_signals(self) -> Iterator[None]:
        yield


async def run_api(server: uvicorn.Server) -> None:
    """Serve the FastAPI app until ``server.should_exit`` is set."""
    await server.serve()


async def run_bot(bot: commands.Bot, token: str) -> None:
    """Run the Discord bot until it disconnects.

    A crash here aborts the TaskGroup, which cancels the API mid-serve rather
    than draining it: the lifespan shutdown is skipped and a request in flight
    ends as a 500. That is deliberate -- with the bot dead ``/ping`` answers
    503 anyway. To drain the API on a bot crash instead, the exception has to
    be caught here (set the shutdown event, re-raise it after the TaskGroup)
    so it never reaches the group; signals already take that cooperative path.
    """
    async with bot:
        await bot.start(token)


async def stop_on_signal(server: uvicorn.Server, bot: commands.Bot | None) -> None:
    """Wait for SIGINT/SIGTERM, then ask both services to finish.

    Each one then ends by itself -- uvicorn drains its connections, and
    ``bot.close()`` makes ``bot.start()`` return -- so a signalled shutdown
    leaves the TaskGroup by a normal return rather than by cancellation.
    A second signal gives up on draining.
    """
    stop = asyncio.Event()

    def request_stop(sig: signal.Signals) -> None:
        if stop.is_set():
            logger.warning("%s again - exiting without draining", sig.name)
            server.force_exit = True
            return
        logger.info("%s received - shutting down", sig.name)
        stop.set()

    loop = asyncio.get_running_loop()
    for sig in SHUTDOWN_SIGNALS:
        loop.add_signal_handler(sig, request_stop, sig)

    await stop.wait()
    server.should_exit = True
    if bot is not None:
        await bot.close()


async def run(settings: Settings) -> None:
    """Run both services. A signal drains both and returns; if either one
    fails or is cancelled, the TaskGroup cancels the others and waits for them
    to shut down before re-raising.

    Without a token no bot is created, so the TaskGroup is left with the API
    and the signal watcher and keeps serving.
    """
    token = settings.discord_token
    bot = create_bot(settings) if token is not None else None
    if bot is None:
        logger.warning("DISCORD_TOKEN is not set - running the API only, Discord bot disabled")

    server = _Server(
        uvicorn.Config(
            create_app(settings, bot),
            host=settings.api_host,
            port=settings.api_port,
            log_level=settings.log_level.lower(),
        )
    )

    async with asyncio.TaskGroup() as tg:
        tg.create_task(run_api(server), name="api")
        if bot is not None:
            tg.create_task(run_bot(bot, token), name="bot")
        tg.create_task(stop_on_signal(server, bot), name="signals")

    logger.info("shutdown complete")


def main() -> None:
    """Load settings, configure logging, and start both services."""
    settings = load_settings()
    logging.basicConfig(level=settings.log_level.upper())
    logger.info("starting api on %s:%s and discord bot", settings.api_host, settings.api_port)
    asyncio.run(run(settings))


if __name__ == "__main__":
    main()
