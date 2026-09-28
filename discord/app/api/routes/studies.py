"""POST /api/v1/studies: create a study's category, channels, and role.
GET /api/v1/studies/{discordStudyId}/channels: list its channels.

Contracts: docs/discord-development-guide/api/create-study.md and
get-study-channels.md next to it.
"""

from __future__ import annotations

import logging

import discord
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, ConfigDict, Field

from app.api.headers import discord_user_id, idempotency_key, require_api_key

logger = logging.getLogger(__name__)

router = APIRouter(tags=["studies"], dependencies=[Depends(require_api_key)])

TEXT_CHANNEL_PREFIX = "로비-"
VOICE_CHANNEL_PREFIX = "공부방-"
# Discord caps channel and role names at 100, and the channel names are the
# study name plus a prefix, so the longest prefix comes off the budget.
MAX_STUDY_NAME = 100 - max(len(TEXT_CHANNEL_PREFIX), len(VOICE_CHANNEL_PREFIX))
# New study categories go right below the category with this name. It is the
# starting value of ``app.state.new_study_anchor_name``, which a Discord
# command will change at runtime.
DEFAULT_NEW_STUDY_ANCHOR_NAME = "===== New Study ====="


class CreateStudyRequest(BaseModel):
    # Stripped before the length check, so a blank name is too short.
    model_config = ConfigDict(str_strip_whitespace=True)

    studyName: str = Field(min_length=1, max_length=MAX_STUDY_NAME)


@router.post("/studies", status_code=201)
async def create_study(
    request: Request,
    body: CreateStudyRequest,
    user_id: int = Depends(discord_user_id),
    key: str = Depends(idempotency_key),
) -> dict:
    """Create the study, or undo whatever part of it was made and fail.

    Everything that can be checked is checked before the name is reserved, and
    the name is reserved before anything is sent to Discord.
    """
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="discord bot is disabled: no DISCORD_TOKEN set")
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="discord bot is not connected yet")

    settings = request.app.state.settings
    if settings.guild_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_GUILD_ID configured")
    if settings.captain_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_CAPTAIN_ROLE_ID configured")

    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail=f"guild {settings.guild_id} not found by the bot")

    try:
        member = await guild.fetch_member(user_id)
    except discord.NotFound as exc:
        raise HTTPException(
            status_code=404, detail=f"user {user_id} is not a member of the guild"
        ) from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the member lookup: {exc}") from exc

    captain_role = guild.get_role(settings.captain_role_id)
    if captain_role is None:
        raise HTTPException(
            status_code=404, detail=f"captain role {settings.captain_role_id} not found in the guild"
        )
    if member.get_role(captain_role.id) is None:
        raise HTTPException(status_code=403, detail=f"user {user_id} does not have the captain role")

    # guild.categories is sorted by position, so a duplicated name resolves to the topmost.
    anchor_name = request.app.state.new_study_anchor_name
    anchor = discord.utils.get(guild.categories, name=anchor_name)
    if anchor is None:
        logger.warning(
            "create-study %s: reference category %r not found, placing the study at the top",
            key,
            anchor_name,
        )

    name = body.studyName
    reservations = request.app.state.study_reservations
    if not reservations.reserve(name, key):
        raise HTTPException(status_code=409, detail="a study with this name exists or is being created")
    # Categories made before the reservation table, or by hand, are not in it.
    if any(category.name == name for category in guild.categories):
        reservations.release(name)
        raise HTTPException(status_code=409, detail="a category with this name already exists")

    created: list[discord.abc.GuildChannel | discord.Role] = []
    try:
        category = await guild.create_category(name)
        created.append(category)
        if anchor is None:
            await category.move(beginning=True)
        else:
            await category.move(after=anchor)
        # Text: everyone can see it and talk in it.
        text_overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=True, send_messages=True),
        }
        created.append(
            await category.create_text_channel(TEXT_CHANNEL_PREFIX + name, overwrites=text_overwrites)
        )
        # Voice: everyone can see it, only the study role can join. Nobody but
        # the bot can join from the start; the role is let in once it exists.
        # The bot needs Connect itself: Discord refuses to let it edit the
        # channel's permissions or delete the channel without it.
        voice_overwrites = {
            guild.default_role: discord.PermissionOverwrite(view_channel=True, connect=False),
            guild.me: discord.PermissionOverwrite(connect=True),
        }
        voice = await category.create_voice_channel(
            VOICE_CHANNEL_PREFIX + name, overwrites=voice_overwrites
        )
        created.append(voice)
        role = await guild.create_role(name=name)
        created.append(role)
        await voice.set_permissions(role, connect=True)
    except discord.HTTPException as exc:
        leftovers = await _delete_in_reverse(created)
        if leftovers:
            # The reservation stays, marked ERROR, so the name stays blocked
            # until someone removes these by hand (and the row with them).
            reservations.fail(name)
            logger.error(
                "create-study %s: rollback failed, clean up by hand: %s",
                key,
                ", ".join(f"{type(obj).__name__} {obj.id}" for obj in leftovers),
            )
            raise HTTPException(
                status_code=502,
                detail=f"discord rejected the creation and the rollback failed: {exc}",
            ) from exc
        reservations.release(name)
        raise HTTPException(status_code=502, detail=f"discord rejected the creation: {exc}") from exc

    reservations.complete(name, category.id, role.id)
    logger.info("create-study %s: category %s, role %s", key, category.id, role.id)
    # Snowflakes go out as strings: a JSON number loses precision in JS callers.
    return {"discordStudyId": str(category.id), "discordRoleId": str(role.id)}


