import asyncio
from unittest.mock import AsyncMock, Mock

import aiohttp
import discord
import pytest
from fastapi.testclient import TestClient

from app.api.routes.roles import MAX_USERS, UNKNOWN_MEMBER
from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
NAVIGATOR_ROLE_ID = 100000000000000003
STUDY_ROLE_ID = 100000000000000004
BOT_ID = 100000000000000005
STUDY_ID = "1327394882193883136"
USER_ID = "327394882193883136"
TARGET_IDS = ["427394882193883136", "527394882193883136", "627394882193883136"]
API_KEY = "test-api-key"
HEADERS = {
    "X-API-Key": API_KEY,
    "X-Discord-User-ID": USER_ID,
    "Idempotency-Key": "9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa",
}
NAVIGATOR_PATH = "/api/v1/roles/navigator/users"
STUDY_PATH = f"/api/v1/roles/{STUDY_ROLE_ID}/users"
SYSTEM_HEADERS = {**HEADERS, "X-Discord-User-ID": str(BOT_ID)}


def _discord_error(cls=discord.HTTPException, status=500, code=0):
    return cls(Mock(status=status, reason="error"), {"code": code, "message": "rejected"})


def _unknown_member():
    return _discord_error(discord.NotFound, 404, UNKNOWN_MEMBER)


class FakeGuild:
    """A guild with a captain caller and some of the target users as members.

    ``cached`` is who the member cache holds; the rest of ``members`` are only
    found by asking Discord, as they would be with the cache missing them.
    """

    def __init__(
        self,
        *,
        caller_roles=(CAPTAIN_ROLE_ID,),
        roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID, STUDY_ROLE_ID),
        members=TARGET_IDS,
        cached=(),
    ):
        self.id = GUILD_ID
        self.roles = {role_id: Mock(id=role_id) for role_id in roles}
        self.caller = Mock()
        self.caller.get_role.side_effect = (
            lambda rid: self.roles.get(rid) if rid in caller_roles else None
        )
        self.targets = {
            uid: Mock(id=int(uid), add_roles=AsyncMock(), remove_roles=AsyncMock())
            for uid in members
        }
        self.cached = set(cached)
        self.fetch_member = AsyncMock(side_effect=self._fetch)
        self.query_members = AsyncMock(
            side_effect=lambda user_ids, limit: [
                self.targets[str(uid)] for uid in user_ids if str(uid) in self.targets
            ]
        )

    def _fetch(self, user_id):
        if user_id == int(USER_ID):
            return self.caller
        # The bot is a member like any other, holding none of the caller roles.
        if user_id == BOT_ID:
            return Mock(get_role=Mock(return_value=None))
        if str(user_id) in self.targets:
            return self.targets[str(user_id)]
        raise _unknown_member()

    def get_role(self, role_id):
        return self.roles.get(role_id)

    def get_member(self, user_id):
        return self.targets.get(str(user_id)) if str(user_id) in self.cached else None

    @property
    def navigator(self):
        return self.roles[NAVIGATOR_ROLE_ID]

    @property
    def study_role(self):
        return self.roles[STUDY_ROLE_ID]


def _bot(guild=None, ready=True) -> Mock:
    bot = Mock()
    bot.is_ready.return_value = ready
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    return bot


def _client(bot, tmp_path, **overrides) -> TestClient:
    values = {
        "guild_id": GUILD_ID,
        "captain_role_id": CAPTAIN_ROLE_ID,
        "navigator_role_id": NAVIGATOR_ROLE_ID,
        "api_key": API_KEY,
        "bot_id": BOT_ID,
        "db_path": str(tmp_path / "discord.sqlite3"),
    }
    return TestClient(create_app(Settings(**{**values, **overrides}), bot))


def _body(user_ids=None, study_id=STUDY_ID):
    return {"discordStudyId": study_id, "discordUserIds": TARGET_IDS if user_ids is None else user_ids}


def _call(client, method, body=None, headers=HEADERS, path=NAVIGATOR_PATH):
    return client.request(method, path, json=_body() if body is None else body, headers=headers)


def _assign(client, body=None, headers=HEADERS, path=NAVIGATOR_PATH):
    return _call(client, "POST", body, headers, path)


def _remove(client, body=None, headers=HEADERS, path=NAVIGATOR_PATH):
    return _call(client, "DELETE", body, headers, path)


