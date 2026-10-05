"""The channel gate every bot command passes.

Commands are kept to the one channel in ``DISCORD_BOT_CHANNEL_ID``. They are
moderator tools -- refresh the board, list the quiet 공부방 -- so the people who
use them are a handful of captains, and keeping the traffic in one place means
the rest of the guild never has to read it and whoever runs the guild has one
scrollback to look at when something went wrong.

**Every command this service defines calls :func:`check` before it does
anything else.** A command that must work outside that channel is an exception
and has to say so in its own docstring and in ``discord/README.md`` -- otherwise
the single-channel rule is only true by accident.

The one exception today is ``!help``, which discord.py registers itself and
which therefore answers in any channel. It only lists the commands above, so it
leaks nothing; to close it too, drop ``help_command=None`` into the
``commands.Bot(...)`` call in ``app/bot/client.py``.

The check is a plain coroutine so it can be unit tested without a Discord
connection, like the commands themselves.
"""

from __future__ import annotations

import logging

from discord.ext import commands

from app.config import Settings

logger = logging.getLogger(__name__)

DISABLED = "DISCORD_BOT_CHANNEL_ID 가 설정되지 않아 봇 명령을 받을 채널이 없습니다."


def wrong_channel(channel_id: int) -> str:
    """The refusal sent when a command is used outside the command channel.

    A channel mention rather than the raw ID, so the caller can click through
    instead of hunting for it.
    """
    return f"봇 명령은 <#{channel_id}> 채널에서만 쓸 수 있습니다."


async def check(ctx: commands.Context, settings: Settings) -> bool:
    """Whether ``ctx`` is the command channel, telling the caller when it is not.

    An unset ``DISCORD_BOT_CHANNEL_ID`` refuses every command everywhere rather
    than accepting them anywhere, the same way an unset
    ``DISCORD_CAPTAIN_ROLE_ID`` shuts the door in ``may_update`` and
    ``caller_guild``: a missing setting never means "open".

    The refusal is sent in whatever channel was used -- a line of noise there,
    but a command that answers with silence reads as a bot that is down. A DM
    has a channel ID too, and it is never the configured one, so DMs are
    refused by the same comparison.
    """
    if settings.command_channel_id is None:
        logger.warning(
            "%s: refused, DISCORD_BOT_CHANNEL_ID is not set so no channel takes commands",
            ctx.invoked_with,
        )
        await ctx.send(DISABLED)
        return False
    if ctx.channel.id != settings.command_channel_id:
        logger.info("%s: refused, used in channel %s", ctx.invoked_with, ctx.channel.id)
        await ctx.send(wrong_channel(settings.command_channel_id))
        return False
    return True