@router.get("/studies/{discordStudyId}/channels")
async def get_study_channels(
    request: Request,
    discordStudyId: str = Path(pattern=r"^[0-9]{17,20}$"),
    user_id: int = Depends(discord_user_id),
) -> list[dict]:
    """List the text and voice channels the bot can see under the study's category."""
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="discord bot is disabled: no DISCORD_TOKEN set")
    # Before ready the cache is empty, and an empty list would pass as a success.
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="discord bot is not connected yet")

    settings = request.app.state.settings
    if settings.guild_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_GUILD_ID configured")
    if settings.captain_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_CAPTAIN_ROLE_ID configured")
    if settings.navigator_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_NAVIGATOR_ROLE_ID configured")

    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail=f"guild {settings.guild_id} not found by the bot")

    try:
        member = await guild.fetch_member(user_id)
    except discord.NotFound as exc:
        raise HTTPException(
            status_code=404, detail=f"user {user_id} is not a member of the guild"
        ) from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the member lookup: {exc}") from exc

    # Both roles must exist even when the member has the other one, so a broken
    # configuration is never half-checked.
    captain_role = guild.get_role(settings.captain_role_id)
    if captain_role is None:
        raise HTTPException(
            status_code=404, detail=f"captain role {settings.captain_role_id} not found in the guild"
        )
    navigator_role = guild.get_role(settings.navigator_role_id)
    if navigator_role is None:
        raise HTTPException(
            status_code=404,
            detail=f"navigator role {settings.navigator_role_id} not found in the guild",
        )
    if member.get_role(captain_role.id) is None and member.get_role(navigator_role.id) is None:
        raise HTTPException(
            status_code=403, detail=f"user {user_id} has neither the captain nor the navigator role"
        )

    channel = guild.get_channel(int(discordStudyId))
    if channel is None or not channel.permissions_for(guild.me).view_channel:
        raise HTTPException(status_code=404, detail=f"category {discordStudyId} not found by the bot")
    if not isinstance(channel, discord.CategoryChannel):
        raise HTTPException(status_code=400, detail=f"channel {discordStudyId} is not a category")

    # Both lists are sorted by position, so text-then-voice is the sidebar order.
    listed = [(c, "TEXT") for c in channel.text_channels] + [
        (c, "VOICE") for c in channel.voice_channels
    ]
    return [
        # Snowflakes go out as strings: a JSON number loses precision in JS callers.
        {"discordChannelId": str(c.id), "discordChannelName": c.name, "discordChannelType": kind}
        for c, kind in listed
        # A channel the bot cannot view is one send-message could not post to.
        if c.permissions_for(guild.me).view_channel
    ]


async def _delete_in_reverse(
    created: list[discord.abc.GuildChannel | discord.Role],
) -> list[discord.abc.GuildChannel | discord.Role]:
    """Delete ``created`` newest first and return whatever could not be deleted.

    Reverse order puts the channels before their category -- deleting a
    category in Discord leaves its channels behind.
    """
    leftovers = []
    for obj in reversed(created):
        try:
            await obj.delete()
        except discord.HTTPException as exc:
            logger.warning("could not delete %s %s: %s", type(obj).__name__, obj.id, exc)
            leftovers.append(obj)
    return leftovers
