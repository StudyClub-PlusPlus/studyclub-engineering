import datetime
import sqlite3
from unittest.mock import AsyncMock, Mock
from zoneinfo import ZoneInfo

import discord
import pytest

from app.bot import voice_monitor
from app.config import Settings
from app.voice_activity_log import Activity, VoiceActivityLog

GUILD_ID = 100000000000000001
OTHER_GUILD_ID = 100000000000000009
ALERT_CHANNEL_ID = 200000000000000002
ANCHOR = voice_monitor.DEFAULT_NEW_STUDY_ANCHOR_NAME
NOW = datetime.datetime(2026, 9, 30, 3, 0, tzinfo=datetime.timezone.utc)
# 2026-09-30 03:00Z is 2026-09-29 20:00 Pacific -- the date the club would say.
PACIFIC_TODAY = "2026-09-29"


def _settings(**overrides) -> Settings:
    return Settings(
        **{"guild_id": GUILD_ID, "alert_channel_id": ALERT_CHANNEL_ID, **overrides}
    )


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


def _voice(channel_id, name="공부방-알고리즘", visible=True, occupied=False) -> Mock:
    voice = Mock(spec=discord.VoiceChannel, id=channel_id)
    voice.name = name
    voice.permissions_for.return_value = Mock(view_channel=visible)
    voice.voice_states = {999: Mock()} if occupied else {}
    return voice


def _category(name, voice_channels=()) -> Mock:
    category = Mock(spec=discord.CategoryChannel)
    category.name = name
    category.voice_channels = list(voice_channels)
    return category


def _text_channel(channel_id) -> Mock:
    channel = Mock(spec=discord.TextChannel, id=channel_id)
    channel.permissions_for.return_value = Mock(view_channel=True)
    channel.send = AsyncMock()
    return channel


class FakeGuild:
    """A guild whose sidebar holds an operational category, the anchor, and studies."""

    def __init__(self, categories=None, channels=None):
        self.me = Mock(name="bot member")
        self.id = GUILD_ID
        self.categories = (
            categories
            if categories is not None
            else [
                _category("운영진 전용", [_voice(1, "회의실")]),
                _category(ANCHOR),
                _category("알고리즘 스터디", [_voice(2), _voice(3, "공부방-2조")]),
                _category("CS 전공", [_voice(4, "공부방-CS")]),
            ]
        )
        self.alert_channel = _text_channel(ALERT_CHANNEL_ID)
        self.channels = channels if channels is not None else {ALERT_CHANNEL_ID: self.alert_channel}

    def get_channel(self, channel_id):
        return self.channels.get(channel_id)


def _bot(guild) -> Mock:
    bot = Mock()
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    return bot


@pytest.fixture
def log(tmp_path) -> VoiceActivityLog:
    return VoiceActivityLog(str(tmp_path / "discord.sqlite3"))


# --- collect_study_voice_channels ------------------------------------------


def test_collect_takes_everything_below_the_anchor():
    """The anchor and everything above it are left out; order is the sidebar's."""
    guild = FakeGuild()

    collected = voice_monitor.collect_study_voice_channels(guild, ANCHOR)

    assert [(category.name, [v.id for v in voices]) for category, voices in collected] == [
        ("알고리즘 스터디", [2, 3]),
        ("CS 전공", [4]),
    ]


def test_collect_without_the_anchor_returns_none():
    """Without the anchor the staff meeting room would be judged as a study."""
    guild = FakeGuild(categories=[_category("운영진 전용", [_voice(1)])])

    assert voice_monitor.collect_study_voice_channels(guild, ANCHOR) is None


def test_collect_uses_the_topmost_duplicate_anchor():
    """Same rule as create_study and the bulletin, so all three agree."""
    guild = FakeGuild(
        categories=[
            _category(ANCHOR),
            _category("알고리즘 스터디", [_voice(2)]),
            _category(ANCHOR),
            _category("CS 전공", [_voice(4)]),
        ]
    )

    collected = voice_monitor.collect_study_voice_channels(guild, ANCHOR)
    assert [category.name for category, _ in collected] == ["알고리즘 스터디", ANCHOR, "CS 전공"]


