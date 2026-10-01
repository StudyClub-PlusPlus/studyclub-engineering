from unittest.mock import AsyncMock, Mock

import discord
import pytest
from fastapi.testclient import TestClient

from app.api.routes.channels import MAX_MSG, strip_mass_mentions
from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
NAVIGATOR_ROLE_ID = 100000000000000003
ALERT_CHANNEL_ID = 1327394882193883140
USER_ID = "327394882193883136"
BOT_ID = "427394882193883136"
API_KEY = "test-api-key"
HEADERS = {
    "X-API-Key": API_KEY,
    "X-Discord-User-ID": USER_ID,
    "Idempotency-Key": "9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa",
}
MSG = "알고리즘 스터디 1기가 완료 처리되었습니다."


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


class FakeGuild:
    """A guild with one member and an alert text channel the bot can post in."""

    def __init__(
        self,
        *,
        member_roles=(CAPTAIN_ROLE_ID,),
        roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID),
        channel_spec=discord.TextChannel,
        channel_visible=True,
    ):
        self.me = Mock(name="bot member")
        self.roles = {role_id: Mock(id=role_id) for role_id in roles}
        self.member = Mock()
        self.member.get_role.side_effect = lambda rid: self.roles.get(rid) if rid in member_roles else None
        self.fetch_member = AsyncMock(return_value=self.member)
        self.channel = Mock(spec=channel_spec, id=ALERT_CHANNEL_ID)
        self.channel.permissions_for.return_value = Mock(view_channel=channel_visible)
        self.channel.send = AsyncMock()
        self.channels = {self.channel.id: self.channel}

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


def _post(client, msg=MSG, headers=HEADERS):
    return client.post("/api/v1/channels/alert/msg", json={"msg": msg}, headers=headers)


def _sent(guild):
    """Return the content of the single message the bot posted."""
    guild.channel.send.assert_awaited_once()
    return guild.channel.send.await_args.args[0]


def test_send_alert_message_posts_the_message_under_a_sender_line(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert response.content == b""
    assert _sent(guild) == f"발신: <@{USER_ID}>\n{MSG}"
    guild.fetch_member.assert_awaited_once_with(int(USER_ID))


def test_send_alert_message_silences_every_mention(tmp_path):
    """The sender line and anything in msg render as names, but notify nobody."""
    guild = FakeGuild()

    _post(_client(_bot(guild), tmp_path), msg="<@&100000000000000002> 확인 바랍니다")

    allowed = guild.channel.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.users, allowed.roles) == (False, False, False)


def test_send_alert_message_by_a_navigator_is_forbidden(tmp_path):
    """A navigator never raises an alert by hand; the backend does it as the system."""
    guild = FakeGuild(member_roles=(NAVIGATOR_ROLE_ID,))

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize(
    "msg, expected",
    [
        # What removal leaves at either end is trimmed; a gap inside is not.
        ("@everyone 모두 확인", "모두 확인"),
        ("@here 확인", "확인"),
        # One pass closes the gap into a live @everyone, so removal must repeat.
        ("회의 @every@hereone 확인", "회의  확인"),
        ("회의 @ever@everyoneyone 확인", "회의  확인"),
    ],
)
def test_send_alert_message_removes_mass_mentions_until_none_are_left(msg, expected, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 204
    content = _sent(guild)
    assert content == f"발신: <@{USER_ID}>\n{expected}"
    assert "@everyone" not in content and "@here" not in content


def test_strip_mass_mentions_leaves_a_plain_message_alone():
    assert strip_mass_mentions(MSG) == MSG


@pytest.mark.parametrize("msg", ["@everyone", "@here  @everyone", "@every@hereone"])
def test_send_alert_message_that_is_empty_after_stripping_is_a_bad_request(msg, tmp_path):
    """An alert with nothing left to say is a caller bug, not a 204."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("msg", ["", "   ", "x" * (MAX_MSG + 1)])
def test_send_alert_message_rejects_a_bad_msg(msg, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("body", [{}, {"msg": 5}, {"msg": None}])
def test_send_alert_message_rejects_a_bad_body(body, tmp_path):
    guild = FakeGuild()
    client = _client(_bot(guild), tmp_path)

    response = client.post("/api/v1/channels/alert/msg", json=body, headers=HEADERS)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_alert_message_measures_length_before_stripping(tmp_path):
    """A message that only fits once @everyone is gone is still too long."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg="@everyone" + "x" * MAX_MSG)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_alert_message_accepts_the_longest_msg(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg="x" * MAX_MSG)

    assert response.status_code == 204
    assert len(_sent(guild)) <= 2000


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-API-Key"},
        {**HEADERS, "X-API-Key": "wrong"},
    ],
)
def test_send_alert_message_rejects_missing_or_wrong_api_key(headers, tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path), headers=headers)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-Discord-User-ID"},
        {**HEADERS, "X-Discord-User-ID": "123"},
        {k: v for k, v in HEADERS.items() if k != "Idempotency-Key"},
    ],
)
def test_send_alert_message_rejects_bad_headers(headers, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), headers=headers)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_alert_message_by_a_member_without_the_captain_role_is_forbidden(tmp_path):
    guild = FakeGuild(member_roles=())

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()


