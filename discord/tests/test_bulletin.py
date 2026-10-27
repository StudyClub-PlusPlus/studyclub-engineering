import datetime
from unittest.mock import AsyncMock, Mock
from zoneinfo import ZoneInfo

import discord
import pytest

from app.bot import bulletin
from app.config import Settings

GUILD_ID = 100000000000000001
BULLETIN_CHANNEL_ID = 200000000000000001
ALERT_CHANNEL_ID = 200000000000000002
BOT_USER_ID = 300000000000000001
ANCHOR_ID = 400000000000000001
# 2026-09-29 20:00 in Los Angeles (PDT).
NOW = datetime.datetime(2026, 9, 30, 3, 0, tzinfo=datetime.timezone.utc)
HEADER = "마지막 갱신: 2026-09-29 20:00 PDT"


def _settings(**overrides) -> Settings:
    return Settings(
        **{
            "guild_id": GUILD_ID,
            "anchor_channel_id": ANCHOR_ID,
            "bulletin_channel_id": BULLETIN_CHANNEL_ID,
            "alert_channel_id": ALERT_CHANNEL_ID,
            **overrides,
        }
    )


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


def _voice(channel_id, visible=True) -> Mock:
    voice = Mock(spec=discord.VoiceChannel, id=channel_id)
    voice.permissions_for.return_value = Mock(view_channel=visible)
    return voice


def _category(name, voice_channels=()) -> Mock:
    category = Mock(spec=discord.CategoryChannel)
    category.name = name
    category.voice_channels = list(voice_channels)
    return category


def _anchor() -> Mock:
    """The divider category, found by its ID; the name is only for the eye."""
    category = _category("===== New Study =====")
    category.id = ANCHOR_ID
    return category


def _text_channel(channel_id, messages=()) -> Mock:
    """A text channel whose history yields ``messages`` oldest first."""
    channel = Mock(spec=discord.TextChannel, id=channel_id)
    channel.permissions_for.return_value = Mock(view_channel=True)
    channel.send = AsyncMock()

    def history(limit, oldest_first):
        async def iterator():
            for message in messages:
                yield message

        return iterator()

    channel.history = history
    return channel


def _message(message_id, author_id) -> Mock:
    message = Mock(spec=discord.Message, id=message_id)
    message.author = Mock(id=author_id)
    message.edit = AsyncMock()
    return message


class FakeGuild:
    """A guild whose sidebar holds an operational category, the anchor, and studies."""

    def __init__(self, categories=None, channels=None):
        self.me = Mock(name="bot member")
        self.categories = (
            categories
            if categories is not None
            else [
                _category("운영진 전용", [_voice(1)]),
                _anchor(),
                _category("알고리즘 스터디", [_voice(2), _voice(3)]),
                _category("CS 전공", [_voice(4)]),
            ]
        )
        self.bulletin_channel = _text_channel(BULLETIN_CHANNEL_ID)
        self.alert_channel = _text_channel(ALERT_CHANNEL_ID)
        self.channels = (
            channels
            if channels is not None
            else {
                BULLETIN_CHANNEL_ID: self.bulletin_channel,
                ALERT_CHANNEL_ID: self.alert_channel,
            }
        )

    def get_channel(self, channel_id):
        return self.channels.get(channel_id)


def _bot(guild) -> Mock:
    bot = Mock()
    bot.user = Mock(id=BOT_USER_ID)
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    return bot


# --- build_bulletin ---------------------------------------------------------


def test_build_bulletin_renders_one_line_per_study():
    """Each study is ``name : <#id> - <#id>``, in the order it was given."""
    content, omitted = bulletin.build_bulletin([("알고리즘 스터디", [2, 3]), ("CS 전공", [4])], NOW)

    assert content == f"{HEADER}\n알고리즘 스터디 : <#2> - <#3>\nCS 전공 : <#4>"
    assert omitted == 0


def test_build_bulletin_opens_with_the_refresh_time_in_the_clubs_timezone():
    """The first line says when the list was true, in Los Angeles time."""
    winter = datetime.datetime(2026, 12, 1, 4, 0, tzinfo=datetime.timezone.utc)

    content, _ = bulletin.build_bulletin([("CS 전공", [4])], winter)

    assert content.split("\n")[0] == "마지막 갱신: 2026-11-30 20:00 PST"


def test_build_bulletin_skips_categories_without_a_voice_channel():
    """A line nobody can click only makes the board longer, so it is left out."""
    content, _ = bulletin.build_bulletin([("공부방 없음", []), ("CS 전공", [4])], NOW)

    assert content == f"{HEADER}\nCS 전공 : <#4>"


