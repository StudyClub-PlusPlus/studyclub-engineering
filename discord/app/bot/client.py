"""Discord bot factory."""

from __future__ import annotations

import discord
from discord.ext import commands

from app.bot.commands import test_cmd
from app.config import Settings


def create_bot(settings: Settings) -> commands.Bot:
    """Build the Discord bot with the required intents and commands registered."""
    intents = discord.Intents.default()
    intents.message_content = True

    bot = commands.Bot(command_prefix=settings.command_prefix, intents=intents)
    test_cmd.register(bot)
    return bot
