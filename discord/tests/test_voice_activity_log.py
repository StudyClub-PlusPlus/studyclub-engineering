import datetime

import pytest

from app.study_reservations import StudyReservations
from app.voice_activity_log import VoiceActivityLog

CHANNEL_ID = 1327394882193883138
OTHER_CHANNEL_ID = 1327394882193883139
MONDAY = datetime.datetime(2026, 9, 7, 3, 0, tzinfo=datetime.timezone.utc)
TUESDAY = MONDAY + datetime.timedelta(days=1)


@pytest.fixture
def log(tmp_path) -> VoiceActivityLog:
    return VoiceActivityLog(str(tmp_path / "discord.sqlite3"))


def test_observe_starts_watching_a_channel(log):
    """A new channel gets a row with no activity yet, so its clock starts now."""
    log.observe([CHANNEL_ID], MONDAY)

    row = log.rows()[CHANNEL_ID]
    assert row.first_seen_at == MONDAY
    assert row.last_activity_at is None
    assert row.last_alerted_at is None


def test_observe_leaves_a_known_channel_alone(log):
    """It runs on every check, so moving first_seen_at would reset the clock."""
    log.observe([CHANNEL_ID], MONDAY)
    log.touch(CHANNEL_ID, MONDAY)

    log.observe([CHANNEL_ID, OTHER_CHANNEL_ID], TUESDAY)

    rows = log.rows()
    assert rows[CHANNEL_ID] == (MONDAY, MONDAY, None)
    assert rows[OTHER_CHANNEL_ID].first_seen_at == TUESDAY


def test_touch_creates_the_row_when_the_channel_is_new(log):
    """A join can arrive before any check has registered the channel."""
    log.touch(CHANNEL_ID, MONDAY)

    assert log.rows()[CHANNEL_ID] == (MONDAY, MONDAY, None)


def test_touch_clears_the_alert_mark(log):
    """The room is alive again, so the next silence is a new thing to report."""
    log.observe([CHANNEL_ID], MONDAY)
    log.mark_alerted([CHANNEL_ID], MONDAY)
    assert log.rows()[CHANNEL_ID].last_alerted_at == MONDAY

    log.touch(CHANNEL_ID, TUESDAY)

    row = log.rows()[CHANNEL_ID]
    assert row.last_activity_at == TUESDAY
    assert row.last_alerted_at is None
    assert row.first_seen_at == MONDAY


def test_mark_alerted_marks_only_what_it_was_given(log):
    log.observe([CHANNEL_ID, OTHER_CHANNEL_ID], MONDAY)

    log.mark_alerted([CHANNEL_ID], TUESDAY)

    rows = log.rows()
    assert rows[CHANNEL_ID].last_alerted_at == TUESDAY
    assert rows[OTHER_CHANNEL_ID].last_alerted_at is None


def test_mark_alerted_skips_a_channel_used_since_the_check(log):
    """A join that lands while the alert is being posted must not be buried under the mark."""
    log.touch(CHANNEL_ID, TUESDAY)

    log.mark_alerted([CHANNEL_ID], MONDAY)

    assert log.rows()[CHANNEL_ID].last_alerted_at is None


def test_forget_removes_the_row(log):
    """A deleted channel leaves the table, so the table follows the guild."""
    log.observe([CHANNEL_ID, OTHER_CHANNEL_ID], MONDAY)

    log.forget(CHANNEL_ID)

    assert set(log.rows()) == {OTHER_CHANNEL_ID}


def test_forget_an_unknown_channel_is_not_an_error(log):
    """The same deletion event arrives for text channels, which never had a row."""
    log.forget(CHANNEL_ID)  # must not raise

    assert log.rows() == {}


def test_the_table_shares_the_file_with_study_reservations(tmp_path):
    """One SQLite file, two features: neither CREATE TABLE disturbs the other."""
    path = str(tmp_path / "discord.sqlite3")
    reservations = StudyReservations(path)
    log = VoiceActivityLog(path)

    assert reservations.reserve("알고리즘 스터디", "key") is True
    log.touch(CHANNEL_ID, MONDAY)

    assert reservations.reserve("알고리즘 스터디", "key") is False
    assert set(log.rows()) == {CHANNEL_ID}


def test_rows_is_empty_before_anything_is_recorded(log):
    """The first read creates the table rather than failing on a missing one."""
    assert log.rows() == {}