def test_collect_drops_voice_channels_the_bot_cannot_see():
    """A channel the bot cannot see is one it cannot record activity for either."""
    guild = FakeGuild(
        categories=[
            _category(ANCHOR),
            _category("알고리즘 스터디", [_voice(2), _voice(3, visible=False)]),
        ]
    )

    collected = voice_monitor.collect_study_voice_channels(guild, ANCHOR)
    assert [v.id for _, voices in collected for v in voices] == [2]


# --- the date column -------------------------------------------------------


def test_format_date_uses_the_clubs_timezone():
    """An evening session keeps the date the club would call it."""
    assert voice_monitor.format_date(NOW) == PACIFIC_TODAY


def test_activity_label_shows_the_last_join_or_leave():
    assert voice_monitor.activity_label(Activity(NOW, NOW, None)) == PACIFIC_TODAY


def test_activity_label_says_how_long_we_have_been_watching_instead():
    """An empty column would read as "ancient"; this says what we actually know."""
    label = voice_monitor.activity_label(Activity(NOW, None, None))

    assert label == voice_monitor.NO_RECORD.format(date=PACIFIC_TODAY)


# --- inactive_channel_ids --------------------------------------------------


@pytest.mark.parametrize(
    "days, expected",
    [(20, set()), (21, {2}), (22, {2})],
)
def test_inactive_channel_ids_at_the_threshold(days, expected):
    """Three weeks exactly counts; one day short does not."""
    rows = {2: Activity(NOW - datetime.timedelta(days=60), NOW - datetime.timedelta(days=days), None)}

    assert voice_monitor.inactive_channel_ids(rows, [2], NOW) == expected


def test_inactive_channel_ids_measures_a_new_channel_from_first_seen():
    """A 공부방 created yesterday is not reported today."""
    rows = {
        2: Activity(NOW - datetime.timedelta(days=1), None, None),
        3: Activity(NOW - datetime.timedelta(days=30), None, None),
    }

    assert voice_monitor.inactive_channel_ids(rows, [2, 3], NOW) == {3}


def test_inactive_channel_ids_skips_what_was_already_reported():
    """A list that arrives every day is a list nobody reads."""
    quiet = NOW - datetime.timedelta(days=40)
    rows = {2: Activity(quiet, quiet, NOW - datetime.timedelta(days=1))}

    assert voice_monitor.inactive_channel_ids(rows, [2], NOW) == set()


# --- the two message formats ----------------------------------------------


def _entries(count=2):
    return [("알고리즘 스터디", f"공부방-{i}", "2026-08-20") for i in range(count)]


def test_build_activity_report_uses_a_colon_before_the_date():
    """``카테고리 - 공부방 : 날짜``: a dash everywhere hides where the name ends."""
    report = voice_monitor.build_activity_report(
        [("알고리즘 스터디", "공부방-알고리즘 스터디", "2026-08-20")]
    )

    assert report == ["알고리즘 스터디 - 공부방-알고리즘 스터디 : 2026-08-20"]


def test_build_activity_report_with_nothing_to_list_says_so():
    """Discord refuses an empty message."""
    assert voice_monitor.build_activity_report([]) == [voice_monitor.EMPTY_REPORT]


def test_build_activity_report_splits_rather_than_truncates():
    """The caller asked for the whole list, so none of it is dropped."""
    report = voice_monitor.build_activity_report(_entries(200))

    assert len(report) > 1
    assert all(len(message) <= voice_monitor.MAX_MSG for message in report)
    assert sum(len(message.split("\n")) for message in report) == 200


def test_build_inactivity_alert_heads_the_list_with_the_count_and_the_date():
    content = voice_monitor.build_inactivity_alert(_entries(2), PACIFIC_TODAY)

    assert content.split("\n")[0] == voice_monitor.ALERT_HEADER.format(
        weeks=3, days=21, count=2, today=PACIFIC_TODAY
    )
    assert len(content.split("\n")) == 3


def test_build_inactivity_alert_with_nothing_to_report_is_empty():
    """Nothing to say is said by not sending a message at all."""
    assert voice_monitor.build_inactivity_alert([], PACIFIC_TODAY) == ""


def test_build_inactivity_alert_truncates_whole_lines_and_counts_the_rest():
    """A shortened signal still signals, and the command prints the full list."""
    content = voice_monitor.build_inactivity_alert(_entries(200), PACIFIC_TODAY)

    assert len(content) <= voice_monitor.MAX_MSG
    lines = content.split("\n")
    omitted = 200 - (len(lines) - 2)  # header and notice are not entries
    assert lines[-1] == voice_monitor.TRUNCATED_NOTICE.format(count=omitted)


