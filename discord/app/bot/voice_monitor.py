"""The voice-channel activity monitor.

Every join and leave in the guild's voice channels is written down as a date, and
once a day the studies below the anchor category are checked: a 공부방 nobody has
joined or left for three weeks is reported to the alert channel, once per quiet
streak. ``!checkVoiceChannels`` prints the whole list on demand.

Plan and decisions: docs/discord-development-guide/voice-channel-activity-monitor.md.

Nothing here raises. The listeners run with nobody waiting on them, and the daily
check is a background loop, so a failure logs and leaves the next run to try
again -- a monitor that takes the bot down with it is worse than a missed report.
"""

from __future__ import annotations

import datetime
import logging
import sqlite3
from zoneinfo import ZoneInfo

import discord
from discord.ext import commands, tasks
from fastapi import HTTPException

from app.api.routes.channels import resolve_configured_channel
from app.api.routes.studies import DEFAULT_NEW_STUDY_ANCHOR_NAME
from app.config import Settings
from app.voice_activity_log import Activity, VoiceActivityLog

logger = logging.getLogger(__name__)

# How long a 공부방 may stay silent before it is reported. Three weeks rather
# than four: a month of silence means the study has already scattered.
INACTIVITY = datetime.timedelta(weeks=3)
# 20:00 America/Los_Angeles, daily -- the same wall-clock moment as the bulletin
# refresh, but its own constant: the two schedules are unrelated, and sharing one
# would move both when either is retimed. A wall-clock time, not an interval, so
# a deploy cannot drift it (see the bulletin plan for why).
CHECK_TIME = datetime.time(hour=20, tzinfo=ZoneInfo("America/Los_Angeles"))
# Dates are shown in the club's own timezone. In UTC an evening session would be
# dated the next day.
DISPLAY_TZ = ZoneInfo("America/Los_Angeles")

# Discord's hard cap on a message.
MAX_MSG = 2000
# A channel we have never seen anyone use. The date says how long that has been
# true, so an empty value cannot be read as "ancient".
NO_RECORD = "기록 없음 (관찰 시작 {date})"
# Posted instead of an empty message, which Discord refuses.
EMPTY_REPORT = "지금 앵커 아래에 공부방이 없습니다."
ALERT_HEADER = (
    "{weeks}주({days}일) 이상 입·퇴장이 없는 공부방이 {count}개 있습니다. (기준일: {today})"
)
TRUNCATED_NOTICE = "…외 {count}개는 !checkVoiceChannels 로 확인해 주세요."


def now_utc() -> datetime.datetime:
    """The clock the table is written with, kept in one place for the tests."""
    return datetime.datetime.now(datetime.timezone.utc)


def collect_study_voice_channels(
    guild: discord.Guild, anchor_name: str
) -> list[tuple[discord.CategoryChannel, list[discord.VoiceChannel]]] | None:
    """List the studies below the anchor category, or ``None`` if it is gone.

    The rule is the bulletin's, letter for letter -- ``guild.categories`` is
    sorted by position, a duplicated anchor name resolves to the topmost, the
    anchor itself is excluded, and a channel the bot cannot see is left out.
    Only the return type differs: the report prints names, so it needs the
    channel objects rather than their IDs.

    **This duplicates app.bot.bulletin.collect_categories on purpose** (plan
    decision 6). If the rule for "what sits below the anchor" ever changes, both
    functions have to change, or the board and the monitor will quietly disagree
    about which categories are studies.

    ``None`` rather than the whole guild matters for the same reason it does
    there: without the anchor there is no telling a study from an operational
    category, and reporting the staff meeting room as a dead study is a mistake
    nobody can undo by hand.
    """
    categories = guild.categories
    anchor = discord.utils.get(categories, name=anchor_name)
    if anchor is None:
        return None

    return [
        (
            category,
            [
                voice
                for voice in category.voice_channels
                if voice.permissions_for(guild.me).view_channel
            ],
        )
        for category in categories[categories.index(anchor) + 1 :]
    ]


def format_date(moment: datetime.datetime) -> str:
    """Render a stored timestamp as the club's local ``yyyy-mm-dd``."""
    return moment.astimezone(DISPLAY_TZ).strftime("%Y-%m-%d")


def activity_label(row: Activity) -> str:
    """The date column: the last join or leave, or how long we have been watching."""
    if row.last_activity_at is None:
        return NO_RECORD.format(date=format_date(row.first_seen_at))
    return format_date(row.last_activity_at)


