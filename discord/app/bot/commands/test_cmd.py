"""The ``testCmd`` command.

The response is built by a plain function so it can be unit tested without a
Discord connection; ``register`` only wires it into the bot.
"""

from __future__ import annotations

from discord.ext import commands


def build_test_response() -> str:
    """Return the reply sent by ``testCmd``."""
    return "testCmd OK ✅"


def register(bot: commands.Bot) -> None:
    """Attach the ``testCmd`` command to ``bot``."""
    @bot.command(name="testCmd")
    async def test_cmd(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        """Reply with the canned test response."""
        await ctx.send(build_test_response())