# --- record_activity -------------------------------------------------------


def _member(bot=False, guild_id=GUILD_ID) -> Mock:
    member = Mock(spec=discord.Member, id=42, bot=bot)
    member.guild = Mock(id=guild_id)
    return member


def _state(channel) -> Mock:
    return Mock(spec=discord.VoiceState, channel=channel)


async def test_record_activity_writes_a_join():
    log = Mock()
    joined = _voice(2)

    await voice_monitor.record_activity(log, _settings(), _member(), _state(None), _state(joined))

    assert [call.args[0] for call in log.touch.call_args_list] == [2]


async def test_record_activity_writes_a_leave():
    """Leaving is activity too -- it says someone was in there until now."""
    log = Mock()
    left = _voice(2)

    await voice_monitor.record_activity(log, _settings(), _member(), _state(left), _state(None))

    assert [call.args[0] for call in log.touch.call_args_list] == [2]


async def test_record_activity_writes_both_rooms_on_a_move():
    log = Mock()

    await voice_monitor.record_activity(
        log, _settings(), _member(), _state(_voice(2)), _state(_voice(3))
    )

    assert [call.args[0] for call in log.touch.call_args_list] == [2, 3]


async def test_record_activity_ignores_a_mute():
    """The event also fires for mute, deafen, camera and screen share."""
    log = Mock()
    same = _voice(2)

    await voice_monitor.record_activity(log, _settings(), _member(), _state(same), _state(same))

    log.touch.assert_not_called()


async def test_record_activity_ignores_bots():
    """A music bot parked in a room does not make it used."""
    log = Mock()

    await voice_monitor.record_activity(
        log, _settings(), _member(bot=True), _state(None), _state(_voice(2))
    )

    log.touch.assert_not_called()


async def test_record_activity_ignores_other_guilds():
    log = Mock()

    await voice_monitor.record_activity(
        log, _settings(), _member(guild_id=OTHER_GUILD_ID), _state(None), _state(_voice(2))
    )

    log.touch.assert_not_called()


async def test_record_activity_survives_a_broken_table(caplog):
    """A join must not raise out of a listener nobody is waiting on."""
    log = Mock()
    log.touch.side_effect = sqlite3.OperationalError("disk I/O error")

    with caplog.at_level("ERROR"):
        await voice_monitor.record_activity(
            log, _settings(), _member(), _state(None), _state(_voice(2))
        )

    assert "could not record activity" in caplog.text


# --- forget_channel --------------------------------------------------------


def _deleted(spec=discord.VoiceChannel, channel_id=2, guild_id=GUILD_ID) -> Mock:
    channel = Mock(spec=spec, id=channel_id)
    channel.guild = Mock(id=guild_id)
    return channel


async def test_forget_channel_drops_a_deleted_voice_channel():
    log = Mock()

    await voice_monitor.forget_channel(log, _settings(), _deleted())

    log.forget.assert_called_once_with(2)


@pytest.mark.parametrize("spec", [discord.TextChannel, discord.CategoryChannel])
async def test_forget_channel_ignores_channels_that_never_had_a_row(spec):
    log = Mock()

    await voice_monitor.forget_channel(log, _settings(), _deleted(spec=spec))

    log.forget.assert_not_called()


async def test_forget_channel_ignores_other_guilds():
    log = Mock()

    await voice_monitor.forget_channel(log, _settings(), _deleted(guild_id=OTHER_GUILD_ID))

    log.forget.assert_not_called()


async def test_forget_channel_survives_a_broken_table(caplog):
    log = Mock()
    log.forget.side_effect = sqlite3.OperationalError("disk I/O error")

    with caplog.at_level("ERROR"):
        await voice_monitor.forget_channel(log, _settings(), _deleted())

    assert "could not forget" in caplog.text


# --- record_snapshot -------------------------------------------------------


def test_record_snapshot_registers_every_channel_and_credits_the_occupied(log):
    """A room in constant use produced one event a month ago; it is credited here."""
    busy = _voice(2, occupied=True)
    empty = _voice(3)

    voice_monitor.record_snapshot(log, [busy, empty], NOW)

    rows = log.rows()
    assert rows[2].last_activity_at == NOW
    assert rows[3].last_activity_at is None


