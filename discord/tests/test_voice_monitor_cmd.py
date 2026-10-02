import datetime
import sqlite3
from unittest.mock import AsyncMock, Mock

import discord
import pytest

from app.bot import voice_monitor
from app.bot.commands import command_channel, voice_monitor_cmd
from app.config import Settings
from app.voice_activity_log import VoiceActivityLog

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
COMMAND_CHANNEL_ID = 300000000000000001
USER_ID = 327394882193883136
ANCHOR = voice_monitor.DEFAULT_NEW_STUDY_ANCHOR_NAME
NOW = datetime.datetime(2026, 9, 30, 3, 0, tzinfo=datetime.timezone.utc)


def _settings(**overrides) -> Settings:
    return Settings(
        **{
            "guild_id": GUILD_ID,
            "captain_role_id": CAPTAIN_ROLE_ID,
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


def _voice(channel_id, name) -> Mock:
    voice = Mock(spec=discord.VoiceChannel, id=channel_id)
    voice.name = name
    voice.permissions_for.return_value = Mock(view_channel=True)
    voice.voice_states = {}
    return voice


def _category(name, voice_channels=()) -> Mock:
    category = Mock(spec=discord.CategoryChannel)
    category.name = name
    category.voice_channels = list(voice_channels)
    return category


def _bot(categories=None) -> Mock:
    guild = Mock()
    guild.me = Mock(name="bot member")
    guild.categories = (
        categories
        if categories is not None
        else [
            _category("운영진 전용", [_voice(1, "회의실")]),
            _category(ANCHOR),
            _category("알고리즘 스터디", [_voice(2, "공부방-알고리즘"), _voice(3, "공부방-2조")]),
        ]
    )
    bot = Mock()
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    return bot


@pytest.fixture
def log(tmp_path) -> VoiceActivityLog:
    return VoiceActivityLog(str(tmp_path / "discord.sqlite3"))


# --- may_check -------------------------------------------------------------


def test_may_check_allows_a_captain():
    assert voice_monitor_cmd.may_check(_ctx(), _settings()) is True


def test_may_check_refuses_a_member_without_the_captain_role():
    """Which studies look dead is for whoever runs the guild to act on."""
    assert voice_monitor_cmd.may_check(_ctx(roles=()), _settings()) is False


def test_may_check_refuses_when_no_captain_role_is_configured():
    """An unset role shuts the door rather than opening it, as on the API side."""
    assert voice_monitor_cmd.may_check(_ctx(), _settings(captain_role_id=None)) is False


def test_may_check_refuses_in_a_dm():
    assert voice_monitor_cmd.may_check(_ctx(in_guild=False), _settings()) is False


# --- check_voice_channels --------------------------------------------------


async def test_check_voice_channels_prints_one_line_per_room(log):
    ctx = _ctx()
    log.touch(2, NOW - datetime.timedelta(days=40))

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(), _settings(), log)

    ctx.send.assert_awaited_once()
    lines = ctx.send.await_args[0][0].split("\n")
    assert lines[0] == "알고리즘 스터디 - 공부방-알고리즘 : 2026-08-20"
    # Never joined: the room says how long that has been true instead.
    assert lines[1].startswith("알고리즘 스터디 - 공부방-2조 : 기록 없음 (관찰 시작 ")


async def test_check_voice_channels_registers_rooms_it_has_not_seen(log):
    """Reading takes the same snapshot the daily check does, so the two agree."""
    await voice_monitor_cmd.check_voice_channels(_ctx(), _bot(), _settings(), log)

    assert set(log.rows()) == {2, 3}


async def test_check_voice_channels_refuses_a_non_captain_without_reading(log):
    ctx = _ctx(roles=())
    store = Mock()

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(), _settings(), store)

    store.rows.assert_not_called()
    store.observe.assert_not_called()
    ctx.send.assert_awaited_once_with(voice_monitor_cmd.NOT_ALLOWED)


async def test_check_voice_channels_refuses_outside_the_command_channel(log):
    """Commands are answered in one channel only; elsewhere nothing is read."""
    ctx = _ctx(channel_id=999999999999999999)
    store = Mock()

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(), _settings(), store)

    store.rows.assert_not_called()
    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


async def test_check_voice_channels_refuses_when_no_command_channel_is_configured(log):
    """An unset DISCORD_BOT_CHANNEL_ID refuses everywhere rather than allowing anywhere."""
    ctx = _ctx()
    store = Mock()

    await voice_monitor_cmd.check_voice_channels(
        ctx, _bot(), _settings(command_channel_id=None), store
    )

    store.rows.assert_not_called()
    ctx.send.assert_awaited_once_with(command_channel.DISABLED)


async def test_check_voice_channels_says_the_feature_is_off_without_a_guild_id(log):
    ctx = _ctx()

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(), _settings(guild_id=None), log)

    ctx.send.assert_awaited_once_with(voice_monitor_cmd.DISABLED)


async def test_check_voice_channels_reports_an_uncached_guild(log):
    ctx = _ctx()
    bot = Mock()
    bot.get_guild.return_value = None

    await voice_monitor_cmd.check_voice_channels(ctx, bot, _settings(), log)

    ctx.send.assert_awaited_once_with(voice_monitor_cmd.NO_GUILD)


async def test_check_voice_channels_reports_a_missing_anchor(log):
    """A silently empty list would read as "there are no 공부방"."""
    ctx = _ctx()

    await voice_monitor_cmd.check_voice_channels(
        ctx, _bot(categories=[_category("운영진 전용", [_voice(1, "회의실")])]), _settings(), log
    )

    ctx.send.assert_awaited_once_with(voice_monitor_cmd.NO_ANCHOR)
    assert log.rows() == {}


async def test_check_voice_channels_with_no_rooms_below_the_anchor(log):
    ctx = _ctx()

    await voice_monitor_cmd.check_voice_channels(
        ctx, _bot(categories=[_category(ANCHOR)]), _settings(), log
    )

    ctx.send.assert_awaited_once()
    assert ctx.send.await_args[0][0] == voice_monitor.EMPTY_REPORT


async def test_check_voice_channels_splits_a_long_list_over_several_messages(log):
    ctx = _ctx()
    categories = [_category(ANCHOR)] + [
        _category(f"스터디 {i:03d}", [_voice(100 + i, f"공부방-{i:03d}")]) for i in range(200)
    ]

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(categories=categories), _settings(), log)

    assert ctx.send.await_count > 1
    assert all(len(call[0][0]) <= voice_monitor.MAX_MSG for call in ctx.send.await_args_list)
    # Nobody is notified, not even by a study named @everyone -- in any of the messages.
    assert all(
        call.kwargs["allowed_mentions"].everyone is False for call in ctx.send.await_args_list
    )


async def test_check_voice_channels_reports_a_broken_table(log):
    ctx = _ctx()
    broken = Mock()
    broken.observe.side_effect = sqlite3.OperationalError("disk I/O error")

    await voice_monitor_cmd.check_voice_channels(ctx, _bot(), _settings(), broken)

    ctx.send.assert_awaited_once_with(voice_monitor_cmd.FAILED)


# --- registration ----------------------------------------------------------


async def test_register_adds_the_command_under_its_camel_case_name():
    """The prefix command is ``!checkVoiceChannels``, matching updateBulletin's style."""
    from discord.ext import commands

    bot = commands.Bot(command_prefix="!", intents=discord.Intents.default())
    voice_monitor_cmd.register(bot, _settings())

    assert bot.get_command("checkVoiceChannels") is not None
