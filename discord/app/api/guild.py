"""Resolving the one guild the service acts on.

Every endpoint that acts in the guild opens the same way: the bot must be
connected, and the guild must be configured and present. Who may call is not
checked here -- the backend decides that before it calls, and X-API-Key is
what tells the bot the caller is the backend.
"""

from __future__ import annotations

import discord
from fastapi import HTTPException, Request


def resolve_guild(request: Request) -> discord.Guild:
    """Return the configured guild, once the bot is ready to act in it."""
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="discord bot is disabled: no DISCORD_TOKEN set")
    # Before ready the cache is empty, so a lookup would miss what is there.
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="discord bot is not connected yet")

    settings = request.app.state.settings
    if settings.guild_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_CONFIG_GUILD_ID configured")

    guild = bot.get_guild(settings.guild_id)
    if guild is None:
        raise HTTPException(status_code=404, detail=f"guild {settings.guild_id} not found by the bot")
    return guild