# --- check_inactivity ------------------------------------------------------


async def test_check_inactivity_reports_the_quiet_rooms_and_marks_them(log):
    """One message naming the quiet rooms, and no second one tomorrow."""
    guild = FakeGuild()
    long_ago = NOW - datetime.timedelta(days=40)
    log.touch(2, long_ago)
    log.touch(3, NOW)
    log.touch(4, long_ago)

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)

    guild.alert_channel.send.assert_awaited_once()
    content = guild.alert_channel.send.await_args[0][0]
    assert "알고리즘 스터디 - 공부방-알고리즘 : 2026-08-20" in content
    assert "CS 전공 - 공부방-CS : 2026-08-20" in content
    assert "공부방-2조" not in content
    # Nobody is notified, not even by a study named @everyone.
    assert guild.alert_channel.send.await_args.kwargs["allowed_mentions"].everyone is False

    rows = log.rows()
    assert rows[2].last_alerted_at is not None and rows[4].last_alerted_at is not None
    assert rows[3].last_alerted_at is None

    guild.alert_channel.send.reset_mock()
    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)
    guild.alert_channel.send.assert_not_awaited()


async def test_check_inactivity_says_nothing_when_every_room_is_in_use(log):
    """"All fine" posted daily would train everyone to ignore the channel."""
    guild = FakeGuild()

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)

    # First run: every channel is registered, so nothing is old enough yet.
    guild.alert_channel.send.assert_not_awaited()
    assert set(log.rows()) == {2, 3, 4}


async def test_check_inactivity_credits_an_occupied_room_before_judging(log):
    """Someone who joined a month ago and never left is still using the room."""
    guild = FakeGuild(
        categories=[
            _category(ANCHOR),
            _category("알고리즘 스터디", [_voice(2, occupied=True)]),
        ]
    )
    log.touch(2, NOW - datetime.timedelta(days=40))

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)

    guild.alert_channel.send.assert_not_awaited()


async def test_check_inactivity_judges_nothing_without_the_anchor(log):
    """The staff meeting room must never be reported as a dead study."""
    guild = FakeGuild(categories=[_category("운영진 전용", [_voice(1)])])

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)

    guild.alert_channel.send.assert_awaited_once()
    assert ANCHOR in guild.alert_channel.send.await_args[0][0]
    assert log.rows() == {}


async def test_check_inactivity_without_a_guild_id_does_nothing(log):
    guild = FakeGuild()

    await voice_monitor.check_inactivity(_bot(guild), _settings(guild_id=None), log)

    guild.alert_channel.send.assert_not_awaited()
    assert log.rows() == {}


async def test_check_inactivity_without_an_alert_channel_id_still_takes_the_snapshot(log):
    """A room nobody joins gets its row now, not on the day the channel is configured."""
    guild = FakeGuild(
        categories=[
            _category(ANCHOR),
            _category("알고리즘 스터디", [_voice(2, occupied=True), _voice(3, "공부방-2조")]),
        ]
    )
    log.touch(3, NOW - datetime.timedelta(days=40))

    await voice_monitor.check_inactivity(_bot(guild), _settings(alert_channel_id=None), log)

    guild.alert_channel.send.assert_not_awaited()
    rows = log.rows()
    assert rows[2].last_activity_at is not None
    # Unmarked, so the first check with a channel still reports it.
    assert rows[3].last_alerted_at is None


async def test_check_inactivity_without_an_alert_channel_id_or_the_anchor_does_nothing(log):
    guild = FakeGuild(categories=[_category("운영진 전용", [_voice(1)])])

    await voice_monitor.check_inactivity(_bot(guild), _settings(alert_channel_id=None), log)

    guild.alert_channel.send.assert_not_awaited()
    assert log.rows() == {}


async def test_check_inactivity_without_the_guild_does_nothing(log):
    """Before the guild is cached there is nowhere to look and nowhere to complain."""
    bot = Mock()
    bot.get_guild.return_value = None

    await voice_monitor.check_inactivity(bot, _settings(), log)  # must not raise


async def test_check_inactivity_without_the_alert_channel_still_takes_the_snapshot(log, caplog):
    """A broken channel setting is a server problem, reported to the log -- not a reason to stop recording."""
    guild = FakeGuild(channels={})

    with caplog.at_level("ERROR"):
        await voice_monitor.check_inactivity(_bot(guild), _settings(), log)  # must not raise

    assert "voice monitor:" in caplog.text
    assert set(log.rows()) == {2, 3, 4}


