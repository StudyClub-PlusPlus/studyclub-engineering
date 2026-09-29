import asyncio
from unittest.mock import AsyncMock, Mock

import discord
import pytest
from fastapi.testclient import TestClient

from app.api.routes.channels import MAX_MENTIONS, MAX_TOTAL
from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
NAVIGATOR_ROLE_ID = 100000000000000003
ALERT_CHANNEL_ID = 1327394882193883140
STUDY_ID = "1327394882193883136"
CHANNEL_ID = "1327394882193883137"
USER_ID = "327394882193883136"
MENTION_IDS = ["427394882193883136", "527394882193883136"]
API_KEY = "test-api-key"
HEADERS = {
    "X-API-Key": API_KEY,
    "X-Discord-User-ID": USER_ID,
    "Idempotency-Key": "9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa",
}
MSG = "이번 주 모임은 목요일 저녁 9시로 옮깁니다."


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


class FakeGuild:
    """A guild with one member and a text channel under the study's category."""

    def __init__(
        self,
        *,
        member_roles=(CAPTAIN_ROLE_ID,),
        roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID),
        channel_spec=discord.TextChannel,
        channel_visible=True,
        category_visible=True,
        category_id=int(STUDY_ID),
        members=MENTION_IDS,
    ):
        self.me = Mock(name="bot member")
        self.roles = {role_id: Mock(id=role_id) for role_id in roles}
        self.member = Mock()
        self.member.get_role.side_effect = (
            lambda rid: self.roles.get(rid) if rid in member_roles else None
        )
        self.fetch_member = AsyncMock(return_value=self.member)
        self.query_members = AsyncMock(
            side_effect=lambda user_ids, limit: [
                Mock(id=uid) for uid in user_ids if str(uid) in members
            ]
        )

        self.channel = Mock(spec=channel_spec, id=int(CHANNEL_ID), category_id=category_id)
        self.channel.permissions_for.return_value = Mock(view_channel=channel_visible)
        self.channel.send = AsyncMock()
        self.category = Mock(spec=discord.CategoryChannel, id=int(STUDY_ID))
        self.category.permissions_for.return_value = Mock(view_channel=category_visible)
        self.alert_channel = Mock(spec=discord.TextChannel, id=ALERT_CHANNEL_ID)
        self.alert_channel.permissions_for.return_value = Mock(view_channel=True)
        self.alert_channel.send = AsyncMock()
        self.channels = {c.id: c for c in (self.channel, self.category, self.alert_channel)}

    def get_role(self, role_id):
        return self.roles.get(role_id)

    def get_channel(self, channel_id):
        return self.channels.get(channel_id)


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
        "alert_channel_id": ALERT_CHANNEL_ID,
        "api_key": API_KEY,
        "db_path": str(tmp_path / "discord.sqlite3"),
    }
    return TestClient(create_app(Settings(**{**values, **overrides}), bot))


def _body(msg=MSG, user_ids=None, study_id=STUDY_ID):
    return {
        "discordStudyId": study_id,
        "msg": msg,
        "discordUserIds": MENTION_IDS if user_ids is None else user_ids,
    }


def _post(client, body=None, headers=HEADERS, channel_id=CHANNEL_ID):
    return client.post(
        f"/api/v1/channels/{channel_id}/msg",
        json=_body() if body is None else body,
        headers=headers,
    )


def _sent(guild):
    """Return the content of the single message the bot posted."""
    guild.channel.send.assert_awaited_once()
    return guild.channel.send.await_args.args[0]


