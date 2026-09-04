"""Discord bot factory."""

from __future__ import annotations

import discord
from discord.ext import commands

from app.bot.commands import reload_cmd, test_cmd
from app.config import SettingsStore


def create_bot(store: SettingsStore) -> commands.Bot:
    """Build the Discord bot with the required intents and commands registered."""
    intents = discord.Intents.default()
    intents.message_content = True

    bot = commands.Bot(command_prefix=store.current.command_prefix, intents=intents)
    test_cmd.register(bot)
    reload_cmd.register(bot, store)
    return bot
