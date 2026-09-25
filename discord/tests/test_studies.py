import sqlite3
from unittest.mock import AsyncMock, Mock

import discord
import pytest
from fastapi.testclient import TestClient

from app.api.routes.studies import DEFAULT_NEW_STUDY_ANCHOR_NAME, MAX_STUDY_NAME
from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
USER_ID = "327394882193883136"
API_KEY = "test-api-key"
HEADERS = {
    "X-API-Key": API_KEY,
    "X-Discord-User-ID": USER_ID,
    "Idempotency-Key": "9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa",
}


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


def _created(obj_id: int) -> Mock:
    """Return a stand-in for a created Discord object that can be deleted."""
    obj = Mock(id=obj_id)
    obj.delete = AsyncMock()
    return obj


class FakeGuild:
    """A guild with one captain member, recording what gets created."""

    def __init__(
        self,
        *,
        captain=True,
        captain_role_exists=True,
        categories=(DEFAULT_NEW_STUDY_ANCHOR_NAME,),
    ):
        self.category = _created(11)
        self.text = _created(12)
        self.voice = _created(13)
        self.voice.set_permissions = AsyncMock()
        self.role = _created(14)
        self.category.move = AsyncMock()
        self.category.create_text_channel = AsyncMock(return_value=self.text)
        self.category.create_voice_channel = AsyncMock(return_value=self.voice)
        self.create_category = AsyncMock(return_value=self.category)
        self.create_role = AsyncMock(return_value=self.role)

        self.default_role = Mock(name="@everyone")
        self.me = Mock(name="bot member")
        self.captain_role = Mock(id=CAPTAIN_ROLE_ID)
        self.member = Mock()
        self.member.get_role.return_value = self.captain_role if captain else None
        self.fetch_member = AsyncMock(return_value=self.member)
        self._captain_role_exists = captain_role_exists
        self.categories = [Mock() for _ in categories]
        for category, n in zip(self.categories, categories):
            category.name = n
        # discord.utils.get reads attributes, so only the names need to be real.
        self.anchor = self.categories[0] if self.categories else None

    def get_role(self, role_id):
        return self.captain_role if self._captain_role_exists and role_id == CAPTAIN_ROLE_ID else None


def _bot(guild=None, ready=True) -> Mock:
    bot = Mock()
    bot.is_ready.return_value = ready
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    return bot


@pytest.fixture
def db_path(tmp_path):
    return str(tmp_path / "discord.sqlite3")


def _client(bot, db_path, **overrides) -> TestClient:
    values = {
        "guild_id": GUILD_ID,
        "captain_role_id": CAPTAIN_ROLE_ID,
        "api_key": API_KEY,
        "db_path": db_path,
    }
    settings = Settings(**{**values, **overrides})
    return TestClient(create_app(settings, bot))


def _post(client, name="알고리즘 스터디", headers=HEADERS):
    return client.post("/api/v1/studies", json={"studyName": name}, headers=headers)


def _row(db_path, name):
    """Return the reservation row's (status, study_id, role_id), or None when the name is free."""
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS study_reservation"
            " (study_name TEXT PRIMARY KEY, status TEXT NOT NULL, idempotency_key TEXT NOT NULL,"
            " study_id INTEGER, role_id INTEGER)"
        )
        return conn.execute(
            "SELECT status, study_id, role_id FROM study_reservation WHERE study_name = ?", (name,)
        ).fetchone()


def _status(db_path, name):
    """Return the reservation row's status, or None when the name is free."""
    row = _row(db_path, name)
    return row[0] if row else None


