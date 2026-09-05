from unittest.mock import AsyncMock

import discord
import pytest
from discord.ext import commands

from app.bot.commands.test_cmd import build_test_response, register


def _make_bot() -> commands.Bot:
    """Return a minimal bot instance for command registration tests."""
    return commands.Bot(command_prefix="!", intents=discord.Intents.none())


def test_build_test_response_mentions_command():
    """The response names the command it answers."""
    assert "testCmd" in build_test_response()


def test_register_adds_command():
    """``register`` makes ``testCmd`` resolvable on the bot."""
    bot = _make_bot()
    register(bot)
    assert bot.get_command("testCmd") is not None


@pytest.mark.asyncio
async def test_command_sends_expected_response():
    """Invoking the command sends the built response once."""
    bot = _make_bot()
    register(bot)

    ctx = AsyncMock()
    await bot.get_command("testCmd").callback(ctx)

    ctx.send.assert_awaited_once_with(build_test_response())
