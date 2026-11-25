"""Add a user to the guild with their own OAuth2 access token (add-guild-member).

The backend calls this while linking an account: the user granted the
``guilds.join`` scope, so the bot can put them in the guild in the same step
instead of sending them to an invite link first. The access token is passed
through once and never stored or logged.
"""

from __future__ import annotations

import logging

import discord
from discord.http import Route
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field

from app.api.guild import resolve_guild
from app.api.headers import discord_user_id, require_api_key

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["members"], dependencies=[Depends(require_api_key), Depends(discord_user_id)]
)

# Discord JSON error codes this endpoint tells apart.
BANNED = 40007
TOO_MANY_GUILDS = 30001
INVALID_ACCESS_TOKEN = 50025


class AddMemberRequest(BaseModel):
    accessToken: str = Field(min_length=1)


def _reason(error: discord.HTTPException) -> str:
    if error.code == BANNED:
        return "BANNED"
    if error.code == TOO_MANY_GUILDS:
        return "TOO_MANY_GUILDS"
    if error.code == INVALID_ACCESS_TOKEN:
        return "INVALID_ACCESS_TOKEN"
    if isinstance(error, discord.Forbidden):
        return "MISSING_PERMISSION"
    return "DISCORD_REJECTED"


@router.put("/members/{discordUserId}")
async def add_guild_member(
    request: Request,
    body: AddMemberRequest,
    discordUserId: str = Path(pattern=r"^[0-9]{17,20}$"),
) -> dict:
    """Put the user in the guild. ``joined`` is false when they were already in it.

    A guild with membership screening keeps the new member pending until they
    accept the rules in Discord; that is Discord's step, not this one.
    """
    guild = resolve_guild(request)
    bot = request.app.state.bot
    route = Route(
        "PUT", "/guilds/{guild_id}/members/{user_id}", guild_id=guild.id, user_id=int(discordUserId)
    )
    try:
        data = await bot.http.request(route, json={"access_token": body.accessToken})
    except discord.HTTPException as error:
        reason = _reason(error)
        logger.warning("add-guild-member user %s: %s (%s)", discordUserId, reason, error.status)
        raise HTTPException(status_code=409, detail=reason) from None
    # 201 carries the new member; 204 (already a member) has no body.
    joined = bool(data)
    logger.info("add-guild-member user %s: joined=%s", discordUserId, joined)
    return {"joined": joined}