@pytest.mark.parametrize(
    "categories", [[], [("공부방 없음", [])], [("A", []), ("B", [])]]
)
def test_build_bulletin_with_nothing_to_list_says_so(categories):
    """Discord refuses an empty message, and a stale list would be clicked."""
    content, omitted = bulletin.build_bulletin(categories, NOW)

    assert content == f"{HEADER}\n{bulletin.EMPTY_BULLETIN}"
    assert omitted == 0


def test_build_bulletin_truncates_whole_lines_and_counts_what_it_dropped():
    """Over the cap the board keeps whole lines and says how many are missing."""
    # Each line is ~60 characters, so 2000 fits far fewer than 100 of them.
    categories = [(f"스터디 {i:03d}", [100000000000000000 + i]) for i in range(100)]

    content, omitted = bulletin.build_bulletin(categories, NOW)

    assert len(content) <= bulletin.MAX_MSG
    assert omitted > 0
    assert content.startswith(f"{HEADER}\n")
    assert content.endswith(bulletin.TRUNCATED_NOTICE.format(count=omitted))
    # Whole lines only: every line but the header and notice is one a caller would recognise.
    kept = content.split("\n")[1:-1]
    assert len(kept) == 100 - omitted
    assert all(line in [f"스터디 {i:03d} : <#{100000000000000000 + i}>" for i in range(100)] for line in kept)


def test_build_bulletin_at_the_cap_keeps_the_line_and_one_over_drops_it():
    """The boundary: a board that exactly fits is untouched, one character more is not.

    The header shares the cap. A single line too long for what is left leaves
    nothing but the notice -- there is no half of a line worth publishing.
    """
    room = bulletin.MAX_MSG - len(HEADER) - 1 - len(" : <#1>")

    categories = [("A" * (room + 1), [1])]
    over, omitted_over = bulletin.build_bulletin(categories, NOW)
    assert omitted_over == 1
    assert over == f"{HEADER}\n{bulletin.TRUNCATED_NOTICE.format(count=1)}"

    categories = [("A" * room, [1])]
    exact, omitted_exact = bulletin.build_bulletin(categories, NOW)
    assert len(exact) == bulletin.MAX_MSG
    assert omitted_exact == 0


# --- collect_categories ----------------------------------------------------


def test_collect_categories_takes_everything_below_the_anchor():
    """The anchor and everything above it are left out; order is the sidebar's."""
    guild = FakeGuild()

    assert bulletin.collect_categories(guild, ANCHOR_ID) == [
        ("알고리즘 스터디", [2, 3]),
        ("CS 전공", [4]),
    ]


def test_collect_categories_without_the_anchor_returns_none():
    """Without the anchor there is no telling a study from a staff category."""
    guild = FakeGuild(categories=[_category("운영진 전용", [_voice(1)])])

    assert bulletin.collect_categories(guild, ANCHOR_ID) is None


def test_collect_categories_without_a_configured_anchor_returns_none():
    """An unset DISCORD_ANCHOR_CHANNEL_ID is as good as a missing anchor."""
    assert bulletin.collect_categories(FakeGuild(), None) is None


def test_collect_categories_with_the_id_of_a_non_category_returns_none():
    """A voice channel's ID is not an anchor, even though the channel exists."""
    assert bulletin.collect_categories(FakeGuild(), 2) is None


def test_collect_categories_finds_the_anchor_by_id_not_name():
    """A category that only shares the anchor's name is not the anchor."""
    guild = FakeGuild(
        categories=[
            _category("===== New Study =====", [_voice(1)]),
            _anchor(),
            _category("알고리즘 스터디", [_voice(2)]),
        ]
    )

    assert bulletin.collect_categories(guild, ANCHOR_ID) == [("알고리즘 스터디", [2])]


def test_collect_categories_drops_voice_channels_the_bot_cannot_see():
    """An invisible channel renders as a broken link, so it is not listed."""
    guild = FakeGuild(
        categories=[
            _anchor(),
            _category("알고리즘 스터디", [_voice(2), _voice(3, visible=False)]),
        ]
    )

    assert bulletin.collect_categories(guild, ANCHOR_ID) == [("알고리즘 스터디", [2])]


def test_collect_categories_keeps_a_study_with_no_visible_voice_channel():
    """Filtering happens here; whether the study earns a line is build_bulletin's call."""
    guild = FakeGuild(
        categories=[_anchor(), _category("알고리즘 스터디", [_voice(2, visible=False)])]
    )

    assert bulletin.collect_categories(guild, ANCHOR_ID) == [("알고리즘 스터디", [])]


# --- find_own_message ------------------------------------------------------


async def test_find_own_message_ignores_other_authors():
    """A moderator's message is not the board."""
    channel = _text_channel(BULLETIN_CHANNEL_ID, [_message(1, author_id=999)])

    assert await bulletin.find_own_message(_bot(FakeGuild()), channel) is None