def inactive_channel_ids(
    rows: dict[int, Activity], channel_ids: list[int], now: datetime.datetime
) -> set[int]:
    """Which of ``channel_ids`` have been silent for :data:`INACTIVITY` unreported.

    A channel with no activity yet is measured from ``first_seen_at``, so a 공부방
    created yesterday is not reported today.

    Already-alerted channels are skipped rather than re-reported: a list that
    arrives every single day is a list nobody reads. ``touch`` clears the mark,
    so the next quiet streak is reported again.
    """
    stale = set()
    for channel_id in channel_ids:
        row = rows[channel_id]
        if row.last_alerted_at is not None:
            continue
        if now - (row.last_activity_at or row.first_seen_at) >= INACTIVITY:
            stale.add(channel_id)
    return stale


def build_entries(
    categories: list[tuple[discord.CategoryChannel, list[discord.VoiceChannel]]],
    rows: dict[int, Activity],
    only: set[int] | None = None,
) -> list[tuple[str, str, str]]:
    """``(category name, channel name, date column)`` in sidebar order.

    ``only`` keeps the alert to the channels being reported; the report passes
    nothing and lists everything. Every channel is in ``rows`` because
    :func:`record_snapshot` ran first on this same snapshot.
    """
    return [
        (category.name, voice.name, activity_label(rows[voice.id]))
        for category, voices in categories
        for voice in voices
        if only is None or voice.id in only
    ]


def format_line(entry: tuple[str, str, str]) -> str:
    """``카테고리 - 공부방 : 날짜``.

    Two separators, not one: study voice channels are named ``공부방-{스터디명}``,
    so with ``-`` between all three columns there is no telling where the channel
    name ends. ``:`` carries the names/value boundary and ``-`` stays between
    the names.
    """
    category, channel, label = entry
    return f"{category} - {channel} : {label}"


def build_activity_report(entries: list[tuple[str, str, str]]) -> list[str]:
    """Render every channel as one or more messages within Discord's cap.

    Split rather than truncated: this is what the caller asked to see in full,
    so cutting it defeats the command. The alert is the other way round -- it is
    a signal, and a shortened signal still signals.

    A single line cannot exceed the cap on its own: Discord caps a category and
    a channel name at 100 characters each.
    """
    if not entries:
        return [EMPTY_REPORT]

    messages: list[str] = []
    current: list[str] = []
    length = 0
    for line in map(format_line, entries):
        if current and length + len(line) + 1 > MAX_MSG:
            messages.append("\n".join(current))
            current, length = [line], len(line)
        else:
            length += len(line) + (1 if current else 0)
            current.append(line)
    messages.append("\n".join(current))
    return messages


def build_inactivity_alert(entries: list[tuple[str, str, str]], today: str) -> str:
    """Render the daily alert, or ``""`` when there is nothing to report.

    Over the cap, whole lines are kept and the rest are counted in a closing
    notice -- the command prints the full list anyway. The notice's own length is
    reserved up front using the widest count the list could produce, since the
    real count is not known until we stop adding.
    """
    if not entries:
        return ""

    header = ALERT_HEADER.format(
        # Both numbers come from INACTIVITY so the sentence cannot go stale. A
        # threshold that is not whole weeks would need this reworded.
        weeks=INACTIVITY.days // 7,
        days=INACTIVITY.days,
        count=len(entries),
        today=today,
    )
    lines = [format_line(entry) for entry in entries]
    content = "\n".join([header, *lines])
    if len(content) <= MAX_MSG:
        return content

    reserve = len(TRUNCATED_NOTICE.format(count=len(lines))) + 1
    kept: list[str] = []
    length = len(header)
    for line in lines:
        if length + len(line) + 1 > MAX_MSG - reserve:
            break
        kept.append(line)
        length += len(line) + 1

    return "\n".join(
        [header, *kept, TRUNCATED_NOTICE.format(count=len(lines) - len(kept))]
    )


async def record_activity(
    log: VoiceActivityLog,
    settings: Settings,
    member: discord.Member,
    before: discord.VoiceState,
    after: discord.VoiceState,
) -> None:
    """Write down a join or a leave. Never raises.

    ``on_voice_state_update`` also fires for mute, deafen, camera and screen
    share, which are not what was asked for, so an event that does not change
    the channel is dropped. Moving between rooms changes both, and both count:
    leaving is activity too.

    Bots are ignored: a music bot parked in a room does not make it used.
    """
    if member.bot or member.guild.id != settings.guild_id:
        return
    if before.channel == after.channel:
        return

    now = now_utc()
    try:
        for channel in (before.channel, after.channel):
            if channel is not None:
                log.touch(channel.id, now)
    except sqlite3.Error:
        # One lost join or leave is not worth a traceback per member, but it is
        # worth knowing the table has stopped taking writes.
        logger.exception(
            "voice monitor: could not record activity for member %s in guild %s",
            member.id,
            member.guild.id,
        )


