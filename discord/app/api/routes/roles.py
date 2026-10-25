"""POST /api/v1/roles/navigator/users: give the navigator role to users.
DELETE /api/v1/roles/navigator/users: take it back.
POST /api/v1/roles/{discordRoleId}/users: give a study role to users.
DELETE /api/v1/roles/{discordRoleId}/users: take it back.

Contracts: docs/discord-development-guide/api/assign-navigator-role.md,
remove-navigator-role.md, assign-role.md, and remove-role.md next to them.
Discord changes a role one member per
call, so a request can fail part way: nothing is undone, and each user ends up
either counted in ``succeededCount`` or listed in ``failed``.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Annotated

import discord
from fastapi import APIRouter, Depends, HTTPException, Path, Request
from pydantic import BaseModel, Field, field_validator

from app.api.guild import resolve_guild
from app.api.headers import discord_user_id, idempotency_key, require_api_key
from app.config import Settings

logger = logging.getLogger(__name__)

router = APIRouter(
    tags=["roles"], dependencies=[Depends(require_api_key), Depends(discord_user_id)]
)

# One member query takes at most 100 IDs, and every user is a Discord call of
# their own, so this is also the worst-case response time.
MAX_USERS = 100
# Discord's JSON error code for "Unknown Member": the user is not in the guild.
UNKNOWN_MEMBER = 10007

NOT_IN_GUILD = "NOT_IN_GUILD"
DISCORD_REJECTED = "DISCORD_REJECTED"


class RoleUsersRequest(BaseModel):
    discordStudyId: Annotated[str, Field(pattern=r"^[0-9]{17,20}$")]
    discordUserIds: list[Annotated[str, Field(pattern=r"^[0-9]{17,20}$")]] = Field(min_length=1)

    @field_validator("discordUserIds")
    @classmethod
    def unique_and_within_the_limit(cls, ids: list[str]) -> list[str]:
        """Drop duplicates, keeping request order, and refuse too many users.

        The limit is counted after deduplication, so the response accounts for
        exactly the users counted here.
        """
        unique = list(dict.fromkeys(str(int(uid)) for uid in ids))
        if len(unique) > MAX_USERS:
            raise ValueError(f"at most {MAX_USERS} users may be given at once")
        return unique


def resolve_navigator_role(guild: discord.Guild, settings: Settings) -> discord.Role:
    """Return the configured navigator role.

    The ID is configuration, not the caller's, so both ways this fails are a
    server setup problem the caller cannot fix.
    """
    if settings.navigator_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_NAVIGATOR_ROLE_ID configured")
    role = guild.get_role(settings.navigator_role_id)
    if role is None:
        raise HTTPException(
            status_code=404,
            detail=f"navigator role {settings.navigator_role_id} not found in the guild",
        )
    return role


def resolve_study_role(guild: discord.Guild, settings: Settings, role_id: int) -> discord.Role:
    """Return the caller's role, once it is one these endpoints may change.

    Captain is handed out by hand, navigator has endpoints of its own, and
    @everyone (whose ID is the guild's) is every member already, so none of the
    three pass. Both role IDs must be configured: an unset one would let its
    role through rather than keep it out.
    """
    if settings.captain_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_CAPTAIN_ROLE_ID configured")
    if settings.navigator_role_id is None:
        raise HTTPException(status_code=409, detail="no DISCORD_NAVIGATOR_ROLE_ID configured")
    if role_id in (settings.captain_role_id, settings.navigator_role_id, guild.id):
        raise HTTPException(
            status_code=400, detail=f"role {role_id} cannot be changed through this endpoint"
        )
    role = guild.get_role(role_id)
    if role is None:
        raise HTTPException(status_code=404, detail=f"role {role_id} not found in the guild")
    return role


async def find_members(guild: discord.Guild, user_ids: list[str]) -> dict[str, discord.Member]:
    """Return the guild's members among ``user_ids``, keyed by ID.

    The cache answers first; whoever it misses is looked up in one gateway
    query rather than an HTTP call each. Anyone neither finds is not a member.
    """
    found: dict[str, discord.Member] = {}
    missed: list[str] = []
    for uid in user_ids:
        member = guild.get_member(int(uid))
        if member is None:
            missed.append(uid)
        else:
            found[uid] = member
    if missed:
        try:
            members = await guild.query_members(
                user_ids=[int(uid) for uid in missed], limit=MAX_USERS
            )
        except asyncio.TimeoutError as exc:
            # Nobody has been touched yet, so the whole request is safe to retry.
            raise HTTPException(
                status_code=502, detail="discord did not answer the member query"
            ) from exc
        found.update((str(member.id), member) for member in members)
    return found


def log_refusals(operation: str, key: str, role: discord.Role, refused: list[str]) -> None:
    """Point at the bot's setup when Discord refused the bot outright.

    A role above the bot's own, or a missing Manage Roles, refuses every user
    alike and no retry gets past it, so whoever reads the log should look at
    the guild rather than the request.
    """
    if refused:
        logger.error(
            "%s %s: discord refused the bot for %d user(s) -- check that the bot's role "
            "is above role %s and that it has Manage Roles: %s",
            operation,
            key,
            len(refused),
            role.id,
            ", ".join(refused),
        )


def log_unreachable(operation: str, key: str, role: discord.Role, uid: str, exc: Exception) -> None:
    """Log the connection to Discord failing, after which no user is tried.

    Anything but ``discord.HTTPException`` is the connection itself: a reset
    comes up as OSError, a dropped connection as aiohttp's own error, a stall as
    a timeout. Unlike a refusal it fails every user after this one alike, and
    each could wait minutes on it, so the rest are reported as failed untried.
    CancelledError is a BaseException and still propagates.
    """
    logger.exception(
        "%s %s: lost discord at %s, so role %s is not tried for anyone after: %s",
        operation,
        key,
        uid,
        role.id,
        exc,
    )


async def assign_role(
    guild: discord.Guild, role: discord.Role, user_ids: list[str], operation: str, key: str
) -> tuple[list[str], list[dict]]:
    """Give ``role`` to every member among ``user_ids`` and return who has it and who failed.

    Every user is resolved before the first change, so a user who is not in
    the guild is only left out, never a reason to stop.
    """
    members = await find_members(guild, user_ids)
    succeeded: list[str] = []
    failed: list[dict] = []
    refused: list[str] = []
    unreachable = False
    for uid in user_ids:
        member = members.get(uid)
        if member is None:
            failed.append({"discordUserId": uid, "reason": NOT_IN_GUILD})
            continue
        if unreachable:
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        try:
            await member.add_roles(role)
        except discord.HTTPException as exc:
            # They left between the lookup and the change.
            if isinstance(exc, discord.NotFound) and exc.code == UNKNOWN_MEMBER:
                failed.append({"discordUserId": uid, "reason": NOT_IN_GUILD})
                continue
            if isinstance(exc, discord.Forbidden):
                refused.append(uid)
            logger.warning("%s %s: could not give role %s to %s: %s", operation, key, role.id, uid, exc)
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        except Exception as exc:
            log_unreachable(operation, key, role, uid, exc)
            unreachable = True
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        succeeded.append(uid)
    log_refusals(operation, key, role, refused)
    return succeeded, failed


async def remove_role(
    guild: discord.Guild, role: discord.Role, user_ids: list[str], operation: str, key: str
) -> tuple[list[str], list[dict]]:
    """Take ``role`` from every user in ``user_ids`` and return who is without it and who failed.

    A user outside the guild counts as without it -- leaving drops every role.
    That is only ever concluded from Discord's own "Unknown Member" answer: the
    cache supplies the member to call on, but a cache miss is looked up, never
    taken as an absence. Concluding it from the cache would report a member the
    cache missed as done while they still hold the role.
    """
    succeeded: list[str] = []
    failed: list[dict] = []
    refused: list[str] = []
    unreachable = False
    for uid in user_ids:
        if unreachable:
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        try:
            member = guild.get_member(int(uid)) or await guild.fetch_member(int(uid))
            await member.remove_roles(role)
        except discord.HTTPException as exc:
            if isinstance(exc, discord.NotFound) and exc.code == UNKNOWN_MEMBER:
                logger.info(
                    "%s %s: %s is not in the guild, so already without role %s",
                    operation,
                    key,
                    uid,
                    role.id,
                )
                succeeded.append(uid)
                continue
            if isinstance(exc, discord.Forbidden):
                refused.append(uid)
            logger.warning("%s %s: could not take role %s from %s: %s", operation, key, role.id, uid, exc)
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        except Exception as exc:
            log_unreachable(operation, key, role, uid, exc)
            unreachable = True
            failed.append({"discordUserId": uid, "reason": DISCORD_REJECTED})
            continue
        succeeded.append(uid)
    log_refusals(operation, key, role, refused)
    return succeeded, failed


def respond(
    operation: str,
    key: str,
    role: discord.Role,
    study_id: str,
    succeeded: list[str],
    failed: list[dict],
) -> dict:
    """Log the outcome by ID and return the response body.

    The succeeded IDs are logged in full: nothing is undone on a failure, so
    the log is where anyone tracing a request finds who was already changed.
    """
    logger.info(
        "%s %s: role %s, study %s, %d succeeded (%s), %d failed",
        operation,
        key,
        role.id,
        study_id,
        len(succeeded),
        ", ".join(succeeded),
        len(failed),
    )
    return {"succeededCount": len(succeeded), "failed": failed}


@router.post("/roles/navigator/users")
async def assign_navigator_role(
    request: Request,
    body: RoleUsersRequest,
    key: str = Depends(idempotency_key),
) -> dict:
    """Give the navigator role to the users, as many as are in the guild.

    The role is guild-wide: ``discordStudyId`` is only logged, and whether the
    users belong to that study is for the backend to have checked.
    """
    guild = resolve_guild(request)
    role = resolve_navigator_role(guild, request.app.state.settings)
    operation = "assign-navigator-role"
    succeeded, failed = await assign_role(guild, role, body.discordUserIds, operation, key)
    return respond(operation, key, role, body.discordStudyId, succeeded, failed)


@router.delete("/roles/navigator/users")
async def remove_navigator_role(
    request: Request,
    body: RoleUsersRequest,
    key: str = Depends(idempotency_key),
) -> dict:
    """Take the navigator role from the users.

    The role is guild-wide, so this ends the user's navigator rights in every
    study at once. The bot cannot tell which studies those are; the backend
    calls this only once the user is a navigator in none of them.
    """
    guild = resolve_guild(request)
    role = resolve_navigator_role(guild, request.app.state.settings)
    operation = "remove-navigator-role"
    succeeded, failed = await remove_role(guild, role, body.discordUserIds, operation, key)
    return respond(operation, key, role, body.discordStudyId, succeeded, failed)


# Registered after the fixed /roles/navigator/users paths: FastAPI matches in
# registration order, so the other way round would swallow "navigator" as a
# role ID and answer a snowflake 400.
@router.post("/roles/{discordRoleId}/users")
async def assign_study_role(
    request: Request,
    body: RoleUsersRequest,
    discordRoleId: str = Path(pattern=r"^[0-9]{17,20}$"),
    key: str = Depends(idempotency_key),
) -> dict:
    """Give the role in the path to the users, as many as are in the guild.

    Whether the role belongs to ``discordStudyId`` is not checked: the backend
    sends the pair create-study gave it, and the study ID is only logged.
    """
    guild = resolve_guild(request)
    role = resolve_study_role(guild, request.app.state.settings, int(discordRoleId))
    operation = "assign-role"
    succeeded, failed = await assign_role(guild, role, body.discordUserIds, operation, key)
    return respond(operation, key, role, body.discordStudyId, succeeded, failed)


@router.delete("/roles/{discordRoleId}/users")
async def remove_study_role(
    request: Request,
    body: RoleUsersRequest,
    discordRoleId: str = Path(pattern=r"^[0-9]{17,20}$"),
    key: str = Depends(idempotency_key),
) -> dict:
    """Take the role in the path from the users."""
    guild = resolve_guild(request)
    role = resolve_study_role(guild, request.app.state.settings, int(discordRoleId))
    operation = "remove-role"
    succeeded, failed = await remove_role(guild, role, body.discordUserIds, operation, key)
    return respond(operation, key, role, body.discordStudyId, succeeded, failed)