def test_send_alert_message_with_a_missing_captain_role_is_not_found(tmp_path):
    guild = FakeGuild(member_roles=(), roles=())

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "captain role" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_alert_message_without_a_navigator_role_configured_still_works(tmp_path):
    """The navigator setting is no longer read here, so leaving it unset is not a 409."""
    guild = FakeGuild(roles=(CAPTAIN_ROLE_ID,))

    response = _post(_client(_bot(guild), tmp_path, navigator_role_id=None))

    assert response.status_code == 204


def test_send_alert_message_by_non_member_is_not_found(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error(discord.NotFound, 404)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]


def test_send_alert_message_when_member_lookup_fails_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502


def test_send_alert_message_with_unknown_alert_channel_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, alert_channel_id=ALERT_CHANNEL_ID + 1))

    assert response.status_code == 404
    assert "alert channel" in response.json()["detail"]


def test_send_alert_message_to_a_channel_the_bot_cannot_view_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild(channel_visible=False)), tmp_path))

    assert response.status_code == 404


def test_send_alert_message_to_a_non_text_channel_is_not_found(tmp_path):
    """A category or voice ID in the setting is a server setup problem, like a missing channel."""
    guild = FakeGuild(channel_spec=discord.VoiceChannel)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a text channel" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("missing", ["guild_id", "captain_role_id", "alert_channel_id"])
def test_send_alert_message_without_configuration_conflicts(missing, tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, **{missing: None}))

    assert response.status_code == 409
    assert missing.upper() in response.json()["detail"]


def test_send_alert_message_with_unknown_guild_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, guild_id=GUILD_ID + 1))

    assert response.status_code == 404


def test_send_alert_message_when_discord_rejects_the_send_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502


def test_send_alert_message_without_send_permission_is_bad_gateway_and_logged(tmp_path, caplog):
    """One fixed channel, so a missing permission fails every request -- say so in the log."""
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error(discord.Forbidden, 403)

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    assert "Send Messages" in caplog.text


def test_send_alert_message_without_bot_is_unavailable(tmp_path):
    assert _post(_client(None, tmp_path)).status_code == 503


def test_send_alert_message_before_connect_is_unavailable(tmp_path):
    assert _post(_client(_bot(FakeGuild(), ready=False), tmp_path)).status_code == 503


def test_send_alert_message_as_the_system_needs_no_role(tmp_path):
    """The backend raises the alert itself, sending the bot's ID to say so."""
    guild = FakeGuild(member_roles=())
    headers = {**HEADERS, "X-Discord-User-ID": BOT_ID}

    response = _post(_client(_bot(guild), tmp_path, bot_id=int(BOT_ID)), headers=headers)

    assert response.status_code == 204
    assert _sent(guild) == f"발신: <@{BOT_ID}>\n{MSG}"
    # No member to look up and no role to resolve.
    guild.fetch_member.assert_not_awaited()


def test_send_alert_message_as_the_system_skips_the_role_configuration(tmp_path):
    """A system send holds no role, so an unset role setting cannot stop it."""
    guild = FakeGuild(roles=())
    headers = {**HEADERS, "X-Discord-User-ID": BOT_ID}

    response = _post(
        _client(_bot(guild), tmp_path, bot_id=int(BOT_ID), captain_role_id=None), headers=headers
    )

    assert response.status_code == 204


def test_send_alert_message_as_the_bot_without_bot_id_configured_is_forbidden(tmp_path):
    """Unset DISCORD_BOT_ID shuts the door rather than opening it to everyone."""
    guild = FakeGuild(member_roles=())
    headers = {**HEADERS, "X-Discord-User-ID": BOT_ID}

    response = _post(_client(_bot(guild), tmp_path, bot_id=None), headers=headers)

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()
