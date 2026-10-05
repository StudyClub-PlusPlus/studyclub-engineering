"""Resolving the caller inside the one guild the service acts on.

Every endpoint that acts on behalf of a guild member opens the same way: the
bot must be connected, the guild and the roles must be configured and present,
and the caller must be a member holding a role that may call. Only who may
call differs between endpoints, so that is all the parameters say.
"""

from __future__ import annotations

import discord
from fastapi import HTTPException, Request


async def caller_guild(
    request: Request, user_id: int, *, allow_navigator: bool, allow_system: bool
) -> discord.Guild:
    """Return the guild, once the caller is known to be allowed to act in it.

    ``allow_navigator`` widens the check to the endpoints navigators may call:
    the navigator role is then configured and resolved as strictly as captain,
    so a broken configuration is never half-checked, and either role passes.
    With it false the navigator setting is not read at all.

    ``allow_system`` lets the backend call on its own behalf instead of a
    member's, which it says by sending the bot's own ID. Neither flag has a
    default, so every endpoint states who may call it.
    """
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="discord bot is disabled: no DISCORD_TOKEN set")
    # Before ready the cache is empty, so a lookup would miss what is there.
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="discord bot is not connected yet")

    settings = request.app.state.settings
    if settings.guild_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_GUILD_ID configured")

    # The bot's own ID as the caller means the backend is acting as the system,
    # not for a member: there is no member to look up and no role to hold, and
    # X-API-Key has already established that the caller is the backend. With
    # DISCORD_BOT_ID unset this is never true, so an unset value shuts the door
    # rather than opening it.
    system = allow_system and user_id == settings.bot_id

    if not system:
        if settings.captain_role_id is None:
            raise HTTPException(status_code=409, detail="no DISCORD_CAPTAIN_ROLE_ID configured")
        if allow_navigator and settings.navigator_role_id is None:
            raise HTTPException(
                status_code=409, detail="no DISCORD_NAVIGATOR_ROLE_ID configured"
            )

    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail=f"guild {settings.guild_id} not found by the bot")

    if system:
        return guild

    try:
        member = await guild.fetch_member(user_id)
    except discord.NotFound as exc:
        raise HTTPException(
            status_code=404, detail=f"user {user_id} is not a member of the guild"
        ) from exc
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the member lookup: {exc}") from exc

    # Every role the endpoint considers must exist even when the caller holds
    # another one, so a broken configuration is never half-checked.
    captain_role = guild.get_role(settings.captain_role_id)
    if captain_role is None:
        raise HTTPException(
            status_code=404, detail=f"captain role {settings.captain_role_id} not found in the guild"
        )
    allowed = member.get_role(captain_role.id) is not None
    if allow_navigator:
        navigator_role = guild.get_role(settings.navigator_role_id)
        if navigator_role is None:
            raise HTTPException(
                status_code=404,
                detail=f"navigator role {settings.navigator_role_id} not found in the guild",
            )
        allowed = allowed or member.get_role(navigator_role.id) is not None

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail=(
                f"user {user_id} has neither the captain nor the navigator role"
                if allow_navigator
                else f"user {user_id} does not have the captain role"
            ),
        )
    return guild
