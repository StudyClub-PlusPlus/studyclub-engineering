"""Discord bot factory."""

from __future__ import annotations

import discord
from discord.ext import commands

from app.bot import bulletin, voice_monitor
from app.bot.commands import (
    attendance_cmd,
    bulletin_cmd,
    help_cmd,
    test_cmd,
    voice_monitor_cmd,
)
from app.config import Settings


def create_bot(settings: Settings) -> commands.Bot:
    """Build the Discord bot with the required intents and commands registered."""
    intents = discord.Intents.default()
    intents.message_content = True

    # Without ``help_command`` discord.py files every command under "No
    # Category" and describes ``!help`` in English, which is what members read.
    # ``CategorizedHelpCommand`` groups them by who may run each one instead.
    bot = commands.Bot(
        command_prefix=settings.command_prefix,
        intents=intents,
        help_command=help_cmd.CategorizedHelpCommand(
            command_attrs={"help": "이 도움말을 보여줍니다."},
        ),
    )
    # testCmd, updateBulletin, and checkVoiceChannels gate themselves on
    # DISCORD_BOT_CHANNEL_ID; attendance is the documented voice-chat exception.
    test_cmd.register(bot, settings)
    # Hooks the bulletin refresh onto ``setup_hook``; it starts once the bot has
    # logged in, not here.
    bulletin.register(bot, settings)
    bulletin_cmd.register(bot, settings)
    # Listens for joins and leaves from here on; the daily inactivity check is
    # hooked onto ``setup_hook`` the same way the bulletin refresh is.
    voice_monitor.register(bot, settings)
    voice_monitor_cmd.register(bot, settings)
    attendance_cmd.register(bot, settings)
    return bot
