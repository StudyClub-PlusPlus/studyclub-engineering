from unittest.mock import AsyncMock, Mock

import discord
import pytest
from fastapi.testclient import TestClient

from app.api.routes.channels import MAX_ANNOUNCEMENT_MSG
from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
NAVIGATOR_ROLE_ID = 100000000000000003
ALERT_CHANNEL_ID = 1327394882193883140
ANNOUNCEMENT_CHANNEL_ID = 1327394882193883141
USER_ID = "327394882193883136"
BOT_ID = "427394882193883136"
API_KEY = "test-api-key"
HEADERS = {
    "X-API-Key": API_KEY,
    "X-Discord-User-ID": USER_ID,
    "Idempotency-Key": "9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa",
}
MSG = "알고리즘 스터디 2기 모집을 시작합니다. 신청은 이번 주 금요일까지입니다."


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


def _channel(channel_id, *, spec=discord.TextChannel, visible=True, mention_everyone=True):
    channel = Mock(spec=spec, id=channel_id)
    channel.permissions_for.return_value = Mock(
        view_channel=visible, mention_everyone=mention_everyone
    )
    channel.send = AsyncMock()
    return channel


class FakeGuild:
    """A guild with one member, an announcement channel, and an alert channel."""

    def __init__(
        self,
        *,
        member_roles=(CAPTAIN_ROLE_ID,),
        roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID),
        channel_spec=discord.TextChannel,
        channel_visible=True,
        mention_everyone=True,
        alert_channel=True,
    ):
        self.me = Mock(name="bot member")
        self.roles = {role_id: Mock(id=role_id) for role_id in roles}
        self.member = Mock()
        self.member.get_role.side_effect = (
            lambda rid: self.roles.get(rid) if rid in member_roles else None
        )
        self.fetch_member = AsyncMock(return_value=self.member)
        self.channel = _channel(
            ANNOUNCEMENT_CHANNEL_ID,
            spec=channel_spec,
            visible=channel_visible,
            mention_everyone=mention_everyone,
        )
        self.alert = _channel(ALERT_CHANNEL_ID)
        self.channels = {self.channel.id: self.channel}
        if alert_channel:
            self.channels[self.alert.id] = self.alert

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
        "announcement_channel_id": ANNOUNCEMENT_CHANNEL_ID,
        "api_key": API_KEY,
        "db_path": str(tmp_path / "discord.sqlite3"),
    }
    return TestClient(create_app(Settings(**{**values, **overrides}), bot))


def _post(client, msg=MSG, headers=HEADERS):
    return client.post("/api/v1/channels/announcement/msg", json={"msg": msg}, headers=headers)


def _sent(guild):
    """Return the content of the single announcement the bot posted."""
    guild.channel.send.assert_awaited_once()
    return guild.channel.send.await_args.args[0]


def test_send_announcement_message_posts_under_an_everyone_line(tmp_path):
    """No sender line: an announcement goes out in the organisers' name."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert response.content == b""
    assert _sent(guild) == f"@everyone\n{MSG}"
    assert "발신" not in _sent(guild)
    guild.fetch_member.assert_awaited_once_with(int(USER_ID))


def test_send_announcement_message_notifies_everyone_and_nobody_else(tmp_path):
    guild = FakeGuild()

    _post(_client(_bot(guild), tmp_path), msg="<@&100000000000000002> 확인 바랍니다")

    allowed = guild.channel.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.users, allowed.roles) == (True, False, False)


@pytest.mark.parametrize(
    "msg, expected",
    [
        ("@everyone 모두 확인", "모두 확인"),
        ("@here 확인", "확인"),
        # One pass closes the gap into a live @everyone, so removal must repeat.
        ("회의 @every@hereone 확인", "회의  확인"),
    ],
)
def test_send_announcement_message_removes_mass_mentions_from_msg(msg, expected, tmp_path):
    """Allowing @everyone makes stripping the only defence -- a @here in msg must not ring."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 204
    content = _sent(guild)
    assert content == f"@everyone\n{expected}"
    assert "@here" not in content
    # Only the line the bot adds.
    assert content.count("@everyone") == 1


