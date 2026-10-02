"""The voice-channel bulletin board.

One message in ``DISCORD_BULLETIN_CHANNEL_ID`` lists every study's voice
channels as clickable links, so a member reaches their 공부방 without scrolling
the sidebar. The message is rewritten in place once a
day at 20:00 America/Los_Angeles, and on demand via ``!updateBulletin``.

Plan and decisions: docs/discord-development-guide/voice-channel-bulletin.md.

Nothing here raises. A refresh runs in the background with no caller waiting on
it, so a failure logs, tells the alert channel, and leaves the board as it was:
yesterday's list is worse than today's but better than no list at all.
"""

from __future__ import annotations

import datetime
import logging
from zoneinfo import ZoneInfo

import discord
from discord.ext import commands, tasks
from fastapi import HTTPException

from app.api.routes.channels import resolve_configured_channel
from app.api.routes.studies import DEFAULT_NEW_STUDY_ANCHOR_NAME
from app.config import Settings

logger = logging.getLogger(__name__)

# 20:00 America/Los_Angeles, daily. A wall-clock time, not an interval:
# ``tasks.loop(hours=24)`` would count from whenever the bot started, so every
# deploy would move the schedule and "8PM" would stop meaning anything.
# discord.py recomputes the next occurrence each time, so the PST/PDT switch
# takes care of itself -- 20:00 local either way, which is what was asked for.
BULLETIN_TIME = datetime.time(hour=20, tzinfo=ZoneInfo("America/Los_Angeles"))

# Discord's hard cap on a message.
MAX_MSG = 2000
# Posted instead of an empty message, which Discord refuses. Leaving yesterday's
# list up instead would have people clicking rooms that are gone.
EMPTY_BULLETIN = "지금 열린 공부방이 없습니다."
TRUNCATED_NOTICE = "…외 {count}개 스터디는 사이드바에서 확인해 주세요."
# The channel holds one message, so the bot's own is within the first few even
# after a moderator posts. Reading further costs another API call per 100.
HISTORY_LIMIT = 50


def build_bulletin(categories: list[tuple[str, list[int]]]) -> tuple[str, int]:
    """Render ``(category name, voice channel ids)`` pairs as the board's text.

    Returns the text and how many studies did not fit. ``<#id>`` is a channel
    mention: Discord renders the channel's current name, so a renamed room does
    not leave a stale label on the board.

    A category with no voice channel gets no line -- a line with nothing to
    click only makes the board longer.
    """
    lines = [
        f"{name} : " + " - ".join(f"<#{channel_id}>" for channel_id in voice_ids)
        for name, voice_ids in categories
        if voice_ids
    ]
    if not lines:
        return EMPTY_BULLETIN, 0

    content = "\n".join(lines)
    if len(content) <= MAX_MSG:
        return content, 0

    # Over the cap. Whole lines are kept and the rest are counted in a closing
    # notice -- cutting mid-line would leave a broken link, which is worse than
    # a missing one. The notice's own length is reserved up front using the
    # widest count the list could produce, since the real count is not known
    # until we stop adding.
    reserve = len(TRUNCATED_NOTICE.format(count=len(lines))) + 1
    kept: list[str] = []
    length = 0
    for line in lines:
        added = len(line) + (1 if kept else 0)
        if length + added > MAX_MSG - reserve:
            break
        kept.append(line)
        length += added

    omitted = len(lines) - len(kept)
    return "\n".join(kept + [TRUNCATED_NOTICE.format(count=omitted)]), omitted


def collect_categories(
    guild: discord.Guild, anchor_name: str
) -> list[tuple[str, list[int]]] | None:
    """List the studies below the anchor category, or ``None`` if it is gone.

    Everything under the anchor is a study: ``create_study`` puts each new
    category directly below it, and nothing else is placed there. Returning
    ``None`` rather than the whole guild matters -- without the anchor there is
    no telling a study from an operational category, and the caller would put
    staff channels on a board every member reads.

    ``guild.categories`` is sorted by position and is rebuilt on each access, so
    it is read once. A duplicated anchor name resolves to the topmost, which is
    the one ``create_study`` anchors to.
    """
    categories = guild.categories
    anchor = discord.utils.get(categories, name=anchor_name)
    if anchor is None:
        return None

    return [
        (
            category.name,
            # A channel the bot cannot see renders as a broken link, so it is
            # left off -- the same filter get_study_channels applies.
            [
                voice.id
                for voice in category.voice_channels
                if voice.permissions_for(guild.me).view_channel
            ],
        )
        for category in categories[categories.index(anchor) + 1 :]
    ]