def _changes(guild, method):
    """Return the role changes the bot sent, one call per member."""
    attr = "add_roles" if method == "POST" else "remove_roles"
    return [getattr(m, attr) for m in guild.targets.values() if getattr(m, attr).await_count]


both = pytest.mark.parametrize("method", ["POST", "DELETE"])
# How losing Discord itself comes up: none of them is a discord.HTTPException.
transport = pytest.mark.parametrize(
    "error",
    [OSError(54, "Connection reset by peer"), aiohttp.ServerDisconnectedError(), asyncio.TimeoutError()],
    ids=["reset", "disconnected", "timeout"],
)
every = pytest.mark.parametrize(
    "method,path",
    [(m, p) for p in (NAVIGATOR_PATH, STUDY_PATH) for m in ("POST", "DELETE")],
)


# --- assign-navigator-role ------------------------------------------------


def test_assign_gives_the_navigator_role_to_every_member(tmp_path):
    guild = FakeGuild()

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == {"succeededCount": 3, "failed": []}
    for member in guild.targets.values():
        member.add_roles.assert_awaited_once_with(guild.navigator)


def test_assign_leaves_out_users_outside_the_guild_and_gives_the_rest(tmp_path):
    guild = FakeGuild(members=TARGET_IDS[:2])

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == {
        "succeededCount": 2,
        "failed": [{"discordUserId": TARGET_IDS[2], "reason": "NOT_IN_GUILD"}],
    }
    assert len(_changes(guild, "POST")) == 2


def test_assign_asks_discord_only_for_the_users_the_cache_misses(tmp_path):
    guild = FakeGuild(cached=TARGET_IDS[:2])

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.json()["succeededCount"] == 3
    guild.query_members.assert_awaited_once()
    assert guild.query_members.await_args.kwargs["user_ids"] == [int(TARGET_IDS[2])]


def test_assign_does_not_query_when_the_cache_has_everyone(tmp_path):
    guild = FakeGuild(cached=TARGET_IDS)

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.json()["succeededCount"] == 3
    guild.query_members.assert_not_awaited()


def test_assign_counts_a_duplicated_user_once(tmp_path):
    guild = FakeGuild()

    response = _assign(_client(_bot(guild), tmp_path), _body([TARGET_IDS[0], TARGET_IDS[0]]))

    assert response.json() == {"succeededCount": 1, "failed": []}
    guild.targets[TARGET_IDS[0]].add_roles.assert_awaited_once()


def test_assign_keeps_going_past_a_user_discord_rejects(tmp_path):
    guild = FakeGuild()
    guild.targets[TARGET_IDS[0]].add_roles.side_effect = _discord_error()

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.json() == {
        "succeededCount": 2,
        "failed": [{"discordUserId": TARGET_IDS[0], "reason": "DISCORD_REJECTED"}],
    }
    guild.targets[TARGET_IDS[1]].add_roles.assert_awaited_once()
    guild.targets[TARGET_IDS[2]].add_roles.assert_awaited_once()


@transport
def test_assign_stops_at_a_lost_connection_and_reports_the_rest(error, tmp_path, caplog):
    caplog.set_level("INFO")
    guild = FakeGuild()
    guild.targets[TARGET_IDS[1]].add_roles.side_effect = error

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == {
        "succeededCount": 1,
        "failed": [
            {"discordUserId": TARGET_IDS[1], "reason": "DISCORD_REJECTED"},
            {"discordUserId": TARGET_IDS[2], "reason": "DISCORD_REJECTED"},
        ],
    }
    guild.targets[TARGET_IDS[2]].add_roles.assert_not_awaited()
    assert f"1 succeeded ({TARGET_IDS[0]})" in caplog.text


def test_assign_after_a_lost_connection_still_reports_non_members_as_such(tmp_path):
    guild = FakeGuild(members=TARGET_IDS[:2])
    guild.targets[TARGET_IDS[1]].add_roles.side_effect = OSError(54, "Connection reset by peer")

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.json()["failed"] == [
        {"discordUserId": TARGET_IDS[1], "reason": "DISCORD_REJECTED"},
        {"discordUserId": TARGET_IDS[2], "reason": "NOT_IN_GUILD"},
    ]


def test_assign_to_a_user_who_left_after_the_lookup_is_not_in_guild(tmp_path):
    guild = FakeGuild()
    guild.targets[TARGET_IDS[0]].add_roles.side_effect = _unknown_member()

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.json()["failed"] == [{"discordUserId": TARGET_IDS[0], "reason": "NOT_IN_GUILD"}]


