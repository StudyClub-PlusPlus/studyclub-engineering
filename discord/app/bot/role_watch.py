"""Tells the backend when someone changes a captain or navigator role by hand (DSC-14).

The web is the source of truth for both roles, but a moderator can still add or
remove them in Discord. Every such change is reported, one member at a time, to
``POST /api/discord/role-changes``; the backend decides whether to put it back
(``DISCORD_ROLE_SYNC_ENFORCE``, off by default). Contract:
``specs/discord-role-sync/spec.md``.

Changes the bot made itself through the role endpoints are not reported -- that
is how the backend's own corrections stay out of a ping-pong. Discord does not
say who changed a role, so the role endpoints write down each change just
before making it, and the listener drops the matching event.

Nothing here raises: a failed report is logged and left to the daily snapshot.
"""

from __future__ import annotations

import datetime
import logging
import time

import discord
from discord.ext import commands

from app.backend_client import BackendError, BackendUnreachable, notify_role_change
from app.config import Settings

logger = logging.getLogger(__name__)

# How long a change the bot is about to make waits for its own event. Discord
# delivers it within a second or two; an entry that never matches (the event
# was lost) only hides a hand change to the same member, role, and direction
# inside this window.
OWN_CHANGE_TTL_SECONDS = 60.0

# (member ID, role ID, added?) -> when the entry expires
_own_changes: dict[tuple[int, int, bool], float] = {}


def expect_own_change(member_id: int, role_id: int, added: bool) -> None:
    """Note that the bot is about to add or remove ``role_id`` on ``member_id``."""
    now = time.monotonic()
    for key in [k for k, expires in _own_changes.items() if expires <= now]:
        del _own_changes[key]
    _own_changes[(member_id, role_id, added)] = now + OWN_CHANGE_TTL_SECONDS


def consume_own_change(member_id: int, role_id: int, added: bool) -> bool:
    """True, once, if this change is one the bot announced it would make."""
    expires = _own_changes.pop((member_id, role_id, added), None)
    return expires is not None and expires > time.monotonic()


def watched_roles(settings: Settings) -> list[tuple[str, int]]:
    """The roles worth reporting, as (contract name, role ID)."""
    pairs = [("CAPTAIN", settings.captain_role_id), ("NAVIGATOR", settings.navigator_role_id)]
    return [(name, role_id) for name, role_id in pairs if role_id is not None]


async def report_role_changes(
    settings: Settings, before: discord.Member, after: discord.Member
) -> None:
    """Report every hand change to captain or navigator between ``before`` and ``after``."""
    if after.guild.id != settings.guild_id:
        return
    before_ids = {role.id for role in before.roles}
    after_ids = {role.id for role in after.roles}
    for name, role_id in watched_roles(settings):
        had, has = role_id in before_ids, role_id in after_ids
        if had == has:
            continue
        if consume_own_change(after.id, role_id, has):
            continue
        change = "ADDED" if has else "REMOVED"
        occurred_at = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        try:
            await notify_role_change(
                settings.backend_base_url,
                settings.api_key,
                str(after.id),
                name,
                change,
                occurred_at,
            )
        except (BackendError, BackendUnreachable) as exc:
            logger.warning("role-changes: could not report %s %s for %s: %s", name, change, after.id, exc)
            continue
        logger.info("role-changes: reported %s %s for %s", name, change, after.id)


def register(bot: commands.Bot, settings: Settings) -> None:
    """Listen for member role changes, if there is a backend to tell."""
    missing = [
        env
        for env, value in (
            ("DISCORD_CONFIG_GUILD_ID", settings.guild_id),
            ("API_BASE_URL", settings.backend_base_url),
            ("DISCORD_API_KEY", settings.api_key),
        )
        if value is None
    ]
    if missing:
        logger.warning("%s not set - captain/navigator changes are not reported", ", ".join(missing))
        return
    if not watched_roles(settings):
        logger.warning("no captain/navigator role configured - role changes are not reported")
        return

    async def on_member_update(
        before: discord.Member, after: discord.Member
    ) -> None:  # pragma: no cover - thin wrapper
        await report_role_changes(settings, before, after)

    bot.add_listener(on_member_update, "on_member_update")
