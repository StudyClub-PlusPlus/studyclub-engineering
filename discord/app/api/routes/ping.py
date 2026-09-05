"""Endpoint that makes the Discord bot post a ping to the configured output channel."""

from __future__ import annotations

import discord
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["ping"])

PING_CONTENT = "ping from client"


@router.post("/ping")
async def ping(request: Request) -> dict:
    """Post :data:`PING_CONTENT` to ``DISCORD_BOT_OUTPUT_CHANNEL``.

    Runs on the same event loop as the bot, so the send is awaited directly.
    """
    bot = request.app.state.bot
    if bot is None:
        raise HTTPException(status_code=503, detail="discord bot is disabled: no DISCORD_TOKEN set")
    if not bot.is_ready():
        raise HTTPException(status_code=503, detail="discord bot is not connected yet")

    channel_id = request.app.state.settings.output_channel_id
    if channel_id is None:
        raise HTTPException(
            status_code=409, detail="no DISCORD_BOT_OUTPUT_CHANNEL configured"
        )

    channel = bot.get_channel(channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail=f"channel {channel_id} not found by the bot")

    try:
        message = await channel.send(PING_CONTENT)
    except discord.HTTPException as exc:
        raise HTTPException(status_code=502, detail=f"discord rejected the send: {exc}") from exc

    return {"status": "sent", "channel_id": channel_id, "message_id": message.id}