def test_send_message_posts_under_a_sender_line_and_a_mention_line(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert response.content == b""
    assert _sent(guild) == f"발신: <@{USER_ID}>\n<@{MENTION_IDS[0]}> <@{MENTION_IDS[1]}>\n{MSG}"


def test_send_message_without_mentions_posts_only_the_sender_line(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(user_ids=[]))

    assert response.status_code == 204
    assert _sent(guild) == f"발신: <@{USER_ID}>\n{MSG}"
    # An empty list is not a member query; discord.py refuses one anyway.
    guild.query_members.assert_not_awaited()


def test_send_message_mentions_each_user_once_in_request_order(tmp_path):
    guild = FakeGuild()
    repeated = [MENTION_IDS[1], MENTION_IDS[0], MENTION_IDS[1]]

    response = _post(_client(_bot(guild), tmp_path), _body(user_ids=repeated))

    assert response.status_code == 204
    assert f"<@{MENTION_IDS[1]}> <@{MENTION_IDS[0]}>" in _sent(guild)


def test_send_message_notifies_only_the_requested_users(tmp_path):
    guild = FakeGuild()

    _post(_client(_bot(guild), tmp_path), _body(msg=f"<@&{CAPTAIN_ROLE_ID}> 확인 바랍니다"))

    allowed = guild.channel.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.roles) == (False, False)
    assert [str(user.id) for user in allowed.users] == MENTION_IDS


def test_send_message_looks_the_mention_targets_up_in_one_query(tmp_path):
    """40 member lookups over HTTP would make the request take seconds."""
    guild = FakeGuild()

    _post(_client(_bot(guild), tmp_path))

    guild.query_members.assert_awaited_once()
    assert guild.query_members.await_args.kwargs["user_ids"] == [int(u) for u in MENTION_IDS]


def test_send_message_by_a_navigator_is_allowed(tmp_path):
    guild = FakeGuild(member_roles=(NAVIGATOR_ROLE_ID,))

    assert _post(_client(_bot(guild), tmp_path)).status_code == 204


@pytest.mark.parametrize(
    "msg, expected",
    [
        ("@everyone 모두 확인", "모두 확인"),
        ("@here 확인", "확인"),
        # One pass closes the gap into a live @everyone, so removal must repeat.
        ("회의 @every@hereone 확인", "회의  확인"),
    ],
)
def test_send_message_removes_mass_mentions_until_none_are_left(msg, expected, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(msg=msg))

    assert response.status_code == 204
    content = _sent(guild)
    assert content.endswith(f"\n{expected}")
    assert "@everyone" not in content and "@here" not in content


