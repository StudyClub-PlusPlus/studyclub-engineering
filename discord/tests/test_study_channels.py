from unittest.mock import AsyncMock, Mock

import discord
import pytest
from fastapi.testclient import TestClient

from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
NAVIGATOR_ROLE_ID = 100000000000000003
STUDY_ID = "1327394882193883136"
USER_ID = "327394882193883136"
API_KEY = "test-api-key"
HEADERS = {"X-API-Key": API_KEY, "X-Discord-User-ID": USER_ID}


def _discord_error(cls=discord.HTTPException, status=500):
    return cls(Mock(status=status, reason="error"), "rejected")


def _channel(spec, channel_id, name, visible=True) -> Mock:
    channel = Mock(spec=spec, id=channel_id)
    channel.name = name
    channel.permissions_for.return_value = Mock(view_channel=visible)
    return channel


class FakeGuild:
    """A guild with one member and one study category holding text and voice channels."""

    def __init__(self, *, member_roles=(CAPTAIN_ROLE_ID,), roles=(CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID)):
        self.me = Mock(name="bot member")
        self.roles = {role_id: Mock(id=role_id) for role_id in roles}
        self.member = Mock()
        self.member.get_role.side_effect = lambda rid: self.roles.get(rid) if rid in member_roles else None
        self.fetch_member = AsyncMock(return_value=self.member)
        self.category = _channel(discord.CategoryChannel, int(STUDY_ID), "알고리즘 스터디")
        self.category.text_channels = [
            _channel(discord.TextChannel, 1327394882193883137, "일반"),
            _channel(discord.TextChannel, 1327394882193883141, "자료실"),
        ]
        self.category.voice_channels = [_channel(discord.VoiceChannel, 1327394882193883138, "스터디룸")]
        self.channels = {self.category.id: self.category}

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
        "api_key": API_KEY,
        "db_path": str(tmp_path / "discord.sqlite3"),
    }
    return TestClient(create_app(Settings(**{**values, **overrides}), bot))


def _get(client, study_id=STUDY_ID, headers=HEADERS):
    return client.get(f"/api/v1/studies/{study_id}/channels", headers=headers)


def test_get_study_channels_lists_text_then_voice_with_string_ids(tmp_path):
    guild = FakeGuild()

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == [
        {"discordChannelId": "1327394882193883137", "discordChannelName": "일반", "discordChannelType": "TEXT"},
        {"discordChannelId": "1327394882193883141", "discordChannelName": "자료실", "discordChannelType": "TEXT"},
        {"discordChannelId": "1327394882193883138", "discordChannelName": "스터디룸", "discordChannelType": "VOICE"},
    ]
    guild.fetch_member.assert_awaited_once_with(int(USER_ID))


def test_get_study_channels_allows_a_navigator(tmp_path):
    response = _get(_client(_bot(FakeGuild(member_roles=(NAVIGATOR_ROLE_ID,))), tmp_path))

    assert response.status_code == 200


def test_get_study_channels_leaves_out_channels_the_bot_cannot_view(tmp_path):
    guild = FakeGuild()
    guild.category.text_channels[1].permissions_for.return_value = Mock(view_channel=False)

    response = _get(_client(_bot(guild), tmp_path))

    assert [c["discordChannelName"] for c in response.json()] == ["일반", "스터디룸"]


def test_get_study_channels_of_an_empty_category_is_an_empty_list(tmp_path):
    guild = FakeGuild()
    guild.category.text_channels = []
    guild.category.voice_channels = []

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-API-Key"},
        {**HEADERS, "X-API-Key": "wrong"},
    ],
)
def test_get_study_channels_rejects_missing_or_wrong_api_key(headers, tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path), headers=headers)

    assert response.status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {k: v for k, v in HEADERS.items() if k != "X-Discord-User-ID"},
        {**HEADERS, "X-Discord-User-ID": "123"},
    ],
)
def test_get_study_channels_rejects_bad_user_header(headers, tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path), headers=headers)

    assert response.status_code == 400


@pytest.mark.parametrize("study_id", ["123", "abc", "1" * 21, "+327394882193883136"])
def test_get_study_channels_rejects_bad_study_id(study_id, tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path), study_id=study_id)

    assert response.status_code == 400


def test_get_study_channels_of_a_non_category_is_a_bad_request(tmp_path):
    """A text channel ID in the category's place is the caller's mistake."""
    guild = FakeGuild()
    text = guild.category.text_channels[0]
    guild.channels[text.id] = text

    response = _get(_client(_bot(guild), tmp_path), study_id=str(text.id))

    assert response.status_code == 400
    assert "not a category" in response.json()["detail"]


def test_get_study_channels_by_a_member_without_either_role_is_forbidden(tmp_path):
    response = _get(_client(_bot(FakeGuild(member_roles=())), tmp_path))

    assert response.status_code == 403


@pytest.mark.parametrize("missing", [CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID])
def test_get_study_channels_with_a_missing_role_is_not_found(missing, tmp_path):
    """Either role missing fails the request, even for a member who has the other one."""
    roles = tuple(r for r in (CAPTAIN_ROLE_ID, NAVIGATOR_ROLE_ID) if r != missing)
    guild = FakeGuild(member_roles=roles, roles=roles)

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "role" in response.json()["detail"]


def test_get_study_channels_by_non_member_is_not_found(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error(discord.NotFound, 404)

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 404
    assert "not a member" in response.json()["detail"]


def test_get_study_channels_when_member_lookup_fails_is_bad_gateway(tmp_path):
    guild = FakeGuild()
    guild.fetch_member.side_effect = _discord_error()

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 502


def test_get_study_channels_of_unknown_category_is_not_found(tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path), study_id="1327394882193883199")

    assert response.status_code == 404
    assert "category" in response.json()["detail"]


def test_get_study_channels_of_a_category_the_bot_cannot_view_is_not_found(tmp_path):
    guild = FakeGuild()
    guild.category.permissions_for.return_value = Mock(view_channel=False)

    response = _get(_client(_bot(guild), tmp_path))

    assert response.status_code == 404


def test_get_study_channels_without_bot_is_unavailable(tmp_path):
    assert _get(_client(None, tmp_path)).status_code == 503


def test_get_study_channels_before_connect_is_unavailable(tmp_path):
    """Before ready the cache is empty, so an empty list must not go out as a success."""
    assert _get(_client(_bot(FakeGuild(), ready=False), tmp_path)).status_code == 503


@pytest.mark.parametrize("missing", ["guild_id", "captain_role_id", "navigator_role_id"])
def test_get_study_channels_without_configuration_conflicts(missing, tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path, **{missing: None}))

    assert response.status_code == 409


def test_get_study_channels_with_unknown_guild_is_not_found(tmp_path):
    response = _get(_client(_bot(FakeGuild()), tmp_path, guild_id=GUILD_ID + 1))

    assert response.status_code == 404
