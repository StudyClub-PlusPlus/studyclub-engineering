"""The ``testCmd`` command.

The response is built by a plain function so it can be unit tested without a
Discord connection; ``register`` only wires it into the bot.
"""

from __future__ import annotations

from discord.ext import commands

from app.bot.commands import command_channel
from app.config import Settings


def build_test_response() -> str:
    """Return the reply sent by ``testCmd``."""
    return "testCmd OK ✅"


async def respond(ctx: commands.Context, settings: Settings) -> None:
    """Send the canned response, if this is the command channel.

    No role check: this one only proves the bot can hear and answer, so the
    channel gate is the whole of its permission story.
    """
    if not await command_channel.check(ctx, settings):
        return
    await ctx.send(build_test_response())


def register(bot: commands.Bot, settings: Settings) -> None:
    """Attach the ``testCmd`` command to ``bot``."""
    @bot.command(
        name="testCmd",
        help="봇이 살아있는지 확인합니다. 아무나 쓸 수 있습니다.",
        extras={"category": "ETC"},
    )
    async def test_cmd(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        await respond(ctx, settings)
