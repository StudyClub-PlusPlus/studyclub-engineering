import asyncio
import os
import signal
from unittest.mock import AsyncMock, Mock

import pytest
import uvicorn

from app.main import SHUTDOWN_SIGNALS, _Server, stop_on_signal


def _server() -> Mock:
    """Return a stand-in server exposing the two flags uvicorn stops on."""
    server = Mock()
    server.should_exit = False
    server.force_exit = False
    return server


async def _signal_after(task: asyncio.Task, sig: signal.Signals, times: int = 1) -> None:
    """Signal this process once ``task`` has installed its handlers."""
    await asyncio.sleep(0)  # let stop_on_signal reach its `await stop.wait()`
    for _ in range(times):
        os.kill(os.getpid(), sig)
        await asyncio.sleep(0)


@pytest.mark.parametrize("sig", SHUTDOWN_SIGNALS)
async def test_signal_drains_both_services(sig):
    """A stop signal asks uvicorn to drain and closes the bot, then returns."""
    server, bot = _server(), Mock(close=AsyncMock())

    task = asyncio.create_task(stop_on_signal(server, bot))
    await _signal_after(task, sig)
    await asyncio.wait_for(task, timeout=5)

    assert server.should_exit is True
    assert server.force_exit is False
    bot.close.assert_awaited_once()


async def test_signal_without_bot_still_stops_the_api():
    """With no token there is no bot to close, but the API must still drain."""
    server = _server()

    task = asyncio.create_task(stop_on_signal(server, None))
    await _signal_after(task, signal.SIGTERM)
    await asyncio.wait_for(task, timeout=5)

    assert server.should_exit is True


async def test_second_signal_gives_up_on_draining():
    """An impatient second Ctrl+C stops waiting for connections to finish."""
    server, bot = _server(), Mock(close=AsyncMock())

    task = asyncio.create_task(stop_on_signal(server, bot))
    await _signal_after(task, signal.SIGINT, times=2)
    await asyncio.wait_for(task, timeout=5)

    assert server.force_exit is True


def test_server_subclass_still_overrides_uvicorn():
    """Guards the fix against a uvicorn bump renaming the hook we neutralise."""
    assert "capture_signals" in vars(uvicorn.Server)


def test_server_leaves_signal_handlers_alone():
    """Serving must not replace the handlers ``stop_on_signal`` installed."""
    server = _Server(uvicorn.Config(Mock()))
    before = {sig: signal.getsignal(sig) for sig in SHUTDOWN_SIGNALS}

    with server.capture_signals():
        assert {sig: signal.getsignal(sig) for sig in SHUTDOWN_SIGNALS} == before