def test_assign_logs_a_refused_bot_as_a_setup_problem(tmp_path, caplog):
    guild = FakeGuild()
    for member in guild.targets.values():
        member.add_roles.side_effect = _discord_error(discord.Forbidden, 403)

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json()["succeededCount"] == 0
    assert all(f["reason"] == "DISCORD_REJECTED" for f in response.json()["failed"])
    assert "above role" in caplog.text
    assert "Manage Roles" in caplog.text


def test_assign_when_the_member_query_times_out_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.query_members.side_effect = asyncio.TimeoutError

    response = _assign(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    assert _changes(guild, "POST") == []


# --- remove-navigator-role ------------------------------------------------


def test_remove_takes_the_navigator_role_from_every_member(tmp_path):
    guild = FakeGuild()

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == {"succeededCount": 3, "failed": []}
    for member in guild.targets.values():
        member.remove_roles.assert_awaited_once_with(guild.navigator)


def test_remove_counts_a_user_outside_the_guild_as_done(tmp_path):
    guild = FakeGuild(members=TARGET_IDS[:2])

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json() == {"succeededCount": 3, "failed": []}


def test_remove_counts_a_user_who_left_after_the_lookup_as_done(tmp_path):
    guild = FakeGuild(cached=TARGET_IDS)
    guild.targets[TARGET_IDS[0]].remove_roles.side_effect = _unknown_member()

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json() == {"succeededCount": 3, "failed": []}


def test_remove_calls_on_a_cached_member_without_fetching_them(tmp_path):
    guild = FakeGuild(cached=TARGET_IDS)

    _remove(_client(_bot(guild), tmp_path))

    # Only the caller is fetched.
    guild.fetch_member.assert_awaited_once_with(int(USER_ID))
    assert len(_changes(guild, "DELETE")) == 3


def test_remove_never_takes_a_cache_miss_for_an_absence(tmp_path):
    guild = FakeGuild(cached=())

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json()["succeededCount"] == 3
    # Each target missed by the cache is asked about, and the role really goes.
    assert guild.fetch_member.await_count == 1 + len(TARGET_IDS)
    assert len(_changes(guild, "DELETE")) == 3


@transport
def test_remove_stops_at_a_lost_connection_and_reports_the_rest(error, tmp_path, caplog):
    caplog.set_level("INFO")
    guild = FakeGuild(cached=TARGET_IDS)
    guild.targets[TARGET_IDS[1]].remove_roles.side_effect = error

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == {
        "succeededCount": 1,
        "failed": [
            {"discordUserId": TARGET_IDS[1], "reason": "DISCORD_REJECTED"},
            {"discordUserId": TARGET_IDS[2], "reason": "DISCORD_REJECTED"},
        ],
    }
    guild.targets[TARGET_IDS[2]].remove_roles.assert_not_awaited()
    assert f"1 succeeded ({TARGET_IDS[0]})" in caplog.text


@transport
def test_remove_stops_when_looking_up_a_member_loses_the_connection(error, tmp_path):
    guild = FakeGuild(cached=(TARGET_IDS[0], TARGET_IDS[2]))
    fetch = guild.fetch_member.side_effect

    def lose_the_second(user_id):
        if user_id == int(TARGET_IDS[1]):
            raise error
        return fetch(user_id)

    guild.fetch_member.side_effect = lose_the_second

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json() == {
        "succeededCount": 1,
        "failed": [
            {"discordUserId": TARGET_IDS[1], "reason": "DISCORD_REJECTED"},
            {"discordUserId": TARGET_IDS[2], "reason": "DISCORD_REJECTED"},
        ],
    }
    guild.targets[TARGET_IDS[2]].remove_roles.assert_not_awaited()


def test_remove_rejects_any_other_not_found(tmp_path):
    guild = FakeGuild()
    guild.targets[TARGET_IDS[0]].remove_roles.side_effect = _discord_error(discord.NotFound, 404, 10011)

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json()["failed"] == [{"discordUserId": TARGET_IDS[0], "reason": "DISCORD_REJECTED"}]


def test_remove_keeps_going_past_a_user_discord_rejects(tmp_path):
    guild = FakeGuild()
    guild.targets[TARGET_IDS[1]].remove_roles.side_effect = _discord_error()

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json() == {
        "succeededCount": 2,
        "failed": [{"discordUserId": TARGET_IDS[1], "reason": "DISCORD_REJECTED"}],
    }
    guild.targets[TARGET_IDS[2]].remove_roles.assert_awaited_once()


def test_remove_logs_a_refused_bot_as_a_setup_problem(tmp_path, caplog):
    guild = FakeGuild()
    for member in guild.targets.values():
        member.remove_roles.side_effect = _discord_error(discord.Forbidden, 403)

    response = _remove(_client(_bot(guild), tmp_path))

    assert response.json()["succeededCount"] == 0
    assert "Manage Roles" in caplog.text


# --- shared -----------------------------------------------------------------


@every
def test_logs_the_study_and_who_succeeded(method, path, tmp_path, caplog):
    caplog.set_level("INFO")
    guild = FakeGuild()

    _call(_client(_bot(guild), tmp_path), method, path=path)

    assert STUDY_ID in caplog.text
    assert all(uid in caplog.text for uid in TARGET_IDS)


@both
def test_without_the_navigator_setting_conflicts_and_changes_nothing(method, tmp_path):
    guild = FakeGuild()

    response = _call(_client(_bot(guild), tmp_path, navigator_role_id=None), method)

    assert response.status_code == 409
    assert "DISCORD_NAVIGATOR_ROLE_ID" in response.json()["detail"]
    assert _changes(guild, method) == []


@both
def test_with_the_navigator_role_missing_is_not_found_and_changes_nothing(method, tmp_path):
    guild = FakeGuild(roles=(CAPTAIN_ROLE_ID,))

    response = _call(_client(_bot(guild), tmp_path), method)

    assert response.status_code == 404
    assert "navigator role" in response.json()["detail"]
    assert _changes(guild, method) == []


@every
def test_by_a_navigator_is_forbidden(method, path, tmp_path):
    guild = FakeGuild(caller_roles=(NAVIGATOR_ROLE_ID,))

    response = _call(_client(_bot(guild), tmp_path), method, path=path)

    assert response.status_code == 403
    assert _changes(guild, method) == []


@every
def test_by_a_non_member_is_not_found(method, path, tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _unknown_member()

    response = _call(_client(_bot(guild), tmp_path), method, path=path)

    assert response.status_code == 404


@every
@pytest.mark.parametrize(
    "body",
    [
        _body(user_ids=[]),
        _body(user_ids=["not-a-snowflake"]),
        _body(study_id="123"),
        {"discordUserIds": TARGET_IDS},
        {"discordStudyId": STUDY_ID},
    ],
)
def test_rejects_a_bad_body(method, path, body, tmp_path):
    guild = FakeGuild()

    response = _call(_client(_bot(guild), tmp_path), method, body, path=path)

    assert response.status_code == 400
    assert _changes(guild, method) == []


@every
def test_rejects_too_many_users(method, path, tmp_path):
    user_ids = [str(400000000000000000 + i) for i in range(MAX_USERS + 1)]

    response = _call(_client(_bot(FakeGuild()), tmp_path), method, _body(user_ids), path=path)

    assert response.status_code == 400


@every
def test_counts_the_limit_after_removing_duplicates(method, path, tmp_path):
    user_ids = [str(400000000000000000 + i) for i in range(MAX_USERS)]
    body = _body(user_ids + user_ids[:1])

    response = _call(_client(_bot(FakeGuild(members=())), tmp_path), method, body, path=path)

    assert response.status_code == 200


@every
@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "Idempotency-Key"},
        {k: v for k, v in HEADERS.items() if k != "X-Discord-User-ID"},
        {**HEADERS, "X-Discord-User-ID": "abc"},
    ],
)
def test_rejects_bad_headers(method, path, headers, tmp_path):
    response = _call(_client(_bot(FakeGuild()), tmp_path), method, headers=headers, path=path)

    assert response.status_code == 400


