"""The ``!출석체크`` command.

A captain standing in the study's voice room runs this and everyone in the
room is marked present. The bot only collects and reports -- which meeting,
which group, and what to overwrite are all decided by the backend
(``specs/discord-attendance/spec.md``), because the timestamps that decide
them live there.

As with the other commands, the work is in plain functions so it can be unit
tested without a Discord connection; ``register`` only wires them together.
"""

from __future__ import annotations

from dataclasses import dataclass

import discord
from discord.ext import commands

from app.backend_client import (
    AttendanceResult,
    BackendError,
    BackendUnreachable,
    mark_attendances,
)

COMMAND_NAME = "출석체크"
# Long member lists would push the message past Discord's 2000-character cap,
# and a wall of names is not read anyway.
MAX_NAMES_SHOWN = 10


@dataclass(frozen=True)
class Snapshot:
    """What the backend needs: who ran the command, and who was in the room."""

    discord_study_id: str
    caller_discord_user_id: str
    discord_user_ids: list[str]
    # Only used to write the reply; the backend never sees these.
    names_by_id: dict[str, str]


class SnapshotRefused(Exception):
    """The command cannot be answered, and the reason is the captain's to fix."""


def collect_snapshot(author: discord.Member) -> Snapshot:
    """Read the voice room ``author`` is sitting in.

    Both the member list and the study id come from the *same* voice channel.
    Taking the study id from the text channel the command was typed in instead
    would let a captain standing in study B's room send B's members under A's
    id: the backend would find none of them on A's roster and answer 200 with
    everyone in ``notParticipant``, which looks like success.
    """
    voice_state = author.voice
    channel = voice_state.channel if voice_state else None
    if channel is None:
        raise SnapshotRefused("공부방(음성 채널)에 들어간 뒤에 다시 쳐주세요.")

    if channel.category_id is None:
        raise SnapshotRefused(
            "이 공부방은 스터디 카테고리 아래에 있지 않습니다. 스터디 공부방에서 쳐주세요."
        )

    # Bots sitting in the room would come back as "not linked" and inflate that
    # count, so they never go out.
    members = [member for member in channel.members if not member.bot]
    if not members:
        raise SnapshotRefused("공부방에 사람이 없습니다.")

    return Snapshot(
        discord_study_id=str(channel.category_id),
        caller_discord_user_id=str(author.id),
        discord_user_ids=[str(member.id) for member in members],
        names_by_id={str(member.id): member.display_name for member in members},
    )


def format_result(result: AttendanceResult, names_by_id: dict[str, str]) -> str:
    """Turn the backend's four buckets into one message for the channel."""
    lines: list[str] = []

    if result.marked_count:
        group_word = f" ({len(result.groups)}개 반)" if len(result.groups) > 1 else ""
        lines.append(f"✅ 출석 {result.marked_count}명 체크했습니다.{group_word}")
        for group in result.groups:
            started = " · 회차를 시작했습니다" if group.meeting_started else ""
            lines.append(f"· {group.study_meeting_id}번 회차 — {len(group.marked)}명{started}")
    else:
        lines.append("출석을 찍은 사람이 없습니다.")

    for label, ids in (
        ("계정 미연동", result.unmatched),
        ("명부에 없음", result.not_participant),
        ("지금 모이는 중이 아닌 반", result.no_meeting),
    ):
        if ids:
            lines.append(f"⚠️ {label} {len(ids)}명 — {_names(ids, names_by_id)}")

    return "\n".join(lines)


def format_backend_error(status: int) -> str:
    """Say what the captain can do about ``status``, in their words."""
    if status == 400:
        return "⚠️ 요청이 올바르지 않습니다. 봇 문제일 수 있으니 운영자에게 알려주세요."
    if status == 401:
        return "⚠️ 봇과 백엔드의 API 키가 맞지 않습니다. 운영자에게 알려주세요."
    if status == 403:
        return (
            "⚠️ 출석을 찍을 권한이 없습니다. 이 스터디의 반장만 쓸 수 있고, "
            "디스코드 계정 연동이 되어 있어야 합니다."
        )
    if status == 404:
        return "⚠️ 이 스터디는 아직 백오피스에 연결되지 않았습니다. 운영자에게 알려주세요."
    # No 409 branch: the backend no longer refuses when several meetings are
    # candidates -- it picks the nearest one (#111 review). Anything else is
    # ours to fix, not the captain's, so one message covers it.
    return "⚠️ 백엔드에 문제가 있습니다. 잠시 후 다시 시도해주세요."


def _names(ids: list[str], names_by_id: dict[str, str]) -> str:
    """Names, not mentions -- a mention would ping everyone in the list."""
    shown = [names_by_id.get(user_id, user_id) for user_id in ids[:MAX_NAMES_SHOWN]]
    rest = len(ids) - len(shown)
    return ", ".join(shown) + (f" 외 {rest}명" if rest > 0 else "")


def register(bot: commands.Bot, settings) -> None:
    """Attach ``!출석체크`` to ``bot``."""

    @bot.command(name=COMMAND_NAME)
    async def attendance(ctx: commands.Context) -> None:  # pragma: no cover - thin wrapper
        """Mark everyone in the captain's voice room present."""
        # Mentions in a name would ping; the reply is a report, not a call-out.
        silent = discord.AllowedMentions.none()

        if not settings.backend_base_url or not settings.api_key:
            await ctx.send(
                "⚠️ 백엔드 연결이 설정되지 않았습니다. 운영자에게 알려주세요.",
                allowed_mentions=silent,
            )
            return

        try:
            snapshot = collect_snapshot(ctx.author)
        except SnapshotRefused as refusal:
            await ctx.send(str(refusal), allowed_mentions=silent)
            return

        try:
            result = await mark_attendances(
                settings.backend_base_url,
                settings.api_key,
                snapshot.discord_study_id,
                snapshot.caller_discord_user_id,
                snapshot.discord_user_ids,
            )
        except BackendError as exc:
            await ctx.send(format_backend_error(exc.status), allowed_mentions=silent)
            return
        except BackendUnreachable:
            await ctx.send(
                "⚠️ 백엔드에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.",
                allowed_mentions=silent,
            )
            return

        await ctx.send(format_result(result, snapshot.names_by_id), allowed_mentions=silent)