async def notify_alert_channel(guild: discord.Guild, settings: Settings, text: str) -> None:
    """Tell the alert channel that the bulletin needs a human. Never raises.

    The caller has already logged; this is what reaches someone who is not
    reading logs. A failure to notify may not become a failure of the refresh,
    so everything is swallowed -- a connection error arrives as ``OSError``, not
    ``discord.HTTPException``. ``CancelledError`` is a ``BaseException`` and
    still propagates.
    """
    try:
        alert_channel, _ = resolve_configured_channel(guild, settings.alert_channel_id, "alert")
        await alert_channel.send(text, allowed_mentions=discord.AllowedMentions.none())
    except Exception as exc:
        logger.exception("bulletin: could not warn the alert channel: %s", exc)


async def find_own_message(bot: commands.Bot, channel: discord.TextChannel) -> discord.Message | None:
    """Return the oldest message the bot posted in ``channel``, or ``None``.

    The message ID is looked up rather than stored: the channel holds one
    message, so finding it is a single API call, and a stored ID rots the moment
    someone deletes the message or the volume is replaced. This needs Read
    Message History -- without it Discord answers with an empty history rather
    than an error, so the caller checks the permission first; otherwise the bot
    would find nothing and post a second message every refresh.

    More than one of the bot's messages is already an unexpected state, so the
    oldest is edited and the rest are left alone: deleting cannot be undone, and
    whoever put them there should see them.
    """
    own = [
        message
        async for message in channel.history(limit=HISTORY_LIMIT, oldest_first=True)
        if message.author.id == bot.user.id
    ]
    if len(own) > 1:
        logger.warning(
            "bulletin: channel %s holds %d messages from the bot; editing the oldest (%s) "
            "and leaving the rest for a human",
            channel.id,
            len(own),
            own[0].id,
        )
    return own[0] if own else None


async def report_missing_permissions(
    guild: discord.Guild, settings: Settings, channel: discord.TextChannel, detail: object
) -> None:
    """Log and tell the alert channel that the bot may not write the board. Never raises."""
    logger.error(
        "bulletin: the bot lacks permissions in channel %s -- it needs View Channel, "
        "Send Messages, and Read Message History there: %s",
        channel.id,
        detail,
    )
    await notify_alert_channel(
        guild,
        settings,
        f"봇에게 <#{channel.id}> 채널의 권한이 없어 공부방 게시판을 갱신하지 못했습니다. "
        "`View Channel` · `Send Messages` · `Read Message History` 를 확인해 주세요.",
    )