async def test_find_own_message_returns_the_oldest_own_message_and_warns(caplog):
    """Several of the bot's messages is unexpected: edit the oldest, touch nothing else."""
    own_old = _message(1, author_id=BOT_USER_ID)
    own_new = _message(3, author_id=BOT_USER_ID)
    channel = _text_channel(
        BULLETIN_CHANNEL_ID, [own_old, _message(2, author_id=999), own_new]
    )

    with caplog.at_level("WARNING"):
        found = await bulletin.find_own_message(_bot(FakeGuild()), channel)

    assert found is own_old
    assert "2 messages from the bot" in caplog.text
    own_new.edit.assert_not_awaited()


# --- refresh ---------------------------------------------------------------


async def test_refresh_sends_when_the_board_does_not_exist_yet():
    """An empty channel gets the first message."""
    guild = FakeGuild()

    assert await bulletin.refresh(_bot(guild), _settings()) is True

    guild.bulletin_channel.send.assert_awaited_once()
    content, kwargs = guild.bulletin_channel.send.await_args
    header, board = content[0].split("\n", 1)
    assert header.startswith("마지막 갱신: ")
    assert board == "알고리즘 스터디 : <#2> - <#3>\nCS 전공 : <#4>"
    # Nobody is notified by the board, not even by a category named @everyone.
    assert kwargs["allowed_mentions"].everyone is False


async def test_refresh_edits_the_existing_board_instead_of_posting_again():
    """The channel keeps one message, so a refresh rewrites it in place."""
    guild = FakeGuild()
    existing = _message(1, author_id=BOT_USER_ID)
    guild.bulletin_channel = _text_channel(BULLETIN_CHANNEL_ID, [existing])
    guild.channels[BULLETIN_CHANNEL_ID] = guild.bulletin_channel

    assert await bulletin.refresh(_bot(guild), _settings()) is True

    existing.edit.assert_awaited_once()
    assert existing.edit.await_args.kwargs["content"].split("\n")[1].startswith("알고리즘 스터디 : ")
    guild.bulletin_channel.send.assert_not_awaited()


@pytest.mark.parametrize(
    "settings_kwargs",
    [
        {"guild_id": None},
        {"bulletin_channel_id": None},
    ],
)
async def test_refresh_without_the_configuration_does_nothing(settings_kwargs):
    """A missing setting is a server problem; the board is left as it is."""
    guild = FakeGuild()

    assert await bulletin.refresh(_bot(guild), _settings(**settings_kwargs)) is False

    guild.bulletin_channel.send.assert_not_awaited()


async def test_refresh_warns_the_alert_channel_when_the_board_channel_is_gone():
    """A deleted or hidden bulletin channel reaches someone who is not reading logs."""
    guild = FakeGuild()
    del guild.channels[BULLETIN_CHANNEL_ID]

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.alert_channel.send.assert_awaited_once()
    assert str(BULLETIN_CHANNEL_ID) in guild.alert_channel.send.await_args[0][0]


async def test_refresh_leaves_the_board_alone_when_the_anchor_is_missing():
    """Yesterday's list beats publishing staff categories to every member."""
    guild = FakeGuild(categories=[_category("운영진 전용", [_voice(1)])])

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.bulletin_channel.send.assert_not_awaited()
    guild.alert_channel.send.assert_awaited_once()
    assert str(ANCHOR_ID) in guild.alert_channel.send.await_args[0][0]


async def test_refresh_leaves_the_board_alone_without_a_configured_anchor():
    """An unset anchor gets the same treatment as a missing one: no board, an alert."""
    guild = FakeGuild()

    assert await bulletin.refresh(_bot(guild), _settings(anchor_channel_id=None)) is False

    guild.bulletin_channel.send.assert_not_awaited()
    guild.alert_channel.send.assert_awaited_once()
    assert "DISCORD_ANCHOR_CHANNEL_ID" in guild.alert_channel.send.await_args[0][0]


async def test_refresh_reports_missing_permissions_without_raising():
    """Forbidden names the three permissions, since that is the usual cause."""
    guild = FakeGuild()
    guild.bulletin_channel.send = AsyncMock(side_effect=_discord_error(discord.Forbidden, 403))

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.alert_channel.send.assert_awaited_once()
    assert "Read Message History" in guild.alert_channel.send.await_args[0][0]


async def test_refresh_survives_a_rejected_send():
    """A Discord error must not kill the loop that runs every six hours."""
    guild = FakeGuild()
    guild.bulletin_channel.send = AsyncMock(side_effect=_discord_error())

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.alert_channel.send.assert_awaited_once()


async def test_refresh_survives_a_connection_error(caplog):
    """A dropped connection is an ``OSError``, not a ``discord.HTTPException``.

    Raised from the refresh that runs in ``before_loop``, it would end the loop
    for the life of the process without a line in the log.
    """
    guild = FakeGuild()
    guild.bulletin_channel.send = AsyncMock(side_effect=OSError("connection lost"))

    with caplog.at_level("ERROR"):
        assert await bulletin.refresh(_bot(guild), _settings()) is False

    assert "bulletin:" in caplog.text


