"""The endpoints that post a message to a channel.

Two of them take the channel from configuration, one takes it from the caller.

Contracts: docs/discord-development-guide/api/send-alert-message.md,
send-announcement-message.md, and send-message.md next to them. They differ in
who may call, what goes above the message, and who gets notified.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

import discord
from fastapi import APIRouter, Depends, HTTPException, Path, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.guild import caller_guild
from app.api.headers import discord_user_id, idempotency_key, require_api_key
from app.config import Settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["channels"], dependencies=[Depends(require_api_key)])

# Discord caps a message at 2000 characters and the sender line comes off that
# budget, so the caller's share is what is left with room to spare.
MAX_MSG = 1900
# An announcement carries the @everyone line instead of a sender line, which is
# shorter, so more of the 2000 is left for the caller.
MAX_ANNOUNCEMENT_MSG = 1990
# send-message shares the 2000 between the sender line, the mention line, and
# the message, so it measures the three together instead of capping msg alone.
MAX_TOTAL = 2000
# A mention is at most 23 characters, so 40 of them still leave the message
# over a thousand. More than that is a mailing list, not a study channel.
MAX_MENTIONS = 40
_MASS_MENTIONS = ("@everyone", "@here")


class SendMessageRequest(BaseModel):
    # Stripped before the length check, so a blank message is too short.
    model_config = ConfigDict(str_strip_whitespace=True)

    msg: str = Field(min_length=1, max_length=MAX_MSG)


class SendAnnouncementRequest(BaseModel):
    # Stripped before the length check, so a blank message is too short.
    model_config = ConfigDict(str_strip_whitespace=True)

    msg: str = Field(min_length=1, max_length=MAX_ANNOUNCEMENT_MSG)


def strip_mass_mentions(msg: str) -> str:
    """Remove every ``@everyone`` and ``@here``, including the ones removal creates.

    Closing the gap can spell a new one -- ``@every@hereone`` becomes
    ``@everyone`` after one pass -- so this repeats until the text stops
    changing, which it must, since every pass that changes it shortens it.
    """
    while True:
        stripped = msg
        for mention in _MASS_MENTIONS:
            stripped = stripped.replace(mention, "")
        if stripped == msg:
            return msg
        msg = stripped


def resolve_configured_channel(
    guild: discord.Guild, channel_id: int | None, label: str
) -> tuple[discord.TextChannel, discord.Permissions]:
    """Return the configured channel, with the bot's permissions in it.

    The ID is configuration, so everything wrong here -- unset, deleted, hidden
    from the bot, or naming a category or voice channel -- is a server setup
    problem the caller cannot fix, not their mistake. Discord's announcement
    channels are text channels too, so both kinds a message may go to pass.

    The permissions come back with the channel because resolving one costs a
    permission calculation anyway, and a caller that needs more than
    ``view_channel`` would otherwise redo it.
    """
    if channel_id is None:
        raise HTTPException(
            status_code=409, detail=f"no DISCORD_{label.upper()}_CHANNEL_ID configured"
        )

    channel = guild.get_channel(channel_id)
    if channel is None:
        raise HTTPException(
            status_code=404, detail=f"{label} channel {channel_id} not found by the bot"
        )
    permissions = channel.permissions_for(guild.me)
    if not permissions.view_channel:
        raise HTTPException(
            status_code=404, detail=f"{label} channel {channel_id} not found by the bot"
        )
    if not isinstance(channel, discord.TextChannel):
        raise HTTPException(
            status_code=404, detail=f"{label} channel {channel_id} is not a text channel"
        )
    return channel, permissions


@router.post("/channels/alert/msg", status_code=204)
async def send_alert_message(
    request: Request,
    body: SendMessageRequest,
    user_id: int = Depends(discord_user_id),
    key: str = Depends(idempotency_key),
) -> Response:
    """Post the caller's message to ``DISCORD_ALERT_CHANNEL_ID``, prefixed with who sent it.

    Everything is resolved before anything is sent, so a request that fails
    leaves nothing in the channel.
    """
    content = strip_mass_mentions(body.msg).strip()
    if not content:
        raise HTTPException(
            status_code=400, detail="msg is empty once @everyone and @here are removed"
        )

    # Captain only: a navigator never raises an alert by hand -- what would
    # have been theirs is the backend calling as the system.
    guild = await caller_guild(request, user_id, allow_navigator=False, allow_system=True)

    channel_id = request.app.state.settings.alert_channel_id
    channel, _ = resolve_configured_channel(guild, channel_id, "alert")

    # The sender line carries the ID only: Discord renders the name, so no
    # nickname or email is written into the message.
    # AllowedMentions.none() is the second guard -- stripping controls what the
    # channel shows, this controls whose phone buzzes, including a mass mention
    # that somehow survived above.
    try:
        await channel.send(
            f"발신: <@{user_id}>\n{content}", allowed_mentions=discord.AllowedMentions.none()
        )
    except discord.Forbidden as exc:
        # One fixed channel, so this is every request failing, not a flaky one.
        logger.error(
            "send-alert-message %s: the bot cannot post in alert channel %s, "
            "check its Send Messages permission: %s",
            key,
            channel_id,
            exc,
        )
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc

    logger.info("send-alert-message %s: posted to channel %s", key, channel_id)
    return Response(status_code=204)


async def warn_mention_everyone_missing(
    guild: discord.Guild, settings: Settings, channel_id: int, key: str
) -> None:
    """Tell the alert channel that the announcement just posted rang nobody.

    Discord does not refuse a send without ``Mention Everyone`` -- the message
    goes up with ``@everyone`` as plain text and no one is notified -- so the
    only way anyone learns of it is this notice.

    The announcement is already posted, so nothing here may fail the request.
    A failure returned now would have the caller retry and ring @everyone
    twice, which costs more than a missed notice.
    """
    logger.error(
        "send-announcement-message %s: the bot has no Mention Everyone permission in "
        "announcement channel %s, so the announcement notified nobody",
        key,
        channel_id,
    )
    try:
        alert_channel, _ = resolve_configured_channel(guild, settings.alert_channel_id, "alert")
        # The channel mention renders as a name and notifies nobody, and the
        # @everyone in the text stays text.
        await alert_channel.send(
            f"봇에게 <#{channel_id}> 채널의 `Mention Everyone` 권한이 없어 방금 올린 공지의 "
            "@everyone 알림이 울리지 않았습니다. 채널 권한을 확인해 주세요.",
            allowed_mentions=discord.AllowedMentions.none(),
        )
    except (HTTPException, discord.HTTPException) as exc:
        logger.error(
            "send-announcement-message %s: could not warn the alert channel: %s", key, exc
        )


@router.post("/channels/announcement/msg", status_code=204)
async def send_announcement_message(
    request: Request,
    body: SendAnnouncementRequest,
    user_id: int = Depends(discord_user_id),
    key: str = Depends(idempotency_key),
) -> Response:
    """Post the caller's message to ``DISCORD_ANNOUNCEMENT_CHANNEL_ID`` under an @everyone line.

    An announcement goes out in the organisers' name, not the caller's, so it
    carries no sender line. Everything is resolved before anything is sent, so
    a request that fails leaves nothing in the channel -- which matters more
    here than for an alert, since a stray send rings the whole guild.
    """
    content = strip_mass_mentions(body.msg).strip()
    if not content:
        raise HTTPException(
            status_code=400, detail="msg is empty once @everyone and @here are removed"
        )

    # Captain only: an announcement reaches every member, so a navigator may
    # not send one.
    guild = await caller_guild(
        request, user_id, allow_navigator=False, allow_system=False
    )

    settings = request.app.state.settings
    channel, permissions = resolve_configured_channel(
        guild, settings.announcement_channel_id, "announcement"
    )

    # Allowing everyone makes stripping the only defence: a @here left in msg
    # would ring from here on. The one notification is the line the bot adds.
    try:
        await channel.send(
            f"@everyone\n{content}",
            allowed_mentions=discord.AllowedMentions(everyone=True, users=False, roles=False),
        )
    except discord.Forbidden as exc:
        # One fixed channel, so this is every request failing, not a flaky one.
        logger.error(
            "send-announcement-message %s: the bot cannot post in announcement channel %s, "
            "check its Send Messages permission: %s",
            key,
            channel.id,
            exc,
        )
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc

    logger.info("send-announcement-message %s: posted to channel %s", key, channel.id)
    if not permissions.mention_everyone:
        await warn_mention_everyone_missing(guild, settings, channel.id, key)
    return Response(status_code=204)


class SendChannelMessageRequest(BaseModel):
    # Stripped before the length checks, so a blank message is too short.
    model_config = ConfigDict(str_strip_whitespace=True)

    discordStudyId: Annotated[str, Field(pattern=r"^[0-9]{17,20}$")]
    # No max_length: the cap depends on how many mentions share the 2000
    # characters with the message, so the handler measures the three together.
    msg: str = Field(min_length=1)
    discordUserIds: list[Annotated[str, Field(pattern=r"^[0-9]{17,20}$")]]

    @field_validator("discordUserIds")
    @classmethod
    def unique_and_within_the_limit(cls, ids: list[str]) -> list[str]:
        """Drop duplicates, keeping request order, and refuse too many mentions.

        The limit is counted after deduplication, and going over fails rather
        than mentioning the first 40: silently dropping the rest leaves the
        caller with no way to know who was left out.
        """
        unique = list(dict.fromkeys(ids))
        if len(unique) > MAX_MENTIONS:
            raise ValueError(f"at most {MAX_MENTIONS} users may be mentioned")
        return unique


def resolve_study_channel(
    guild: discord.Guild, channel_id: int, study_id: int
) -> discord.TextChannel:
    """Return the caller's channel, once it is known to sit under their study.

    Unlike the configured channels, these IDs come from the caller, so a
    channel that is not a text channel is their mistake (400) rather than a
    server setup problem. A channel the bot cannot see is a 404 either way.

    The category check is what keeps this endpoint inside study channels: the
    navigator role is guild-wide, so without it a navigator could have the bot
    mention people in any channel, including the operational ones.
    """
    channel = guild.get_channel(channel_id)
    if channel is None or not channel.permissions_for(guild.me).view_channel:
        raise HTTPException(status_code=404, detail=f"channel {channel_id} not found by the bot")
    if not isinstance(channel, discord.TextChannel):
        raise HTTPException(status_code=400, detail=f"channel {channel_id} is not a text channel")

    category = guild.get_channel(study_id)
    if category is None or not category.permissions_for(guild.me).view_channel:
        raise HTTPException(status_code=404, detail=f"category {study_id} not found by the bot")
    if channel.category_id != study_id:
        raise HTTPException(
            status_code=404, detail=f"channel {channel_id} is not in category {study_id}"
        )
    return channel


async def split_mention_targets(
    guild: discord.Guild, user_ids: list[str]
) -> tuple[list[str], list[str]]:
    """Split ``user_ids`` into the guild's members and everyone else, in request order.

    One gateway query covers all of them, rather than an HTTP member lookup
    each: 40 of those in a row would make the request take seconds.
    """
    if not user_ids:
        return [], []
    try:
        members = await guild.query_members(user_ids=[int(uid) for uid in user_ids], limit=100)
    except asyncio.TimeoutError as exc:
        raise HTTPException(status_code=502, detail="discord did not answer the member query") from exc
    found = {str(member.id) for member in members}
    return (
        [uid for uid in user_ids if uid in found],
        [uid for uid in user_ids if uid not in found],
    )


async def warn_unknown_mention_targets(
    guild: discord.Guild,
    settings: Settings,
    channel_id: int,
    missing: list[str],
    key: str,
) -> None:
    """Tell the alert channel who the message that just went up could not mention.

    The message is posted and the caller has their 204, so the only sign that
    someone was left unmentioned is this notice: a stale user ID means the
    backend and the guild disagree about who is here, which is for whoever
    watches the guild to fix, not for the caller.

    The message is already up, so nothing here may fail the request -- a
    failure returned now would have the caller retry and post it twice.

    The IDs go in as code, not mentions: a mention of someone outside the guild
    renders as broken text anyway.
    """
    ids = ", ".join(f"`{uid}`" for uid in missing)
    logger.warning(
        "send-message %s: posted to channel %s, but these mention targets are not "
        "guild members and were left out: %s",
        key,
        channel_id,
        ids,
    )
    try:
        alert_channel, _ = resolve_configured_channel(guild, settings.alert_channel_id, "alert")
        await alert_channel.send(
            f"스터디 채널 메시지 전송(send-message)으로 <#{channel_id}> 에 메시지를 올렸지만, "
            f"길드 멤버가 아니라 멘션하지 못한 유저가 있습니다: {ids}",
            allowed_mentions=discord.AllowedMentions.none(),
        )
    except (HTTPException, discord.HTTPException) as exc:
        logger.error("send-message %s: could not warn the alert channel: %s", key, exc)


def compose_message(user_id: int, mentioned: list[str], msg: str) -> str:
    """Join the sender line, the mention line, and the message.

    Both lines carry IDs only: Discord renders the names, so no nickname or
    email is written into the message. With nobody to mention there is no
    mention line.
    """
    lines = [f"발신: <@{user_id}>"]
    if mentioned:
        lines.append(" ".join(f"<@{uid}>" for uid in mentioned))
    lines.append(msg)
    return "\n".join(lines)


# Registered after the fixed /channels/alert and /channels/announcement paths:
# FastAPI matches in registration order, so the other way round would swallow
# both as channel IDs and answer a snowflake 400.
@router.post("/channels/{discordChannelId}/msg", status_code=204)
async def send_channel_message(
    request: Request,
    body: SendChannelMessageRequest,
    discordChannelId: str = Path(pattern=r"^[0-9]{17,20}$"),
    user_id: int = Depends(discord_user_id),
    key: str = Depends(idempotency_key),
) -> Response:
    """Post the caller's message to a channel of their study, mentioning whom they ask.

    A mention target who has left the guild does not stop the message: it goes
    up mentioning everyone who is still here, and the alert channel is told who
    was left out. The message is what the caller is after, and holding it back
    over one stale ID would keep it from everyone else too.
    """
    # Measured with every ID the caller asked for and with msg as it arrived: a
    # message that only fits because @everyone was removed, or because someone
    # turned out to have left the guild, is still too long. Nothing is
    # truncated -- a cut message loses its tail without anyone noticing.
    if len(compose_message(user_id, body.discordUserIds, body.msg)) > MAX_TOTAL:
        raise HTTPException(
            status_code=400,
            detail=f"the sender line, the mentions, and msg exceed {MAX_TOTAL} characters together",
        )

    content = strip_mass_mentions(body.msg).strip()
    if not content:
        raise HTTPException(
            status_code=400, detail="msg is empty once @everyone and @here are removed"
        )

    guild = await caller_guild(request, user_id, allow_navigator=True, allow_system=False)

    channel_id = int(discordChannelId)
    study_id = int(body.discordStudyId)
    channel = resolve_study_channel(guild, channel_id, study_id)
    mentioned, missing = await split_mention_targets(guild, body.discordUserIds)

    # Only the users being mentioned are notified. Everything else -- a mass
    # mention that survived stripping, a <@id> or role mention typed into msg,
    # and the sender line -- renders as text and rings nobody.
    try:
        await channel.send(
            compose_message(user_id, mentioned, content),
            allowed_mentions=discord.AllowedMentions(
                everyone=False,
                roles=False,
                users=[discord.Object(id=int(uid)) for uid in mentioned],
            ),
        )
    except discord.Forbidden as exc:
        # The channel is the caller's, not configuration, so this is one
        # channel's permissions, not every request failing.
        logger.error(
            "send-message %s: the bot cannot post in channel %s of study %s, "
            "check its Send Messages permission there: %s",
            key,
            channel_id,
            study_id,
            exc,
        )
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc

    logger.info(
        "send-message %s: posted to channel %s of study %s, %d of %d mentioned",
        key,
        channel_id,
        study_id,
        len(mentioned),
        len(body.discordUserIds),
    )
    if missing:
        await warn_unknown_mention_targets(
            guild, request.app.state.settings, channel_id, missing, key
        )
    return Response(status_code=204)