async def refresh(bot: commands.Bot, settings: Settings) -> bool:
    """Rewrite the bulletin message and report whether it was rewritten. Never raises.

    ``False`` means the board is untouched and the reason has been logged and
    sent to the alert channel; it is what ``!updateBulletin`` answers with. A
    board that went up truncated is still ``True`` -- it was rewritten, and the
    alert channel hears about what did not fit.

    The anchor name is read from the constant rather than from
    ``app.state.new_study_anchor_name``: the two are always equal today, and the
    command that will change the anchor at runtime has to give both readers one
    source when it lands (see the plan's 미정 사항 2).
    """
    if settings.guild_id is None:
        logger.error("bulletin: no DISCORD_GUILD_ID configured, skipping the refresh")
        return False
    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        # No guild means no alert channel to complain to either.
        logger.error("bulletin: guild %s not found by the bot, skipping the refresh", settings.guild_id)
        return False

    try:
        channel, permissions = resolve_configured_channel(
            guild, settings.bulletin_channel_id, "bulletin"
        )
    except HTTPException as exc:
        # resolve_configured_channel answers API callers, so it reports a broken
        # channel setting as an HTTP error. The wording is what we would write
        # here anyway, so it is reused rather than duplicated.
        logger.error("bulletin: %s", exc.detail)
        await notify_alert_channel(
            guild, settings, f"공부방 게시판을 갱신할 수 없습니다: {exc.detail}"
        )
        return False

    categories = collect_categories(guild, DEFAULT_NEW_STUDY_ANCHOR_NAME)
    if categories is None:
        logger.error(
            "bulletin: reference category %r not found, leaving the board untouched",
            DEFAULT_NEW_STUDY_ANCHOR_NAME,
        )
        await notify_alert_channel(
            guild,
            settings,
            f"기준 카테고리 `{DEFAULT_NEW_STUDY_ANCHOR_NAME}` 를 찾지 못해 "
            "공부방 게시판을 갱신하지 않았습니다. 카테고리가 지워졌거나 이름이 바뀌었는지 확인해 주세요.",
        )
        return False

    content, omitted = build_bulletin(categories)

    # Checked rather than left to the search: Discord answers a history request
    # without this permission with an empty list, not a 403, so the board would
    # look absent and a new message would be posted on every refresh.
    if not permissions.read_message_history:
        await report_missing_permissions(
            guild, settings, channel, "Read Message History is denied"
        )
        return False

    # The bot writes every character here, so there is no mass mention to strip
    # -- but a category named @everyone would ring the guild, and a board nobody
    # is notified by is the whole point.
    try:
        message = await find_own_message(bot, channel)
        if message is None:
            await channel.send(content, allowed_mentions=discord.AllowedMentions.none())
        else:
            await message.edit(content=content, allowed_mentions=discord.AllowedMentions.none())
    except discord.Forbidden as exc:
        await report_missing_permissions(guild, settings, channel, exc)
        return False
    except discord.HTTPException as exc:
        logger.error("bulletin: discord rejected the update of channel %s: %s", channel.id, exc)
        await notify_alert_channel(
            guild, settings, f"공부방 게시판 갱신이 Discord 에서 거부됐습니다: {exc}"
        )
        return False

    logger.info(
        "bulletin: channel %s updated with %d of %d studies",
        channel.id,
        sum(1 for _, voice_ids in categories if voice_ids) - omitted,
        sum(1 for _, voice_ids in categories if voice_ids),
    )
    if omitted:
        logger.warning(
            "bulletin: %d studies did not fit in %d characters and were left off", omitted, MAX_MSG
        )
        await notify_alert_channel(
            guild,
            settings,
            f"공부방 게시판이 Discord 메시지 한도({MAX_MSG}자)를 넘어 스터디 {omitted}개가 "
            "목록에서 빠졌습니다.",
        )
    return True


def register(bot: commands.Bot, settings: Settings) -> tasks.Loop | None:
    """Build the refresh loop, or return ``None`` if there is no board to write.

    The loop is started from ``setup_hook``, which runs after the bot has logged
    in. Not here: ``create_bot`` is called before ``bot.start``, and the loop's
    first act is ``wait_until_ready``, which *raises* on a client that has not
    logged in yet -- that kills the loop for the life of the process, so the
    board would silently never update. Not ``on_ready`` either: that fires again
    on every reconnect and would start the loop twice.

    The loop is returned so a caller can inspect or cancel it; nothing in the app
    does, but its schedule is what the tests check. ``!updateBulletin`` does not
    go through the loop -- it calls :func:`refresh` directly.
    """
    if settings.bulletin_channel_id is None:
        logger.warning(
            "DISCORD_BULLETIN_CHANNEL_ID is not set - the voice channel bulletin is disabled"
        )
        return None

    @tasks.loop(time=BULLETIN_TIME)
    async def refresh_bulletin() -> None:  # pragma: no cover - thin wrapper
        await refresh(bot, settings)

    @refresh_bulletin.before_loop
    async def prime_the_board() -> None:  # pragma: no cover - thin wrapper
        # Before ready the guild cache is empty, so there would be nothing to list.
        await bot.wait_until_ready()
        # A time-based loop sleeps until its next occurrence, so without this a
        # deploy would leave the previous day's board up until 20:00.
        await refresh(bot, settings)

    # Chained rather than replaced: assigning over an existing setup_hook would
    # silently drop whatever it did.
    previous_setup_hook = bot.setup_hook

    async def setup_hook() -> None:
        await previous_setup_hook()
        refresh_bulletin.start()

    bot.setup_hook = setup_hook
    return refresh_bulletin
