"""The ``checkVoiceChannels`` command: print every 공부방's last activity date.

The daily check only speaks up when something has gone quiet for three weeks, so
this is how anyone sees the whole picture -- including the rooms that are one day
short of being reported.

The work is done by a plain coroutine so it can be unit tested without a Discord
connection; ``register`` only wires it into the bot.
"""

from __future__ import annotations

import logging
import sqlite3

from discord.ext import commands

from app.api.routes.studies import DEFAULT_NEW_STUDY_ANCHOR_NAME
from app.bot import voice_monitor
from app.bot.commands import command_channel
from app.config import Settings
from app.voice_activity_log import VoiceActivityLog

logger = logging.getLogger(__name__)

NOT_ALLOWED = "이 명령은 captain 역할을 가진 멤버만 쓸 수 있습니다."
DISABLED = "DISCORD_GUILD_ID 가 설정되지 않아 공부방 활동 감시 기능이 꺼져 있습니다."
NO_GUILD = "봇이 길드를 찾지 못했습니다. 로그를 확인해 주세요."
NO_ANCHOR = (
    f"기준 카테고리 `{DEFAULT_NEW_STUDY_ANCHOR_NAME}` 를 찾지 못해 공부방 목록을 만들 수 "
    "없습니다. 카테고리가 지워졌거나 이름이 바뀌었는지 확인해 주세요."
)
FAILED = "공부방 활동 기록을 읽지 못했습니다. 로그를 확인해 주세요."


def may_check(ctx: commands.Context, settings: Settings) -> bool:
    """Whether ``ctx.author`` may print the list: a captain, inside the guild.

    Captain only, like every other command this bot has. The list says which
    studies look dead, which is for whoever runs the guild to act on rather than
    something to drop into any channel on request.

    An unset ``DISCORD_CAPTAIN_ROLE_ID`` shuts the door rather than opening it,
    the same way ``caller_guild`` treats it on the API side. In a DM there is no
    member and no role, so there is nobody to check.
    """
    if ctx.guild is None or settings.captain_role_id is None:
        return False
    return ctx.author.get_role(settings.captain_role_id) is not None


async def check_voice_channels(
    ctx: commands.Context, bot: commands.Bot, settings: Settings, log: VoiceActivityLog
) -> None:
    """Reply with ``카테고리 - 공부방 : 날짜`` for every study voice channel.

    The guild comes from the configuration rather than from ``ctx``, so the
    answer is always about the guild being monitored.

    Reading takes today's snapshot first, exactly as the daily check does: a
    channel nobody has ever joined gets its row (and so a ``관찰 시작`` date to
    print), and a room someone is sitting in right now is credited, so the list
    and the alert can never disagree about it.

    The channel gate comes before the role check so a refusal never says who is
    and is not a captain outside the command channel.
    """
    if not await command_channel.check(ctx, settings):
        return
    if not may_check(ctx, settings):
        logger.info("checkVoiceChannels: refused for user %s", ctx.author.id)
        await ctx.send(NOT_ALLOWED)
        return
    if settings.guild_id is None:
        await ctx.send(DISABLED)
        return
    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        logger.error("checkVoiceChannels: guild %s not found by the bot", settings.guild_id)
        await ctx.send(NO_GUILD)
        return

    logger.info("checkVoiceChannels: requested by user %s", ctx.author.id)
    categories = voice_monitor.collect_study_voice_channels(guild, DEFAULT_NEW_STUDY_ANCHOR_NAME)
    if categories is None:
        logger.error(
            "checkVoiceChannels: reference category %r not found",
            DEFAULT_NEW_STUDY_ANCHOR_NAME,
        )
        await ctx.send(NO_ANCHOR)
        return

    now = voice_monitor.now_utc()
    try:
        voice_monitor.record_snapshot(
            log, [voice for _, voices in categories for voice in voices], now
        )
        rows = log.rows()
    except sqlite3.Error:
        logger.exception("checkVoiceChannels: could not read the activity table")
        await ctx.send(FAILED)
        return

    # Several messages when the list is long: this is the full picture the caller
    # asked for, so it is split rather than cut.
    for message in voice_monitor.build_activity_report(voice_monitor.build_entries(categories, rows)):
        await ctx.send(message)


def register(bot: commands.Bot, settings: Settings) -> None:
    """Attach the ``checkVoiceChannels`` command to ``bot``.

    Its own ``VoiceActivityLog`` rather than the monitor's: the class holds a
    path and opens a connection per call, so a second one is the same table.
    """
    log = VoiceActivityLog(settings.db_path)

    @bot.command(
        name="checkVoiceChannels",
        help="공부방마다 마지막으로 사람이 있었던 날짜를 보여줍니다. captain 전용.\n"
        "3주 넘게 조용한 공부방은 봇이 알아서 알려주니, 이건 전체를 한눈에 볼 때 씁니다.",
    )
    async def check_voice_channels_command(
        ctx: commands.Context,
    ) -> None:  # pragma: no cover - thin wrapper
        await check_voice_channels(ctx, bot, settings, log)
