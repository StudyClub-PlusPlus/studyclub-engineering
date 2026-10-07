from unittest.mock import AsyncMock, Mock

import discord
import pytest

from app.backend_client import (
    AttendanceResult,
    BackendError,
    BackendUnreachable,
    MarkedGroup,
)
from app.bot.commands import attendance_cmd
from app.bot.commands.attendance_cmd import (
    DISCORD_MESSAGE_LIMIT,
    MAX_GROUPS_SHOWN,
    MAX_NAMES_SHOWN,
    SnapshotRefused,
    collect_snapshot,
    format_backend_error,
    format_result,
)


def _member(member_id: int, name: str, bot: bool = False) -> Mock:
    """Return a stand-in guild member."""
    member = Mock()
    member.id = member_id
    member.display_name = name
    member.bot = bot
    return member


def _voice_channel(members, category_id=900) -> Mock:
    """Return a stand-in voice channel holding ``members``."""
    channel = Mock()
    channel.type = discord.ChannelType.voice
    channel.category_id = category_id
    channel.members = members
    return channel


def _text_channel(category_id=900) -> Mock:
    """Return a stand-in text channel -- the lobby the command must NOT accept."""
    channel = Mock()
    channel.type = discord.ChannelType.text
    channel.category_id = category_id
    return channel


def test_snapshot_reads_the_voice_channel_the_command_was_typed_in():
    """The study id is that channel's category, the list its connected members."""
    captain = _member(1, "반장")
    channel = _voice_channel([captain, _member(2, "학생")], category_id=900)

    snapshot = collect_snapshot(channel, captain)

    assert snapshot.discord_study_id == "900"
    assert snapshot.caller_discord_user_id == "1"
    assert snapshot.discord_user_ids == ["1", "2"]
    assert snapshot.names_by_id == {"1": "반장", "2": "학생"}


def test_snapshot_refuses_a_text_channel():
    """Run from a lobby, the reply would land where another study reads it."""
    with pytest.raises(SnapshotRefused, match="채팅에서"):
        collect_snapshot(_text_channel(), _member(1, "반장"))


def test_snapshot_refuses_a_voice_channel_outside_a_category():
    """No category means no study id to send."""
    channel = _voice_channel([_member(1, "반장")], category_id=None)

    with pytest.raises(SnapshotRefused, match="카테고리"):
        collect_snapshot(channel, _member(1, "반장"))


def test_snapshot_drops_bots():
    """A bot in the room would come back as 'not linked' and inflate that count."""
    channel = _voice_channel(
        [_member(1, "반장"), _member(99, "캡틴 Dev", bot=True), _member(2, "학생")]
    )

    snapshot = collect_snapshot(channel, _member(1, "반장"))

    assert snapshot.discord_user_ids == ["1", "2"]


def test_snapshot_refuses_a_room_with_only_bots():
    """Nothing to send, so nothing is sent."""
    channel = _voice_channel([_member(99, "캡틴 Dev", bot=True)])

    with pytest.raises(SnapshotRefused, match="사람이 없습니다"):
        collect_snapshot(channel, _member(1, "반장"))


def test_result_reports_each_group_and_every_excluded_bucket():
    """One line per group, then one per non-empty bucket."""
    result = AttendanceResult(
        groups=[
            MarkedGroup(70, 41, False, ["1", "2"]),
            MarkedGroup(71, 55, True, ["3"]),
        ],
        unmatched=["4"],
        not_participant=["5"],
        no_meeting=["6"],
    )
    names = {str(i): f"사람{i}" for i in range(1, 7)}

    message = format_result(result, names)

    assert "출석 3명" in message
    assert "(2개 반)" in message
    assert "41번 회차 — 2명" in message
    assert "55번 회차 — 1명 · 회차를 시작했습니다" in message
    assert "계정 미연동 1명 — 사람4" in message
    assert "명부에 없음 1명 — 사람5" in message
    assert "지금 모이는 중이 아닌 반 1명 — 사람6" in message


def test_result_with_nothing_marked_says_so():
    """All unmatched is a normal outcome before account linking exists."""
    message = format_result(AttendanceResult(unmatched=["1", "2"]), {"1": "가", "2": "나"})

    assert message.startswith("출석을 찍은 사람이 없습니다.")
    assert "계정 미연동 2명 — 가, 나" in message


