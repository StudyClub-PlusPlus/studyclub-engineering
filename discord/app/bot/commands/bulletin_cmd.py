"""The ``updateBulletin`` command: rewrite the voice channel bulletin now.

The board refreshes itself daily at 20:00 America/Los_Angeles, so this is for
the times someone does not want to wait -- a study created in the morning, or a
channel renamed before a session.

The work is done by a plain coroutine so it can be unit tested without a Discord
connection; ``register`` only wires it into the bot.
"""

from __future__ import annotations

import logging

from discord.ext import commands

from app.bot import bulletin
from app.bot.commands import command_channel
from app.config import Settings

logger = logging.getLogger(__name__)

NOT_ALLOWED = "이 명령은 captain 역할을 가진 멤버만 쓸 수 있습니다."
DISABLED = (
    "DISCORD_BULLETIN_CHANNEL_ID 가 설정되지 않아 공부방 게시판 기능이 꺼져 있습니다."
)
UPDATED = "공부방 게시판을 갱신했습니다."
FAILED = "공부방 게시판을 갱신하지 못했습니다. alert 채널과 로그를 확인해 주세요."


def may_update(ctx: commands.Context, settings: Settings) -> bool:
    """Whether ``ctx.author`` may rewrite the board: a captain, inside the guild.

    Captain only, like every other write this service performs. A refresh costs
    a history read and an edit against Discord's rate limits, so it is not left
    open to the whole guild -- and the board is what every member reads.

    An unset ``DISCORD_CAPTAIN_ROLE_ID`` shuts the door rather than opening it,
    the same way ``caller_guild`` treats it on the API side. In a DM there is no
    member and no role, so there is nobody to check.
    """
    if ctx.guild is None or settings.captain_role_id is None:
        return False
    return ctx.author.get_role(settings.captain_role_id) is not None


async def update_bulletin(ctx: commands.Context, bot: commands.Bot, settings: Settings) -> None:
    """Refresh the board and tell the caller what happened.

    Every failure has already been logged and sent to the alert channel by
    :func:`app.bot.bulletin.refresh`, so the reply only has to say which way it
    went and where to look.

    The channel gate comes before the role check so a refusal never says who is
    and is not a captain outside the command channel.
    """
    if not await command_channel.check(ctx, settings):
        return
    if not may_update(ctx, settings):
        logger.info("updateBulletin: refused for user %s", ctx.author.id)
        await ctx.send(NOT_ALLOWED)
        return
    if settings.bulletin_channel_id is None:
        await ctx.send(DISABLED)
        return

    logger.info("updateBulletin: requested by user %s", ctx.author.id)
    await ctx.send(UPDATED if await bulletin.refresh(bot, settings) else FAILED)


def register(bot: commands.Bot, settings: Settings) -> None:
    """Attach the ``updateBulletin`` command to ``bot``."""

    @bot.command(
        name="updateBulletin",
        help="공부방 게시판을 지금 다시 씁니다. captain 전용.\n"
        "게시판은 매일 저녁 8시에 저절로 갱신되니, 그때까지 기다릴 수 없을 때만 쓰면 됩니다.",
    )
    async def update_bulletin_command(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        await update_bulletin(ctx, bot, settings)