async def forget_channel(
    log: VoiceActivityLog, settings: Settings, channel: discord.abc.GuildChannel
) -> None:
    """Drop a deleted voice channel's row, so the table follows the guild. Never raises.

    Only voice channels have rows. Deleting a category does not reach here for
    its children -- Discord moves them out instead of deleting them, and they
    then sit below no category and fall out of the report by themselves.

    A channel deleted while the bot is offline keeps its row forever. That is
    harmless: the report walks the guild, so the row is never read again, and a
    room recreated under the same name gets a new ID and a new row.
    """
    if not isinstance(channel, discord.VoiceChannel) or channel.guild.id != settings.guild_id:
        return
    try:
        log.forget(channel.id)
    except sqlite3.Error:
        # A row we failed to delete is never read again, so this is untidiness,
        # not a wrong report.
        logger.exception("voice monitor: could not forget deleted channel %s", channel.id)


def record_snapshot(
    log: VoiceActivityLog,
    voice_channels: list[discord.VoiceChannel],
    now: datetime.datetime,
) -> None:
    """Register channels we have not seen, and credit the ones in use right now.

    Occupied rooms are credited because the gateway only reports changes: someone
    who joined a month ago and never left produced one event, so a room in
    constant use would otherwise look abandoned. ``channel.voice_states`` is used
    rather than ``channel.members`` -- the latter goes through the member cache,
    which is empty without the members intent, and would show every room as
    empty.
    """
    log.observe([voice.id for voice in voice_channels], now)
    for voice in voice_channels:
        if voice.voice_states:
            log.touch(voice.id, now)


async def send_to_alert(channel: discord.TextChannel, content: str) -> bool:
    """Post to the alert channel, reporting whether it went. Never raises.

    ``AllowedMentions.none()`` is not belt-and-braces here: the text is built
    from category and channel names, so a study named ``@everyone`` would ring
    the whole guild.
    """
    try:
        await channel.send(content, allowed_mentions=discord.AllowedMentions.none())
    except discord.Forbidden as exc:
        logger.error(
            "voice monitor: the bot cannot post in alert channel %s, "
            "check its Send Messages permission: %s",
            channel.id,
            exc,
        )
        return False
    except discord.HTTPException as exc:
        logger.error("voice monitor: discord rejected the alert in channel %s: %s", channel.id, exc)
        return False
    return True


async def check_inactivity(
    bot: commands.Bot, settings: Settings, log: VoiceActivityLog
) -> None:
    """Record today's snapshot, then report the rooms that have gone quiet. Never raises.

    The snapshot is taken before anything is judged, so a room someone is sitting
    in right now cannot be reported as silent.

    Only the report needs the alert channel. With the channel unset or broken
    the snapshot is still taken: joins and leaves only give a row to a room
    somebody uses, so a room nobody enters would otherwise be first seen on the
    day the channel is fixed and wait three weeks from then.

    The anchor name is read from the constant rather than from
    ``app.state.new_study_anchor_name``, as the bulletin does and for the same
    reason: the two are always equal today, and the command that will change the
    anchor at runtime has to give both readers one source when it lands.
    """
    try:
        await _check_inactivity(bot, settings, log)
    except Exception:
        # Whatever the paths below did not expect -- a dropped connection arrives
        # as ``OSError``, not ``discord.HTTPException``. It has to stop here: the
        # check in ``before_loop`` runs outside the loop's own retry, so an
        # exception there ends the loop for the life of the process, unlogged.
        logger.exception("voice monitor: the check failed unexpectedly, tomorrow's will try again")