def test_create_study_creates_category_channels_and_role(db_path):
    """All four are created in order and the category and role IDs come back as strings."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 201
    assert response.json() == {"discordStudyId": "11", "discordRoleId": "14"}
    guild.fetch_member.assert_awaited_once_with(int(USER_ID))
    guild.create_category.assert_awaited_once_with("알고리즘 스터디")
    guild.category.move.assert_awaited_once_with(after=guild.anchor)
    guild.category.create_text_channel.assert_awaited_once()
    assert guild.category.create_text_channel.await_args.args == ("로비-알고리즘 스터디",)
    guild.category.create_voice_channel.assert_awaited_once()
    assert guild.category.create_voice_channel.await_args.args == ("공부방-알고리즘 스터디",)
    guild.create_role.assert_awaited_once_with(name="알고리즘 스터디")
    assert _row(db_path, "알고리즘 스터디") == ("COMPLETED", 11, 14)


def test_create_study_text_channel_is_open_to_everyone(db_path):
    guild = FakeGuild()

    _post(_client(_bot(guild), db_path))

    overwrites = guild.category.create_text_channel.await_args.kwargs["overwrites"]
    assert overwrites == {
        guild.default_role: discord.PermissionOverwrite(view_channel=True, send_messages=True)
    }


def test_create_study_voice_channel_is_visible_to_all_but_joinable_by_the_study_role(db_path):
    guild = FakeGuild()

    _post(_client(_bot(guild), db_path))

    overwrites = guild.category.create_voice_channel.await_args.kwargs["overwrites"]
    assert overwrites == {
        guild.default_role: discord.PermissionOverwrite(view_channel=True, connect=False),
        guild.me: discord.PermissionOverwrite(connect=True),
    }
    guild.voice.set_permissions.assert_awaited_once_with(guild.role, connect=True)


def test_create_study_goes_below_the_current_reference_category(db_path):
    """The reference name is read per request, so changing it at runtime takes effect."""
    guild = FakeGuild(categories=("===== Old =====", "--- studies ---"))
    client = _client(_bot(guild), db_path)
    client.app.state.new_study_anchor_name = "--- studies ---"

    response = _post(client)

    assert response.status_code == 201
    guild.category.move.assert_awaited_once_with(after=guild.categories[1])


def test_create_study_without_reference_category_goes_to_the_top(db_path, caplog):
    """A missing reference category does not block creation; it is logged and the study goes on top."""
    guild = FakeGuild(categories=("other",))

    with caplog.at_level("WARNING"):
        response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 201
    guild.category.move.assert_awaited_once_with(beginning=True)
    assert DEFAULT_NEW_STUDY_ANCHOR_NAME in caplog.text


def test_create_study_rolls_back_when_the_move_fails(db_path):
    """A failed move is a failed step like any other: the category is deleted."""
    guild = FakeGuild()
    guild.category.move.side_effect = _discord_error()

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 502
    guild.category.delete.assert_awaited_once()
    guild.category.create_text_channel.assert_not_awaited()
    assert _status(db_path, "알고리즘 스터디") is None


def test_create_study_strips_the_name(db_path):
    """Surrounding whitespace is not part of the name."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path), name="  스터디  ")

    assert response.status_code == 201
    guild.create_category.assert_awaited_once_with("스터디")


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-API-Key"},
        {**HEADERS, "X-API-Key": "wrong"},
    ],
)
def test_create_study_rejects_missing_or_wrong_api_key(headers, db_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path), headers=headers)

    assert response.status_code == 401
    guild.create_category.assert_not_awaited()


def test_create_study_rejects_everything_without_configured_api_key(db_path):
    """An unset DISCORD_API_KEY closes the endpoint rather than opening it."""
    response = _post(_client(_bot(FakeGuild()), db_path, api_key=None))

    assert response.status_code == 401


def test_api_key_is_checked_before_the_body(db_path):
    response = _client(_bot(FakeGuild()), db_path).post(
        "/api/v1/studies", json={}, headers={"X-API-Key": "wrong"}
    )

    assert response.status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-Discord-User-ID"},
        {**HEADERS, "X-Discord-User-ID": "123"},
        {**HEADERS, "X-Discord-User-ID": "+327394882193883136"},
        {k: v for k, v in HEADERS.items() if k != "Idempotency-Key"},
        {**HEADERS, "Idempotency-Key": " "},
    ],
)
def test_create_study_rejects_bad_headers(headers, db_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path), headers=headers)

    assert response.status_code == 400
    guild.create_category.assert_not_awaited()


@pytest.mark.parametrize("name", ["", "   ", "a" * (MAX_STUDY_NAME + 1), 123, None])
def test_create_study_rejects_bad_study_name(name, db_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path), name=name)

    assert response.status_code == 400
    guild.create_category.assert_not_awaited()


