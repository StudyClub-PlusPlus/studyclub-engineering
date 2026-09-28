from unittest.mock import Mock

import pytest

from app.backend_client import AttendanceResult, MarkedGroup
from app.bot.commands.attendance_cmd import (
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
    channel.category_id = category_id
    channel.members = members
    return channel


def _author(member_id=1, name="반장", channel=None) -> Mock:
    """Return a stand-in author sitting in ``channel`` (or in no channel)."""
    author = _member(member_id, name)
    author.voice = Mock(channel=channel) if channel is not None else None
    return author


def test_snapshot_reads_the_voice_room_the_caller_is_in():
    """The study id is the voice channel's category, the list its members."""
    captain = _member(1, "반장")
    channel = _voice_channel([captain, _member(2, "학생")], category_id=900)
    author = _author(channel=channel)
    author.voice = Mock(channel=channel)

    snapshot = collect_snapshot(author)

    assert snapshot.discord_study_id == "900"
    assert snapshot.caller_discord_user_id == "1"
    assert snapshot.discord_user_ids == ["1", "2"]
    assert snapshot.names_by_id == {"1": "반장", "2": "학생"}


def test_snapshot_ignores_the_text_channel_the_command_was_typed_in():
    """Only the voice channel decides the study -- see collect_snapshot's docstring."""
    channel = _voice_channel([_member(1, "반장")], category_id=777)
    author = _author(channel=channel)
    # A text channel under a different study would be the wrong source.
    author.guild = Mock()

    assert collect_snapshot(author).discord_study_id == "777"


def test_snapshot_refuses_when_the_caller_is_not_in_a_voice_channel():
    """Without a room there is no snapshot to take."""
    with pytest.raises(SnapshotRefused, match="공부방"):
        collect_snapshot(_author())


def test_snapshot_refuses_a_voice_channel_outside_a_category():
    """No category means no study id to send."""
    channel = _voice_channel([_member(1, "반장")], category_id=None)

    with pytest.raises(SnapshotRefused, match="카테고리"):
        collect_snapshot(_author(channel=channel))


def test_snapshot_drops_bots():
    """A bot in the room would come back as 'not linked' and inflate that count."""
    channel = _voice_channel(
        [_member(1, "반장"), _member(99, "캡틴 Dev", bot=True), _member(2, "학생")]
    )

    snapshot = collect_snapshot(_author(channel=channel))

    assert snapshot.discord_user_ids == ["1", "2"]


def test_snapshot_refuses_a_room_with_only_bots():
    """Nothing to send, so nothing is sent."""
    channel = _voice_channel([_member(99, "캡틴 Dev", bot=True)])

    with pytest.raises(SnapshotRefused, match="사람이 없습니다"):
        collect_snapshot(_author(channel=channel))


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