@pytest.mark.parametrize("msg", ["@everyone", "@here  @everyone", "@every@hereone"])
def test_send_message_that_is_empty_after_stripping_is_a_bad_request(msg, tmp_path):
    """Nothing left to say means the request would only ring phones."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(msg=msg))

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("msg", ["", "   "])
def test_send_message_rejects_a_blank_msg(msg, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(msg=msg))

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize(
    "body",
    [
        {"msg": MSG, "discordUserIds": []},
        {"discordStudyId": STUDY_ID, "discordUserIds": []},
        {"discordStudyId": STUDY_ID, "msg": MSG},
        {"discordStudyId": STUDY_ID, "msg": MSG, "discordUserIds": "not a list"},
        {"discordStudyId": STUDY_ID, "msg": 5, "discordUserIds": []},
        {"discordStudyId": 1327394882193883136, "msg": MSG, "discordUserIds": []},
        {"discordStudyId": "123", "msg": MSG, "discordUserIds": []},
        {"discordStudyId": STUDY_ID, "msg": MSG, "discordUserIds": ["123"]},
    ],
)
def test_send_message_rejects_a_bad_body(body, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), body)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("channel_id", ["123", "not-a-snowflake"])
def test_send_message_rejects_a_bad_channel_id(channel_id, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), channel_id=channel_id)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_message_counts_the_mention_limit_after_removing_duplicates(tmp_path):
    guild = FakeGuild(members=[str(600000000000000000 + i) for i in range(MAX_MENTIONS)])
    ids = [str(600000000000000000 + i) for i in range(MAX_MENTIONS)]

    response = _post(_client(_bot(guild), tmp_path), _body(msg="확인", user_ids=ids + ids))

    assert response.status_code == 204


def test_send_message_with_too_many_mentions_is_a_bad_request(tmp_path):
    """The extras are refused, not dropped: the caller must know who is left out."""
    guild = FakeGuild()
    ids = [str(600000000000000000 + i) for i in range(MAX_MENTIONS + 1)]

    response = _post(_client(_bot(guild), tmp_path), _body(user_ids=ids))

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_message_measures_the_sender_and_mention_lines_with_the_msg(tmp_path):
    """A msg that fits alone is still too long once the lines above it are counted."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(msg="x" * MAX_TOTAL, user_ids=[]))

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_message_measures_length_before_stripping(tmp_path):
    """A message that only fits once @everyone is gone is still too long."""
    guild = FakeGuild()
    msg = "@everyone" + "x" * (MAX_TOTAL - len(f"발신: <@{USER_ID}>") - 1)

    response = _post(_client(_bot(guild), tmp_path), _body(msg=msg, user_ids=[]))

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_message_accepts_the_longest_message_that_fits(tmp_path):
    guild = FakeGuild()
    room = MAX_TOTAL - len(f"발신: <@{USER_ID}>") - 1

    response = _post(_client(_bot(guild), tmp_path), _body(msg="x" * room, user_ids=[]))

    assert response.status_code == 204
    assert len(_sent(guild)) == MAX_TOTAL


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-API-Key"},
        {**HEADERS, "X-API-Key": "wrong"},
    ],
)
def test_send_message_rejects_missing_or_wrong_api_key(headers, tmp_path):
    assert _post(_client(_bot(FakeGuild()), tmp_path), headers=headers).status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-Discord-User-ID"},
        {**HEADERS, "X-Discord-User-ID": "123"},
        {k: v for k, v in HEADERS.items() if k != "Idempotency-Key"},
    ],
)
def test_send_message_rejects_bad_headers(headers, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), headers=headers)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_message_by_a_member_with_neither_role_is_forbidden(tmp_path):
    guild = FakeGuild(member_roles=())

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize(
    "roles, missing",
    [((NAVIGATOR_ROLE_ID,), "captain role"), ((CAPTAIN_ROLE_ID,), "navigator role")],
)
def test_send_message_with_a_missing_role_is_not_found(roles, missing, tmp_path):
    """Both roles must exist even when the caller holds the other one."""
    guild = FakeGuild(member_roles=roles, roles=roles)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert missing in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_message_by_a_non_member_is_not_found(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error(discord.NotFound, 404)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]


def test_send_message_to_an_unknown_channel_is_not_found(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), channel_id=str(int(CHANNEL_ID) + 9))

    assert response.status_code == 404
    assert "not found by the bot" in response.json()["detail"]


def test_send_message_to_a_channel_the_bot_cannot_view_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild(channel_visible=False)), tmp_path))

    assert response.status_code == 404


def test_send_message_to_a_non_text_channel_is_a_bad_request(tmp_path):
    """The ID came from the caller, so a voice or forum channel is their mistake."""
    guild = FakeGuild(channel_spec=discord.VoiceChannel)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 400
    assert "not a text channel" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_message_logs_the_study_id(tmp_path, caplog):
    guild = FakeGuild()

    with caplog.at_level("INFO"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert STUDY_ID in caplog.text


def test_send_message_with_an_unknown_study_category_is_not_found(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), _body(study_id=str(int(STUDY_ID) + 9)))

    assert response.status_code == 404
    assert "category" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_message_with_a_category_the_bot_cannot_view_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild(category_visible=False)), tmp_path))

    assert response.status_code == 404


def test_send_message_to_a_channel_outside_the_study_is_not_found(tmp_path):
    """Without this a navigator could have the bot mention people anywhere."""
    guild = FakeGuild(category_id=int(STUDY_ID) + 9)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not in category" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_message_posts_without_the_mention_targets_outside_the_guild(tmp_path):
    """One stale ID must not keep the message from everyone else."""
    guild = FakeGuild(members=MENTION_IDS[:1])

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert _sent(guild) == f"발신: <@{USER_ID}>\n<@{MENTION_IDS[0]}>\n{MSG}"
    allowed = guild.channel.send.await_args.kwargs["allowed_mentions"]
    assert [str(user.id) for user in allowed.users] == MENTION_IDS[:1]