def test_create_study_accepts_longest_name_that_fits_the_channel_names(db_path):
    """The longest name plus a prefix still fits Discord's 100-char channel limit."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), db_path), name="a" * MAX_STUDY_NAME)

    assert response.status_code == 201
    voice_name = guild.category.create_voice_channel.await_args.args[0]
    assert len(voice_name) <= 100


def test_create_study_rejects_malformed_json(db_path):
    response = _client(_bot(FakeGuild()), db_path).post(
        "/api/v1/studies",
        content=b"{not json",
        headers={**HEADERS, "Content-Type": "application/json"},
    )

    assert response.status_code == 400


def test_create_study_without_bot_is_unavailable(db_path):
    response = _post(_client(None, db_path))

    assert response.status_code == 503


def test_create_study_before_connect_is_unavailable(db_path):
    response = _post(_client(_bot(FakeGuild(), ready=False), db_path))

    assert response.status_code == 503


@pytest.mark.parametrize("missing", ["guild_id", "captain_role_id"])
def test_create_study_without_configuration_conflicts(missing, db_path):
    response = _post(_client(_bot(FakeGuild()), db_path, **{missing: None}))

    assert response.status_code == 409
    assert missing.upper() in response.json()["detail"]


def test_create_study_with_unknown_guild_is_not_found(db_path):
    response = _post(_client(_bot(None), db_path))

    assert response.status_code == 404
    assert "guild" in response.json()["detail"]


def test_create_study_by_non_member_is_not_found(db_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error(discord.NotFound, 404)

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]


def test_create_study_without_captain_role_in_guild_is_not_found(db_path):
    """A missing captain role is a guild setup problem, not the caller's -- and it is never created."""
    guild = FakeGuild(captain_role_exists=False)

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 404
    assert "captain role" in response.json()["detail"]
    guild.create_role.assert_not_awaited()


def test_create_study_by_non_captain_is_forbidden(db_path):
    guild = FakeGuild(captain=False)

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 403
    guild.create_category.assert_not_awaited()
    assert _status(db_path, "알고리즘 스터디") is None


def test_create_study_twice_conflicts(db_path):
    """A second request for the same name is refused and creates nothing."""
    guild = FakeGuild()
    client = _client(_bot(guild), db_path)

    assert _post(client).status_code == 201
    response = _post(client)

    assert response.status_code == 409
    guild.create_category.assert_awaited_once()


def test_create_study_while_same_name_is_processing_conflicts(db_path):
    guild = FakeGuild()
    client = _client(_bot(guild), db_path)
    client.app.state.study_reservations.reserve("알고리즘 스터디", "other-request")

    response = _post(client)

    assert response.status_code == 409
    guild.create_category.assert_not_awaited()


def test_create_study_with_existing_category_conflicts_and_frees_the_name(db_path):
    """A category made outside this service blocks the name without leaving a reservation."""
    guild = FakeGuild(categories=[DEFAULT_NEW_STUDY_ANCHOR_NAME, "알고리즘 스터디"])

    response = _post(_client(_bot(guild), db_path))

    assert response.status_code == 409
    guild.create_category.assert_not_awaited()
    assert _status(db_path, "알고리즘 스터디") is None


def test_create_study_rolls_back_in_reverse_on_failure(db_path):
    """A failed step deletes what was made, newest first, and frees the name for a retry."""
    guild = FakeGuild()
    order = []
    guild.role.delete.side_effect = lambda: order.append("role")
    guild.voice.delete.side_effect = lambda: order.append("voice")
    guild.text.delete.side_effect = lambda: order.append("text")
    guild.category.delete.side_effect = lambda: order.append("category")
    guild.voice.set_permissions.side_effect = _discord_error(discord.Forbidden, 403)
    client = _client(_bot(guild), db_path)

    response = _post(client)

    assert response.status_code == 502
    assert order == ["role", "voice", "text", "category"]
    assert _status(db_path, "알고리즘 스터디") is None

    guild.voice.set_permissions.side_effect = None
    assert _post(client).status_code == 201


def test_create_study_keeps_reservation_when_rollback_fails(db_path, caplog):
    """Leftovers are logged by ID and the name stays blocked until cleaned up by hand."""
    guild = FakeGuild()
    guild.category.create_voice_channel.side_effect = _discord_error()
    guild.category.delete.side_effect = _discord_error()
    client = _client(_bot(guild), db_path)

    with caplog.at_level("ERROR"):
        response = _post(client)

    assert response.status_code == 502
    assert "rollback failed" in response.json()["detail"]
    guild.text.delete.assert_awaited_once()
    assert "11" in caplog.text
    assert _status(db_path, "알고리즘 스터디") == "ERROR"
    assert _post(client).status_code == 409


def test_health_needs_no_api_key(db_path):
    response = _client(None, db_path).get("/api/v1/health")

    assert response.status_code == 200