@every
def test_rejects_a_wrong_api_key(method, path, tmp_path):
    headers = {**HEADERS, "X-API-Key": "nope"}

    response = _call(_client(_bot(FakeGuild()), tmp_path), method, headers=headers, path=path)

    assert response.status_code == 401


@every
def test_before_connect_is_unavailable(method, path, tmp_path):
    response = _call(_client(_bot(FakeGuild(), ready=False), tmp_path), method, path=path)

    assert response.status_code == 503


# --- assign-role / remove-role ------------------------------------------------


def test_assign_role_gives_the_role_in_the_path(tmp_path):
    guild = FakeGuild()

    response = _assign(_client(_bot(guild), tmp_path), path=STUDY_PATH)

    assert response.json() == {"succeededCount": 3, "failed": []}
    for member in guild.targets.values():
        member.add_roles.assert_awaited_once_with(guild.study_role)


def test_remove_role_takes_the_role_in_the_path(tmp_path):
    guild = FakeGuild()

    response = _remove(_client(_bot(guild), tmp_path), path=STUDY_PATH)

    assert response.json() == {"succeededCount": 3, "failed": []}
    for member in guild.targets.values():
        member.remove_roles.assert_awaited_once_with(guild.study_role)


@both
def test_study_role_by_the_system_is_allowed_without_a_member_lookup(method, tmp_path):
    guild = FakeGuild(cached=TARGET_IDS)

    response = _call(_client(_bot(guild), tmp_path), method, headers=SYSTEM_HEADERS, path=STUDY_PATH)

    assert response.status_code == 200
    assert len(_changes(guild, method)) == 3
    guild.fetch_member.assert_not_awaited()