def test_send_message_posts_without_a_mention_line_when_no_target_is_a_member(tmp_path):
    guild = FakeGuild(members=[])

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert _sent(guild) == f"발신: <@{USER_ID}>\n{MSG}"


def test_send_message_tells_the_alert_channel_who_was_left_unmentioned(tmp_path):
    """The message is up, so this notice is the only sign anyone was left out."""
    guild = FakeGuild(members=MENTION_IDS[:1])

    _post(_client(_bot(guild), tmp_path))

    guild.alert_channel.send.assert_awaited_once()
    warning = guild.alert_channel.send.await_args.args[0]
    assert MENTION_IDS[1] in warning and MENTION_IDS[0] not in warning
    # Which action, and where it posted.
    assert "send-message" in warning and f"<#{CHANNEL_ID}>" in warning
    # A mention of someone outside the guild renders as broken text anyway.
    assert f"<@{MENTION_IDS[1]}>" not in warning
    allowed = guild.alert_channel.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.users, allowed.roles) == (False, False, False)


def test_send_message_is_posted_even_when_the_alert_fails(tmp_path):
    """The warning is best effort: the message is already up, so 204 stands."""
    guild = FakeGuild(members=[])
    guild.alert_channel.send.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    guild.channel.send.assert_awaited_once()


def test_send_message_is_posted_even_when_the_alert_connection_drops(tmp_path, caplog):
    """A connection error is an OSError, not a discord.HTTPException -- still no 500.

    A 500 here would have the caller retry a message that is already up.
    """
    guild = FakeGuild(members=[])
    guild.alert_channel.send.side_effect = OSError(104, "Connection reset by peer")

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    guild.channel.send.assert_awaited_once()
    assert "could not warn the alert channel" in caplog.text


def test_send_message_does_not_warn_when_every_target_is_a_member(tmp_path):
    guild = FakeGuild()

    _post(_client(_bot(guild), tmp_path))

    guild.alert_channel.send.assert_not_awaited()


def test_send_message_does_not_warn_when_the_message_never_went_up(tmp_path):
    """The notice says a message was posted, so a failed send must not send one."""
    guild = FakeGuild(members=[])
    guild.channel.send.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    guild.alert_channel.send.assert_not_awaited()


def test_send_message_when_the_member_query_times_out_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.query_members.side_effect = asyncio.TimeoutError

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("missing", ["guild_id", "captain_role_id", "navigator_role_id"])
def test_send_message_without_configuration_conflicts(missing, tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, **{missing: None}))

    assert response.status_code == 409
    assert missing.upper() in response.json()["detail"]


def test_send_message_with_unknown_guild_is_not_found(tmp_path):
    assert _post(_client(_bot(FakeGuild()), tmp_path, guild_id=GUILD_ID + 1)).status_code == 404


def test_send_message_when_discord_rejects_the_send_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error()

    assert _post(_client(_bot(guild), tmp_path)).status_code == 502


def test_send_message_without_send_permission_is_bad_gateway_and_logged(tmp_path, caplog):
    """The channel is the caller's, so the log must say which one is closed."""
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error(discord.Forbidden, 403)

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    assert "Send Messages" in caplog.text
    assert CHANNEL_ID in caplog.text and STUDY_ID in caplog.text


def test_send_message_without_bot_is_unavailable(tmp_path):
    assert _post(_client(None, tmp_path)).status_code == 503


def test_send_message_before_connect_is_unavailable(tmp_path):
    assert _post(_client(_bot(FakeGuild(), ready=False), tmp_path)).status_code == 503


@pytest.mark.parametrize("path", ["alert", "announcement"])
def test_the_fixed_channel_paths_win_over_the_dynamic_one(path, tmp_path):
    """Registered the other way round, "alert" would be read as a channel ID."""
    guild = FakeGuild()
    client = _client(_bot(guild), tmp_path, announcement_channel_id=ALERT_CHANNEL_ID)

    response = client.post(f"/api/v1/channels/{path}/msg", json={"msg": MSG}, headers=HEADERS)

    assert response.status_code == 204
    guild.alert_channel.send.assert_awaited_once()