async def _check_inactivity(
    bot: commands.Bot, settings: Settings, log: VoiceActivityLog
) -> None:
    """:func:`check_inactivity` without the catch-all. Handles the failures it expects."""
    if settings.guild_id is None:
        logger.error("voice monitor: no DISCORD_GUILD_ID configured, skipping the check")
        return
    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        # No guild means no alert channel to complain to either.
        logger.error("voice monitor: guild %s not found by the bot, skipping the check", settings.guild_id)
        return

    # An unset channel is not logged here: ``register`` warned about it once,
    # and this runs every day.
    alert_channel = None
    if settings.alert_channel_id is not None:
        try:
            alert_channel, _ = resolve_configured_channel(guild, settings.alert_channel_id, "alert")
        except HTTPException as exc:
            # resolve_configured_channel answers API callers, so it reports a broken
            # channel setting as an HTTP error. The wording is what we would write
            # here anyway, so it is reused rather than duplicated.
            logger.error("voice monitor: %s", exc.detail)

    categories = collect_study_voice_channels(guild, DEFAULT_NEW_STUDY_ANCHOR_NAME)
    if categories is None:
        logger.error(
            "voice monitor: reference category %r not found, judging nothing",
            DEFAULT_NEW_STUDY_ANCHOR_NAME,
        )
        if alert_channel is not None:
            await send_to_alert(
                alert_channel,
                f"기준 카테고리 `{DEFAULT_NEW_STUDY_ANCHOR_NAME}` 를 찾지 못해 공부방 활동을 "
                "점검하지 않았습니다. 카테고리가 지워졌거나 이름이 바뀌었는지 확인해 주세요.",
            )
        return

    voice_channels = [voice for _, voices in categories for voice in voices]
    now = now_utc()
    try:
        record_snapshot(log, voice_channels, now)
        rows = log.rows()
    except sqlite3.Error:
        logger.exception("voice monitor: could not read the activity table, skipping the check")
        return

    if alert_channel is None:
        # Recorded, with nowhere to report. Nothing is marked, so the rooms
        # already quiet are reported on the first check that has a channel.
        return

    stale =inactive_channel_ids(rows, [voice.id for voice in voice_channels], now)
    if not stale:
        logger.info(
            "voice monitor: %d voice channels checked, none quiet for %d days",
            len(voice_channels),
            INACTIVITY.days,
        )
        return

    content = build_inactivity_alert(build_entries(categories, rows, only=stale), format_date(now))
    if not await send_to_alert(alert_channel, content):
        # Unmarked, so tomorrow's check reports them again.
        return

    logger.info("voice monitor: reported %d quiet voice channels", len(stale))
    try:
        log.mark_alerted(stale, now)
    except sqlite3.Error:
        # The alert is already out; failing to mark it only means it repeats.
        logger.exception("voice monitor: could not mark %d channels as alerted", len(stale))


def register(bot: commands.Bot, settings: Settings) -> tasks.Loop | None:
    """Start recording activity and build the daily check loop.

    Recording and reporting are enabled separately on purpose. Without an alert
    channel there is nowhere to send the report, but the table must still fill:
    switching the channel on later would otherwise mean waiting three weeks
    before anything could be said. So the loop runs either way, and
    ``check_inactivity`` skips only the report.

    The loop is started from ``setup_hook``, which runs after the bot has logged
    in. Not here: ``create_bot`` is called before ``bot.start``, and the loop's
    first act is ``wait_until_ready``, which *raises* on a client that has not
    logged in yet -- that kills the loop for the life of the process. Not
    ``on_ready`` either: that fires again on every reconnect and would start the
    loop twice.
    """
    if settings.guild_id is None:
        logger.warning(
            "DISCORD_GUILD_ID is not set - voice channel activity is not being recorded"
        )
        return None

    log = VoiceActivityLog(settings.db_path)

    async def on_voice_state_update(
        member: discord.Member, before: discord.VoiceState, after: discord.VoiceState
    ) -> None:  # pragma: no cover - thin wrapper
        await record_activity(log, settings, member, before, after)

    async def on_guild_channel_delete(
        channel: discord.abc.GuildChannel,
    ) -> None:  # pragma: no cover - thin wrapper
        await forget_channel(log, settings, channel)

    bot.add_listener(on_voice_state_update, "on_voice_state_update")
    bot.add_listener(on_guild_channel_delete, "on_guild_channel_delete")

    if settings.alert_channel_id is None:
        logger.warning(
            "DISCORD_ALERT_CHANNEL_ID is not set - voice channel activity is recorded "
            "but never reported"
        )

    @tasks.loop(time=CHECK_TIME)
    async def check() -> None:  # pragma: no cover - thin wrapper
        await check_inactivity(bot, settings, log)

    @check.before_loop
    async def prime_the_table() -> None:  # pragma: no cover - thin wrapper
        # Before ready the guild cache is empty, so there would be no channels
        # to register.
        await bot.wait_until_ready()
        # A time-based loop sleeps until its next occurrence. Without this, a
        # restart would leave new channels unwatched until 20:00 -- and the
        # rooms occupied right now uncredited.
        await check_inactivity(bot, settings, log)

    # Chained rather than replaced: assigning over an existing setup_hook would
    # silently drop whatever it did.
    previous_setup_hook = bot.setup_hook

    async def setup_hook() -> None:
        await previous_setup_hook()
        check.start()

    bot.setup_hook = setup_hook
    return check