@both
def test_navigator_role_by_the_system_is_forbidden(method, tmp_path):
    guild = FakeGuild()

    response = _call(_client(_bot(guild), tmp_path), method, headers=SYSTEM_HEADERS)

    assert response.status_code == 403
    assert _changes(guild, method) == []


@both
@pytest.mark.parametrize("role_id", [CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID, GUILD_ID])
@pytest.mark.parametrize("headers", [HEADERS, SYSTEM_HEADERS])
def test_study_role_refuses_captain_navigator_and_everyone(method, role_id, headers, tmp_path):
    guild = FakeGuild()
    guild.roles[GUILD_ID] = Mock(id=GUILD_ID)

    response = _call(
        _client(_bot(guild), tmp_path), method, headers=headers, path=f"/api/v1/roles/{role_id}/users"
    )

    assert response.status_code == 400
    assert f"role {role_id}" in response.json()["detail"]
    assert _changes(guild, method) == []


@both
@pytest.mark.parametrize(
    "missing, setting",
    [("captain_role_id", "DISCORD_CAPTAIN_ROLE_ID"), ("navigator_role_id", "DISCORD_NAVIGATOR_ROLE_ID")],
)
def test_study_role_by_the_system_without_a_role_setting_conflicts(method, missing, setting, tmp_path):
    # The system skips the caller check, so nothing there would notice the gap.
    guild = FakeGuild()
    client = _client(_bot(guild), tmp_path, **{missing: None})

    response = _call(client, method, headers=SYSTEM_HEADERS, path=STUDY_PATH)

    assert response.status_code == 409
    assert setting in response.json()["detail"]
    assert _changes(guild, method) == []


@both
def test_study_role_missing_from_the_guild_is_not_found_and_changes_nothing(method, tmp_path):
    guild = FakeGuild(roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID))

    response = _call(_client(_bot(guild), tmp_path), method, path=STUDY_PATH)

    assert response.status_code == 404
    assert response.json()["detail"] == f"role {STUDY_ROLE_ID} not found in the guild"
    assert _changes(guild, method) == []


@both
@pytest.mark.parametrize("role_id", ["123", "abc", "1" * 21])
def test_study_role_rejects_a_bad_role_id(method, role_id, tmp_path):
    guild = FakeGuild()

    response = _call(_client(_bot(guild), tmp_path), method, path=f"/api/v1/roles/{role_id}/users")

    assert response.status_code == 400
    assert _changes(guild, method) == []


@both
def test_study_role_logs_the_role(method, tmp_path, caplog):
    caplog.set_level("INFO")

    _call(_client(_bot(FakeGuild()), tmp_path), method, path=STUDY_PATH)

    assert f"role {STUDY_ROLE_ID}" in caplog.text


@both
def test_the_fixed_navigator_path_wins_over_the_dynamic_one(method, tmp_path):
    guild = FakeGuild()

    response = _call(_client(_bot(guild), tmp_path), method)

    assert response.status_code == 200
    attr = "add_roles" if method == "POST" else "remove_roles"
    for member in guild.targets.values():
        getattr(member, attr).assert_awaited_once_with(guild.navigator)
