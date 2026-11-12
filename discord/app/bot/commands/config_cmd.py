"""The ``config print`` command: show every ``DISCORD_CONFIG_*`` setting.

For a captain wondering whether the bot is pointed at the right channels and
roles, without asking whoever holds ``.env``. The ``DISCORD_CONFIG_`` prefix is
what makes a value safe to show (see ``app/config.py``), so that prefix -- not a
list kept here -- decides what is printed, and a secret can only appear by being
misnamed.

What each value *is* comes from looking the ID up in the guild, not from the end
of its name. A role ID put in a channel setting then reads as the channel it
really is, instead of as a role that cannot be found.

The work is done by plain functions so it can be unit tested without a Discord
connection; ``register`` only wires it into the bot.
"""

from __future__ import annotations

import logging
import os
from typing import Mapping

import discord
from discord.ext import commands

from app.bot.commands import command_channel
from app.config import Settings

logger = logging.getLogger(__name__)

PREFIX = "DISCORD_CONFIG_"

NOT_ALLOWED = "이 명령은 captain 역할을 가진 멤버만 쓸 수 있습니다."
NOTHING_SET = f"{PREFIX}* 설정이 하나도 없습니다."


def may_print(ctx: commands.Context, settings: Settings) -> bool:
    """Whether ``ctx.author`` may see the settings: a captain, inside the guild.

    Captain only. Nothing printed is secret, but it is a map of the guild's
    operational channels and roles, which is for whoever runs the guild.

    An unset ``DISCORD_CONFIG_CAPTAIN_ROLE_ID`` shuts the door rather than opening it.
    In a DM there is no member and no role, so there is nobody to check.
    """
    if ctx.guild is None or settings.captain_role_id is None:
        return False
    return ctx.author.get_role(settings.captain_role_id) is not None


def describe(guild: discord.Guild, raw: str) -> str:
    """Say what the ID in ``raw`` is in ``guild``.

    Discord IDs are unique across guilds, roles, channels, and users, so the
    first lookup that hits is the answer. The guild comes first because the
    ``@everyone`` role shares its ID. Roles and members are plain names, not
    mentions, so printing the settings pings nobody.

    A value that is not a number is not echoed: it is under the safe prefix, but
    it is not the ID the prefix promises, so there is no telling what it is.
    """
    if not raw.strip():
        return "(설정 안 됨)"
    try:
        id_ = int(raw)
    except ValueError:
        return "⚠️ ID 가 아님"
    if id_ == guild.id:
        return f"{guild.name} (server)"
    if role := guild.get_role(id_):
        return f"@{role.name}"
    if channel := guild.get_channel(id_):
        if isinstance(channel, discord.CategoryChannel):
            return f"{channel.name} (category)"
        return channel.mention
    if member := guild.get_member(id_):
        return f"{member.display_name} (user)"
    return f"⚠️ 서버에서 찾을 수 없음 ({id_})"


def build_lines(guild: discord.Guild, environ: Mapping[str, str]) -> list[str]:
    """One ``NAME: description`` line per ``DISCORD_CONFIG_*`` variable, by name."""
    return [
        f"`{name}`: {describe(guild, environ[name])}"
        for name in sorted(environ)
        if name.startswith(PREFIX)
    ]


async def config_print(
    ctx: commands.Context, settings: Settings, environ: Mapping[str, str]
) -> None:
    """Reply with the settings.

    ``environ`` is the process environment, which ``.env`` was loaded into at
    startup -- so this shows what the bot is running with, not what the file
    says now.

    The channel gate comes before the role check so a refusal never says who is
    and is not a captain outside the command channel.
    """
    if not await command_channel.check(ctx, settings):
        return
    if not may_print(ctx, settings):
        logger.info("config print: refused for user %s", ctx.author.id)
        await ctx.send(NOT_ALLOWED)
        return

    logger.info("config print: requested by user %s", ctx.author.id)
    lines = build_lines(ctx.guild, environ)
    await ctx.send(
        "\n".join(lines) if lines else NOTHING_SET,
        allowed_mentions=discord.AllowedMentions.none(),
    )


def register(bot: commands.Bot, settings: Settings) -> None:
    """Attach the ``config`` group and its ``print`` subcommand to ``bot``."""

    @bot.group(
        name="config",
        invoke_without_command=True,
        help="봇 설정을 다룹니다. captain 전용.",
        extras={"category": "Captain"},
    )
    async def config_group(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        # Bare ``!config`` lists its subcommands; gated like everything else.
        if await command_channel.check(ctx, settings):
            await ctx.send_help(ctx.command)

    @config_group.command(
        name="print",
        help="봇이 쓰고 있는 DISCORD_CONFIG_* 설정을 보여줍니다. captain 전용.\n"
        "역할은 이름으로, 채널은 링크로 보여주고, 시크릿은 보여주지 않습니다.",
    )
    async def config_print_command(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        await config_print(ctx, settings, os.environ)
