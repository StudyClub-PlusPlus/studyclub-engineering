from unittest.mock import AsyncMock, Mock, patch

import pytest

from app.bot.commands import bulletin_cmd, command_channel
from app.config import Settings

CAPTAIN_ROLE_ID = 100000000000000002
BULLETIN_CHANNEL_ID = 200000000000000001
COMMAND_CHANNEL_ID = 300000000000000001
USER_ID = 327394882193883136


def _settings(**overrides) -> Settings:
    return Settings(
        **{
            "guild_id": 100000000000000001,
            "captain_role_id": CAPTAIN_ROLE_ID,
            "bulletin_channel_id": BULLETIN_CHANNEL_ID,
            "command_channel_id": COMMAND_CHANNEL_ID,
            **overrides,
        }
    )


def _ctx(*, roles=(CAPTAIN_ROLE_ID,), in_guild=True, channel_id=COMMAND_CHANNEL_ID) -> Mock:
    ctx = Mock()
    ctx.guild = Mock() if in_guild else None
    ctx.channel = Mock(id=channel_id)
    ctx.author = Mock(id=USER_ID)
    ctx.author.get_role.side_effect = lambda rid: Mock(id=rid) if rid in roles else None
    ctx.send = AsyncMock()
    return ctx


async def _run(ctx, settings, refresh_result=True):
    """Run the command with :func:`bulletin.refresh` stubbed out."""
    bot = Mock()
    with patch.object(
        bulletin_cmd.bulletin, "refresh", AsyncMock(return_value=refresh_result)
    ) as refresh:
        await bulletin_cmd.update_bulletin(ctx, bot, settings)
    return refresh


# --- may_update ------------------------------------------------------------


def test_may_update_allows_a_captain():
    assert bulletin_cmd.may_update(_ctx(), _settings()) is True


def test_may_update_refuses_a_member_without_the_captain_role():
    """The board is what every member reads, so refreshing it is not open to them."""
    assert bulletin_cmd.may_update(_ctx(roles=()), _settings()) is False


def test_may_update_refuses_when_no_captain_role_is_configured():
    """An unset role shuts the door rather than opening it, as on the API side."""
    assert bulletin_cmd.may_update(_ctx(), _settings(captain_role_id=None)) is False


def test_may_update_refuses_in_a_dm():
    """No guild means no member and no role, so there is nobody to check."""
    assert bulletin_cmd.may_update(_ctx(in_guild=False), _settings()) is False


# --- update_bulletin -------------------------------------------------------


async def test_update_bulletin_refreshes_and_confirms():
    ctx = _ctx()

    refresh = await _run(ctx, _settings(), refresh_result=True)

    refresh.assert_awaited_once()
    ctx.send.assert_awaited_once_with(bulletin_cmd.UPDATED)


async def test_update_bulletin_reports_a_failed_refresh():
    """refresh has already logged and alerted, so the reply says where to look."""
    ctx = _ctx()

    await _run(ctx, _settings(), refresh_result=False)

    ctx.send.assert_awaited_once_with(bulletin_cmd.FAILED)


async def test_update_bulletin_refuses_a_non_captain_without_touching_the_board():
    ctx = _ctx(roles=())

    refresh = await _run(ctx, _settings())

    refresh.assert_not_awaited()
    ctx.send.assert_awaited_once_with(bulletin_cmd.NOT_ALLOWED)


async def test_update_bulletin_refuses_outside_the_command_channel():
    """Commands are answered in one channel only; elsewhere the board is untouched."""
    ctx = _ctx(channel_id=999999999999999999)

    refresh = await _run(ctx, _settings())

    refresh.assert_not_awaited()
    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


async def test_update_bulletin_refuses_when_no_command_channel_is_configured():
    """An unset DISCORD_BOT_CHANNEL_ID refuses everywhere rather than allowing anywhere."""
    ctx = _ctx()

    refresh = await _run(ctx, _settings(command_channel_id=None))

    refresh.assert_not_awaited()
    ctx.send.assert_awaited_once_with(command_channel.DISABLED)


async def test_update_bulletin_says_the_feature_is_off_when_no_channel_is_set():
    """Without a channel refresh would only log; the caller is told instead."""
    ctx = _ctx()

    refresh = await _run(ctx, _settings(bulletin_channel_id=None))

    refresh.assert_not_awaited()
    ctx.send.assert_awaited_once_with(bulletin_cmd.DISABLED)


# --- registration ----------------------------------------------------------


async def test_register_adds_the_command_under_its_camel_case_name():
    """The prefix command is ``!updateBulletin``, matching testCmd's style."""
    import discord
    from discord.ext import commands

    bot = commands.Bot(command_prefix="!", intents=discord.Intents.default())
    bulletin_cmd.register(bot, _settings())

    assert bot.get_command("updateBulletin") is not None
