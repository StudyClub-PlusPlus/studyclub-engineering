"""Discord bot factory."""

from __future__ import annotations

import discord
from discord.ext import commands

from app.bot import bulletin, voice_monitor
from app.bot.commands import bulletin_cmd, test_cmd, voice_monitor_cmd
from app.config import Settings


def create_bot(settings: Settings) -> commands.Bot:
    """Build the Discord bot with the required intents and commands registered."""
    intents = discord.Intents.default()
    intents.message_content = True

    bot = commands.Bot(command_prefix=settings.command_prefix, intents=intents)
    # Every command below gates itself on DISCORD_BOT_CHANNEL_ID through
    # app.bot.commands.command_channel; none of them is an exception.
    test_cmd.register(bot, settings)
    # Hooks the bulletin refresh onto ``setup_hook``; it starts once the bot has
    # logged in, not here.
    bulletin.register(bot, settings)
    bulletin_cmd.register(bot, settings)
    # Listens for joins and leaves from here on; the daily inactivity check is
    # hooked onto ``setup_hook`` the same way the bulletin refresh is.
    voice_monitor.register(bot, settings)
    voice_monitor_cmd.register(bot, settings)
    return bot