def test_result_truncates_long_name_lists():
    """A wall of names would push the message past Discord's 2000-character cap."""
    ids = [str(i) for i in range(MAX_NAMES_SHOWN + 5)]
    names = {user_id: f"이름{user_id}" for user_id in ids}

    message = format_result(AttendanceResult(unmatched=ids), names)

    assert f"계정 미연동 {len(ids)}명" in message
    assert "외 5명" in message


def test_result_uses_names_not_mentions():
    """Mentions would ping everyone listed as a problem."""
    message = format_result(AttendanceResult(unmatched=["123"]), {"123": "홍길동"})

    assert "홍길동" in message
    assert "<@" not in message


def test_result_falls_back_to_the_id_for_an_unknown_name():
    """The backend can name someone who has since left the room."""
    message = format_result(AttendanceResult(no_meeting=["555"]), {})

    assert "555" in message


@pytest.mark.parametrize(
    "status, expected",
    [
        (400, "봇 문제"),
        (401, "API 키"),
        (403, "권한이 없습니다"),
        (404, "백오피스에 연결되지 않았습니다"),
        # 409 has no branch of its own -- see format_backend_error.
        (409, "백엔드에 문제"),
        (500, "백엔드에 문제"),
        (503, "백엔드에 문제"),
    ],
)
def test_backend_errors_say_what_to_do_about_them(status, expected):
    """The backend's own wording is for developers, so it never reaches the channel."""
    assert expected in format_backend_error(status)


# ── 커맨드 콜백 ────────────────────────────────────────────────────────────
# register() 가 붙이는 콜백을 직접 돌린다. 손으로 밟던 시나리오(회차 자동 시작 ·
# 재시도 · 지금 모이는 중 아님 · 권한 없음)를 백엔드 응답만 갈아끼워 재현하므로,
# 다음 사람이 같은 수동 절차를 밟지 않아도 회귀가 잡힌다.


class _FakeBot:
    """commands.Bot 대역 — @bot.command 로 등록되는 콜백을 잡아 둔다."""

    def __init__(self):
        self.callback = None

    def command(self, name, **kwargs):
        def decorator(func):
            self.callback = func
            return func

        return decorator


def _ctx(channel=None, author=None) -> Mock:
    """Return a stand-in context whose ``send`` records what was posted."""
    ctx = Mock()
    ctx.channel = channel if channel is not None else _voice_channel([_member(1, "반장")])
    ctx.author = author if author is not None else _member(1, "반장")
    ctx.send = AsyncMock()
    return ctx


def _settings(base_url="http://backend:8080", api_key="k") -> Mock:
    settings = Mock()
    settings.backend_base_url = base_url
    settings.api_key = api_key
    return settings


async def _run(monkeypatch, backend, settings=None, ctx=None) -> Mock:
    """Register the command against ``backend`` and run it once; return the ctx."""
    monkeypatch.setattr(attendance_cmd, "mark_attendances", backend)
    bot = _FakeBot()
    attendance_cmd.register(bot, settings or _settings())
    ctx = ctx or _ctx()
    await bot.callback(ctx)
    return ctx


def _sent(ctx) -> str:
    return ctx.send.await_args.args[0]


def _mentions_suppressed(ctx) -> bool:
    """Every reply must suppress mentions -- a name in a list would ping."""
    allowed = ctx.send.await_args.kwargs.get("allowed_mentions")
    return allowed is not None and allowed.everyone is False and allowed.users is False


@pytest.mark.asyncio
async def test_command_reports_a_meeting_it_started(monkeypatch):
    """The captain ran it before the meeting was open, so the backend opened it."""
    backend = AsyncMock(
        return_value=AttendanceResult(groups=[MarkedGroup(70, 9202, True, ["1"])])
    )

    ctx = await _run(monkeypatch, backend)

    assert "출석 1명" in _sent(ctx)
    assert "9202번 회차" in _sent(ctx)
    assert "회차를 시작했습니다" in _sent(ctx)
    assert _mentions_suppressed(ctx)


@pytest.mark.asyncio
async def test_command_on_a_retry_does_not_claim_to_have_started_it(monkeypatch):
    """Running it twice marks the same people; only the first call opens the meeting."""
    backend = AsyncMock(
        return_value=AttendanceResult(groups=[MarkedGroup(70, 9202, False, ["1"])])
    )

    ctx = await _run(monkeypatch, backend)

    assert "9202번 회차 — 1명" in _sent(ctx)
    assert "회차를 시작했습니다" not in _sent(ctx)


