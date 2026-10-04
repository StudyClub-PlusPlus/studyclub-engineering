from unittest.mock import AsyncMock, Mock

import discord
import pytest
from discord.ext import commands

from app.bot.commands import command_channel
from app.bot.commands.test_cmd import build_test_response, register, respond
from app.config import Settings

COMMAND_CHANNEL_ID = 300000000000000001


def _make_bot() -> commands.Bot:
    """Return a minimal bot instance for command registration tests."""
    return commands.Bot(command_prefix="!", intents=discord.Intents.none())


def _settings(**overrides) -> Settings:
    return Settings(**{"command_channel_id": COMMAND_CHANNEL_ID, **overrides})


def _ctx(channel_id=COMMAND_CHANNEL_ID) -> Mock:
    ctx = Mock()
    ctx.channel = Mock(id=channel_id)
    ctx.send = AsyncMock()
    return ctx


def test_build_test_response_mentions_command():
    """The response names the command it answers."""
    assert "testCmd" in build_test_response()


def test_register_adds_command():
    """``register`` makes ``testCmd`` resolvable on the bot."""
    bot = _make_bot()
    register(bot, _settings())
    assert bot.get_command("testCmd") is not None


@pytest.mark.asyncio
async def test_command_sends_expected_response():
    """Invoking the command in the command channel sends the built response once."""
    ctx = _ctx()

    await respond(ctx, _settings())

    ctx.send.assert_awaited_once_with(build_test_response())


@pytest.mark.asyncio
async def test_respond_refuses_outside_the_command_channel():
    """Even the smoke test is kept to the one channel commands are read in."""
    ctx = _ctx(channel_id=999999999999999999)

    await respond(ctx, _settings())

    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


@pytest.mark.asyncio
async def test_respond_refuses_when_no_command_channel_is_configured():
    """An unset DISCORD_BOT_CHANNEL_ID refuses everywhere rather than allowing anywhere."""
    ctx = _ctx()

    await respond(ctx, _settings(command_channel_id=None))

    ctx.send.assert_awaited_once_with(command_channel.DISABLED)