@pytest.mark.parametrize("msg", ["@everyone", "@here  @everyone", "@every@hereone"])
def test_send_announcement_message_that_is_empty_after_stripping_is_a_bad_request(msg, tmp_path):
    """An empty announcement that only rings @everyone is a caller bug, not a 204."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("msg", ["", "   ", "x" * (MAX_ANNOUNCEMENT_MSG + 1)])
def test_send_announcement_message_rejects_a_bad_msg(msg, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg=msg)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("body", [{}, {"msg": 5}, {"msg": None}])
def test_send_announcement_message_rejects_a_bad_body(body, tmp_path):
    guild = FakeGuild()
    client = _client(_bot(guild), tmp_path)

    response = client.post("/api/v1/channels/announcement/msg", json=body, headers=HEADERS)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_announcement_message_measures_length_before_stripping(tmp_path):
    """An announcement that only fits once @everyone is gone is still too long."""
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg="@everyone" + "x" * MAX_ANNOUNCEMENT_MSG)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_announcement_message_accepts_the_longest_msg(tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), msg="x" * MAX_ANNOUNCEMENT_MSG)

    assert response.status_code == 204
    assert len(_sent(guild)) <= 2000


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-API-Key"},
        {**HEADERS, "X-API-Key": "wrong"},
    ],
)
def test_send_announcement_message_rejects_missing_or_wrong_api_key(headers, tmp_path):
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
def test_send_announcement_message_rejects_bad_headers(headers, tmp_path):
    guild = FakeGuild()

    response = _post(_client(_bot(guild), tmp_path), headers=headers)

    assert response.status_code == 400
    guild.channel.send.assert_not_awaited()


def test_send_announcement_message_by_a_navigator_is_forbidden(tmp_path):
    """An announcement reaches every member, so unlike an alert it is captain only."""
    guild = FakeGuild(member_roles=(NAVIGATOR_ROLE_ID,))

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()


def test_send_announcement_message_without_a_navigator_role_configured_still_works(tmp_path):
    """The navigator setting is never read here, so leaving it unset is not a 409."""
    guild = FakeGuild(roles=(CAPTAIN_ROLE_ID,))

    response = _post(_client(_bot(guild), tmp_path, navigator_role_id=None))

    assert response.status_code == 204


def test_send_announcement_message_with_a_missing_captain_role_is_not_found(tmp_path):
    guild = FakeGuild(member_roles=(), roles=())

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "captain role" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


def test_send_announcement_message_by_non_member_is_not_found(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error(discord.NotFound, 404)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]


def test_send_announcement_message_when_member_lookup_fails_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502


def test_send_announcement_message_with_unknown_channel_is_not_found(tmp_path):
    response = _post(
        _client(_bot(FakeGuild()), tmp_path, announcement_channel_id=ANNOUNCEMENT_CHANNEL_ID + 9)
    )

    assert response.status_code == 404
    assert "announcement channel" in response.json()["detail"]


def test_send_announcement_message_to_a_channel_the_bot_cannot_view_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild(channel_visible=False)), tmp_path))

    assert response.status_code == 404


def test_send_announcement_message_to_a_non_text_channel_is_not_found(tmp_path):
    """A category or voice ID in the setting is a server setup problem, like a missing channel."""
    guild = FakeGuild(channel_spec=discord.VoiceChannel)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a text channel" in response.json()["detail"]
    guild.channel.send.assert_not_awaited()


@pytest.mark.parametrize("missing", ["guild_id", "captain_role_id", "announcement_channel_id"])
def test_send_announcement_message_without_configuration_conflicts(missing, tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, **{missing: None}))

    assert response.status_code == 409
    assert missing.upper() in response.json()["detail"]


def test_send_announcement_message_with_unknown_guild_is_not_found(tmp_path):
    response = _post(_client(_bot(FakeGuild()), tmp_path, guild_id=GUILD_ID + 1))

    assert response.status_code == 404


def test_send_announcement_message_when_discord_rejects_the_send_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error()

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    guild.alert.send.assert_not_awaited()


def test_send_announcement_message_without_send_permission_is_bad_gateway_and_logged(
    tmp_path, caplog
):
    """One fixed channel, so a missing permission fails every request -- say so in the log."""
    guild = FakeGuild()
    guild.channel.send.side_effect = _discord_error(discord.Forbidden, 403)

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 502
    assert "Send Messages" in caplog.text


def test_send_announcement_message_without_bot_is_unavailable(tmp_path):
    assert _post(_client(None, tmp_path)).status_code == 503


def test_send_announcement_message_before_connect_is_unavailable(tmp_path):
    assert _post(_client(_bot(FakeGuild(), ready=False), tmp_path)).status_code == 503


def test_send_announcement_message_without_mention_everyone_warns_the_alert_channel(tmp_path):
    """Discord posts it silently rather than refusing, so the alert channel is the only signal."""
    guild = FakeGuild(mention_everyone=False)

    response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert _sent(guild) == f"@everyone\n{MSG}"
    guild.alert.send.assert_awaited_once()
    warning = guild.alert.send.await_args.args[0]
    assert f"<#{ANNOUNCEMENT_CHANNEL_ID}>" in warning
    assert "Mention Everyone" in warning
    allowed = guild.alert.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.users, allowed.roles) == (False, False, False)


def test_send_announcement_message_with_mention_everyone_warns_nobody(tmp_path):
    guild = FakeGuild()

    assert _post(_client(_bot(guild), tmp_path)).status_code == 204
    guild.alert.send.assert_not_awaited()


@pytest.mark.parametrize("alert_channel_id", [None, ALERT_CHANNEL_ID + 9])
def test_send_announcement_message_survives_an_unusable_alert_channel(alert_channel_id, tmp_path):
    """The announcement is already up: a failed warning must not make the caller retry."""
    guild = FakeGuild(mention_everyone=False)

    response = _post(_client(_bot(guild), tmp_path, alert_channel_id=alert_channel_id))

    assert response.status_code == 204
    assert _sent(guild) == f"@everyone\n{MSG}"


def test_send_announcement_message_survives_a_failed_warning(tmp_path, caplog):
    guild = FakeGuild(mention_everyone=False)
    guild.alert.send.side_effect = _discord_error(discord.Forbidden, 403)

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert "Mention Everyone" in caplog.text


def test_send_announcement_message_survives_a_dropped_warning_connection(tmp_path, caplog):
    """A connection error is an OSError, not a discord.HTTPException -- still no 500.

    A 500 here would have the caller retry and ring @everyone twice.
    """
    guild = FakeGuild(mention_everyone=False)
    guild.alert.send.side_effect = OSError(104, "Connection reset by peer")

    with caplog.at_level("ERROR"):
        response = _post(_client(_bot(guild), tmp_path))

    assert response.status_code == 204
    assert _sent(guild) == f"@everyone\n{MSG}"
    assert "could not warn the alert channel" in caplog.text


def test_send_announcement_message_as_the_bot_is_forbidden(tmp_path):
    """An announcement rings the whole guild, so only a captain sends one -- not the system."""
    guild = FakeGuild(member_roles=())
    headers = {**HEADERS, "X-Discord-User-ID": BOT_ID}

    response = _post(_client(_bot(guild), tmp_path, bot_id=int(BOT_ID)), headers=headers)

    assert response.status_code == 403
    guild.channel.send.assert_not_awaited()