@pytest.mark.asyncio
async def test_command_when_the_group_is_not_meeting_now(monkeypatch):
    """A room in use outside its scheduled window marks nobody, and says why."""
    backend = AsyncMock(return_value=AttendanceResult(no_meeting=["1"]))

    ctx = await _run(monkeypatch, backend)

    assert _sent(ctx).startswith("출석을 찍은 사람이 없습니다.")
    assert "지금 모이는 중이 아닌 반 1명 — 반장" in _sent(ctx)


@pytest.mark.asyncio
async def test_command_translates_a_403(monkeypatch):
    """The backend's own wording is for developers, so it never reaches the channel."""
    backend = AsyncMock(side_effect=BackendError(403, "권한이 없습니다."))

    ctx = await _run(monkeypatch, backend)

    assert "권한이 없습니다" in _sent(ctx)
    assert "반장(navigator)만" in _sent(ctx)
    assert _mentions_suppressed(ctx)


@pytest.mark.asyncio
async def test_command_translates_a_404_to_the_missing_link(monkeypatch):
    """Before STUDY_DISCORD_LINK has a row, every call lands here."""
    backend = AsyncMock(side_effect=BackendError(404, "not found"))

    ctx = await _run(monkeypatch, backend)

    assert "백오피스에 연결되지 않았습니다" in _sent(ctx)


@pytest.mark.asyncio
async def test_command_reports_an_unreachable_backend(monkeypatch):
    """A backend that cannot be reached is not a backend that said no."""
    backend = AsyncMock(side_effect=BackendUnreachable("refused"))

    ctx = await _run(monkeypatch, backend)

    assert "연결하지 못했습니다" in _sent(ctx)
    assert _mentions_suppressed(ctx)


@pytest.mark.asyncio
async def test_command_refuses_a_text_channel_without_calling_the_backend(monkeypatch):
    """The refusal is ours to make; the backend never hears about it."""
    backend = AsyncMock()

    ctx = await _run(monkeypatch, backend, ctx=_ctx(channel=_text_channel()))

    assert "채팅에서" in _sent(ctx)
    backend.assert_not_awaited()
    assert _mentions_suppressed(ctx)


@pytest.mark.asyncio
async def test_command_refuses_when_the_backend_is_not_configured(monkeypatch):
    """A deployment without API_BASE_URL answers, rather than failing silently."""
    backend = AsyncMock()

    ctx = await _run(monkeypatch, backend, settings=_settings(base_url=None))

    assert "백엔드 연결이 설정되지 않았습니다" in _sent(ctx)
    backend.assert_not_awaited()


@pytest.mark.asyncio
async def test_command_sends_the_snapshot_the_backend_contract_expects(monkeypatch):
    """Study id, caller and member list are all read off the one voice channel."""
    backend = AsyncMock(return_value=AttendanceResult())
    captain = _member(1, "반장")
    channel = _voice_channel([captain, _member(2, "학생"), _member(9, "봇", bot=True)], 900)

    await _run(monkeypatch, backend, ctx=_ctx(channel=channel, author=captain))

    base, key, study_id, caller, user_ids = backend.await_args.args
    assert (base, key) == ("http://backend:8080", "k")
    assert study_id == "900"
    assert caller == "1"
    assert user_ids == ["1", "2"]


def test_result_caps_the_number_of_group_lines():
    """A study's 반 share one voice room, so many groups can come back at once."""
    groups = [MarkedGroup(i, 1000 + i, False, [str(i)]) for i in range(MAX_GROUPS_SHOWN + 4)]

    message = format_result(AttendanceResult(groups=groups), {})

    assert message.count("번 회차 —") == MAX_GROUPS_SHOWN
    assert "외 4개 반" in message


def test_result_stays_inside_discords_message_limit():
    """Overflowing would fail the reply *after* attendance was already written."""
    groups = [MarkedGroup(i, i, False, [str(i)]) for i in range(100)]
    ids = [str(i) for i in range(100)]
    names = {i: "아주아주긴닉네임" * 5 for i in ids}

    message = format_result(
        AttendanceResult(groups=groups, unmatched=ids, not_participant=ids, no_meeting=ids),
        names,
    )

    assert len(message) <= DISCORD_MESSAGE_LIMIT


@pytest.mark.asyncio
async def test_command_reports_an_unreadable_200_as_a_backend_problem(monkeypatch):
    """A 200 we cannot parse must still get the captain a reply."""
    backend = AsyncMock(side_effect=BackendError(200, "unreadable 200 body: KeyError"))

    ctx = await _run(monkeypatch, backend)

    assert "백엔드에 문제가 있습니다" in _sent(ctx)
    assert _mentions_suppressed(ctx)
