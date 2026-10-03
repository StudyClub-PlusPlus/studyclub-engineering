from unittest.mock import AsyncMock, Mock

from app.bot.commands import command_channel
from app.config import Settings

COMMAND_CHANNEL_ID = 300000000000000001
OTHER_CHANNEL_ID = 999999999999999999


def _ctx(channel_id=COMMAND_CHANNEL_ID) -> Mock:
    ctx = Mock()
    ctx.channel = Mock(id=channel_id)
    ctx.invoked_with = "testCmd"
    ctx.send = AsyncMock()
    return ctx


def test_wrong_channel_mentions_the_channel_so_it_can_be_clicked():
    """``<#id>`` renders as a link in Discord; the raw ID would have to be hunted for."""
    assert f"<#{COMMAND_CHANNEL_ID}>" in command_channel.wrong_channel(COMMAND_CHANNEL_ID)


async def test_check_allows_the_command_channel():
    ctx = _ctx()

    assert await command_channel.check(ctx, Settings(command_channel_id=COMMAND_CHANNEL_ID)) is True
    ctx.send.assert_not_awaited()


async def test_check_refuses_another_channel_and_points_at_the_right_one():
    ctx = _ctx(channel_id=OTHER_CHANNEL_ID)

    result = await command_channel.check(ctx, Settings(command_channel_id=COMMAND_CHANNEL_ID))

    assert result is False
    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


async def test_check_refuses_when_no_command_channel_is_configured(caplog):
    """A missing setting never means "any channel", and it is loud about why."""
    ctx = _ctx()

    with caplog.at_level("WARNING"):
        result = await command_channel.check(ctx, Settings(command_channel_id=None))

    assert result is False
    ctx.send.assert_awaited_once_with(command_channel.DISABLED)
    assert "DISCORD_BOT_CHANNEL_ID" in caplog.text


async def test_check_refuses_a_dm():
    """A DM channel has an ID too, and it is never the configured one."""
    ctx = _ctx(channel_id=123400000000000000)
    ctx.guild = None

    assert (
        await command_channel.check(ctx, Settings(command_channel_id=COMMAND_CHANNEL_ID)) is False
    )
    ctx.send.assert_awaited_once()