async def test_refresh_without_read_message_history_does_not_post_a_second_board():
    """Discord returns an empty history instead of a 403, so the permission is checked.

    Left to the search, the board would look absent and every refresh would add
    another message.
    """
    guild = FakeGuild()
    existing = _message(1, author_id=BOT_USER_ID)
    guild.bulletin_channel = _text_channel(BULLETIN_CHANNEL_ID, [existing])
    guild.bulletin_channel.permissions_for.return_value = Mock(
        view_channel=True, read_message_history=False
    )
    guild.channels[BULLETIN_CHANNEL_ID] = guild.bulletin_channel

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.bulletin_channel.send.assert_not_awaited()
    existing.edit.assert_not_awaited()
    guild.alert_channel.send.assert_awaited_once()
    assert "Read Message History" in guild.alert_channel.send.await_args[0][0]


async def test_refresh_survives_an_unreadable_history():
    """A Forbidden raised by the search itself is reported, before anything is posted."""
    guild = FakeGuild()

    def history(limit, oldest_first):
        async def iterator():
            raise _discord_error(discord.Forbidden, 403)
            yield  # pragma: no cover - unreachable, makes this an async generator

        return iterator()

    guild.bulletin_channel.history = history

    assert await bulletin.refresh(_bot(guild), _settings()) is False

    guild.bulletin_channel.send.assert_not_awaited()
    guild.alert_channel.send.assert_awaited_once()


async def test_refresh_reports_truncation_after_posting_the_board():
    """The board goes up first: a partial list beats no list, but someone is told."""
    guild = FakeGuild(
        categories=[_anchor()]
        + [_category(f"스터디 {i:03d}", [_voice(100000000000000000 + i)]) for i in range(100)]
    )

    # Truncated is still updated: the board went up, and the alert channel is told.
    assert await bulletin.refresh(_bot(guild), _settings()) is True

    guild.bulletin_channel.send.assert_awaited_once()
    guild.alert_channel.send.assert_awaited_once()
    assert "빠졌습니다" in guild.alert_channel.send.await_args[0][0]


async def test_refresh_does_not_fail_when_the_alert_channel_is_also_broken():
    """A failed notification may not become a failed refresh."""
    guild = FakeGuild()
    del guild.channels[BULLETIN_CHANNEL_ID]
    del guild.channels[ALERT_CHANNEL_ID]

    assert await bulletin.refresh(_bot(guild), _settings()) is False  # must not raise


async def test_refresh_without_the_guild_does_nothing():
    """Before the guild is cached there is nothing to list and nowhere to complain."""
    bot = Mock()
    bot.user = Mock(id=BOT_USER_ID)
    bot.get_guild.return_value = None

    assert await bulletin.refresh(bot, _settings()) is False  # must not raise


# --- register --------------------------------------------------------------


async def test_register_schedules_the_loop_at_8pm_pacific():
    """Once a day at 20:00 Pacific, pinned to the wall clock through the DST switch.

    Waiting for a real firing would mean waiting a day, so the schedule itself is
    what is asserted. discord.py normalises ``time`` to a list.
    """
    bot = Mock()
    bot.setup_hook = AsyncMock()

    loop = bulletin.register(bot, _settings())

    assert loop is not None
    assert loop.time == [datetime.time(hour=20, tzinfo=ZoneInfo("America/Los_Angeles"))]


async def test_register_defers_the_start_to_setup_hook():
    """Starting it any earlier kills it: ``wait_until_ready`` raises before login.

    ``create_bot`` runs before ``bot.start``, so a loop started there fails in
    ``before_loop`` and never runs again -- the board would silently go stale.
    """
    bot = Mock()
    original_setup_hook = AsyncMock()
    bot.setup_hook = original_setup_hook
    bot.wait_until_ready = AsyncMock()
    # The first refresh runs as soon as the loop starts; it must not reach Discord.
    bot.get_guild.return_value = None

    loop = bulletin.register(bot, _settings())

    assert not loop.is_running()
    assert bot.setup_hook is not original_setup_hook

    await bot.setup_hook()
    try:
        assert loop.is_running()
        # The hook that was already there still runs.
        original_setup_hook.assert_awaited_once()
    finally:
        loop.cancel()


async def test_register_without_a_channel_does_not_start_a_loop(caplog):
    """No bulletin channel disables the feature and says so once."""
    bot = Mock()

    with caplog.at_level("WARNING"):
        bulletin.register(bot, _settings(bulletin_channel_id=None))

    assert "DISCORD_BULLETIN_CHANNEL_ID" in caplog.text
