"""Calls the StudyClub backend.

Everything else in this service answers calls *from* the backend; this is the
one place that calls *out* to it. The contract is
``specs/discord-attendance/spec.md``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import httpx

# The backend picks the meeting itself, so a call can wait on a row lock while
# another request for the same group finishes. Long enough to outlast that,
# short enough that a captain is not left staring at the channel.
REQUEST_TIMEOUT_SECONDS = 10.0


@dataclass(frozen=True)
class MarkedGroup:
    study_group_id: int
    study_meeting_id: int
    meeting_started: bool
    marked: list[str]


@dataclass(frozen=True)
class AttendanceResult:
    """A 200 from the backend, split the way the contract splits it."""

    groups: list[MarkedGroup] = field(default_factory=list)
    unmatched: list[str] = field(default_factory=list)
    not_participant: list[str] = field(default_factory=list)
    no_meeting: list[str] = field(default_factory=list)

    @property
    def marked_count(self) -> int:
        return sum(len(group.marked) for group in self.groups)


class BackendError(Exception):
    """The backend answered, but not with a 200.

    ``status`` is what the caller branches on -- the body's wording is for the
    logs, not for the channel, because it is written for developers.
    """

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(f"backend returned {status}: {detail}")
        self.status = status
        self.detail = detail


class BackendUnreachable(Exception):
    """DNS failure, refused connection, or timeout -- the backend never answered."""


async def mark_attendances(
    base_url: str,
    api_key: str,
    discord_study_id: str,
    caller_discord_user_id: str,
    discord_user_ids: list[str],
) -> AttendanceResult:
    url = f"{base_url}/api/discord/studies/{discord_study_id}/attendances"
    payload = {
        "callerDiscordUserId": caller_discord_user_id,
        "discordUserIds": discord_user_ids,
    }
    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = await client.post(url, json=payload, headers={"X-API-Key": api_key})
    except httpx.HTTPError as exc:
        raise BackendUnreachable(str(exc)) from exc

    if response.status_code != 200:
        raise BackendError(response.status_code, _detail_of(response))
    return _parse(response.json())


def _detail_of(response: httpx.Response) -> str:
    """Pull the backend's message out, whatever shape the error body took."""
    try:
        body = response.json()
    except ValueError:
        return response.text[:200]
    if isinstance(body, dict):
        # Spring's ErrorCode body, then the shape Spring's own handlers use.
        for key in ("errorMessage", "message", "detail", "error"):
            value = body.get(key)
            if isinstance(value, str) and value:
                return value
    return str(body)[:200]


def _parse(body: dict) -> AttendanceResult:
    """Build :class:`AttendanceResult`, tolerating fields the backend omits."""
    return AttendanceResult(
        groups=[
            MarkedGroup(
                study_group_id=group["studyGroupId"],
                study_meeting_id=group["studyMeetingId"],
                meeting_started=bool(group.get("meetingStarted")),
                marked=list(group.get("marked") or []),
            )
            for group in body.get("groups") or []
        ],
        unmatched=list(body.get("unmatched") or []),
        not_participant=list(body.get("notParticipant") or []),
        no_meeting=list(body.get("noMeeting") or []),
    )
