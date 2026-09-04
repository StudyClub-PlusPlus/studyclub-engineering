"""The ``reloadConfig`` command.

Re-reads ``config.json`` on a running bot so the output channel can be changed
without a restart. Restricted to the bot owner. The response is built by a plain
function so it can be unit tested without a Discord connection.
"""

from __future__ import annotations

from discord.ext import commands

from app.config import Settings, SettingsStore


def build_reload_response(settings: Settings, channel_name: str | None) -> str:
    """Return the message describing the config read from ``config.json``."""
    channel_id = settings.output_channel_id
    if channel_id is None:
        channel_line = "no output channel configured"
    elif channel_name is None:
        channel_line = f"output channel {channel_id} not in cache yet"
    else:
        channel_line = f"output channel: #{channel_name} ({channel_id})"
    return f"config reloaded — {channel_line}; extra: {settings.extra}"


def register(bot: commands.Bot, store: SettingsStore) -> None:
    """Attach the ``reloadConfig`` command to ``bot``."""
    @bot.command(name="reloadConfig")
    @commands.is_owner()
    async def reload_config(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        """Reload the config and reply with the resulting output channel."""
        try:
            settings = store.reload()
        except (ValueError, OSError) as exc:
            await ctx.send(f"config reload failed: {exc}")
            return

        channel_id = settings.output_channel_id
        channel = bot.get_channel(channel_id) if channel_id is not None else None
        await ctx.send(build_reload_response(settings, getattr(channel, "name", None)))