async def test_check_inactivity_leaves_the_rows_unmarked_when_the_send_fails(log):
    """Tomorrow's check reports them again rather than losing the report."""
    guild = FakeGuild()
    guild.alert_channel.send = AsyncMock(side_effect=_discord_error(discord.Forbidden, 403))
    log.touch(2, NOW - datetime.timedelta(days=40))

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)  # must not raise

    assert log.rows()[2].last_alerted_at is None


async def test_check_inactivity_does_not_mark_a_room_joined_during_the_send(log):
    """The mark would outlive the join that should have cleared it, hiding the next quiet streak."""
    guild = FakeGuild()
    long_ago = NOW - datetime.timedelta(days=40)
    log.touch(2, long_ago)
    log.touch(4, long_ago)

    async def join_while_sending(*args, **kwargs):
        log.touch(2, voice_monitor.now_utc())

    guild.alert_channel.send = AsyncMock(side_effect=join_while_sending)

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)

    rows = log.rows()
    assert rows[2].last_alerted_at is None
    assert rows[4].last_alerted_at is not None


async def test_check_inactivity_survives_a_rejected_send(log):
    guild = FakeGuild()
    guild.alert_channel.send = AsyncMock(side_effect=_discord_error())
    log.touch(2, NOW - datetime.timedelta(days=40))

    await voice_monitor.check_inactivity(_bot(guild), _settings(), log)  # must not raise


async def test_check_inactivity_survives_a_broken_table(log, caplog):
    guild = FakeGuild()
    broken = Mock()
    broken.observe.side_effect = sqlite3.OperationalError("disk I/O error")

    with caplog.at_level("ERROR"):
        await voice_monitor.check_inactivity(_bot(guild), _settings(), broken)

    assert "could not read the activity table" in caplog.text
    guild.alert_channel.send.assert_not_awaited()


# --- register --------------------------------------------------------------


async def test_register_listens_for_joins_and_deletions():
    bot = Mock()
    bot.setup_hook = AsyncMock()

    voice_monitor.register(bot, _settings())

    assert {call.args[1] for call in bot.add_listener.call_args_list} == {
        "on_voice_state_update",
        "on_guild_channel_delete",
    }


async def test_register_schedules_the_check_at_8pm_pacific():
    """Waiting for a real firing would mean waiting a day, so the schedule is asserted."""
    bot = Mock()
    bot.setup_hook = AsyncMock()

    loop = voice_monitor.register(bot, _settings())

    assert loop is not None
    assert loop.time == [datetime.time(hour=20, tzinfo=ZoneInfo("America/Los_Angeles"))]


async def test_register_defers_the_start_to_setup_hook():
    """Starting it any earlier kills it: ``wait_until_ready`` raises before login."""
    bot = Mock()
    original_setup_hook = AsyncMock()
    bot.setup_hook = original_setup_hook
    bot.wait_until_ready = AsyncMock()
    # The first check runs as soon as the loop starts; it must not reach Discord.
    bot.get_guild.return_value = None

    loop = voice_monitor.register(bot, _settings())

    assert not loop.is_running()
    assert bot.setup_hook is not original_setup_hook

    await bot.setup_hook()
    try:
        assert loop.is_running()
        original_setup_hook.assert_awaited_once()
    finally:
        loop.cancel()


async def test_register_without_an_alert_channel_still_records(caplog):
    """The table must fill now, or switching the channel on means waiting 3 weeks."""
    bot = Mock()
    bot.setup_hook = AsyncMock()

    with caplog.at_level("WARNING"):
        loop = voice_monitor.register(bot, _settings(alert_channel_id=None))

    # The loop is what takes the daily snapshot, so it is built all the same.
    assert loop is not None
    assert "DISCORD_ALERT_CHANNEL_ID" in caplog.text
    assert len(bot.add_listener.call_args_list) == 2


async def test_register_without_a_guild_records_nothing(caplog):
    bot = Mock()

    with caplog.at_level("WARNING"):
        assert voice_monitor.register(bot, _settings(guild_id=None)) is None

    assert "DISCORD_GUILD_ID" in caplog.text
    bot.add_listener.assert_not_called()
