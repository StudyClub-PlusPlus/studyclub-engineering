from unittest.mock import AsyncMock, Mock

import discord
from fastapi.testclient import TestClient

from app.api.routes.ping import PING_CONTENT
from app.api.server import create_app
from app.config import Settings, SettingsStore


def _bot(channel=None, ready=True) -> Mock:
    """Return a stand-in bot whose ``get_channel`` yields ``channel``."""
    bot = Mock()
    bot.is_ready.return_value = ready
    bot.get_channel.return_value = channel
    return bot


def _client(bot, output_channel_id=42) -> TestClient:
    """Return a test client for an app wired to ``bot`` and that channel ID."""
    store = SettingsStore(Settings(output_channel_id=output_channel_id))
    return TestClient(create_app(store, bot))


def _channel() -> Mock:
    """Return a stand-in channel that accepts sends and returns a message."""
    channel = Mock()
    channel.send = AsyncMock(return_value=Mock(id=7))
    return channel


def test_ping_posts_to_configured_channel():
    """A ping sends the canned content to the configured channel."""
    channel = _channel()
    bot = _bot(channel)

    response = _client(bot).post("/api/v1/ping")

    assert response.status_code == 200
    assert response.json() == {"status": "sent", "channel_id": 42, "message_id": 7}
    bot.get_channel.assert_called_once_with(42)
    channel.send.assert_awaited_once_with("ping from client")


def test_ping_uses_the_current_store_value():
    """The channel is re-read per request, so a reload redirects the endpoint."""
    bot = _bot(_channel())
    store = SettingsStore(Settings(output_channel_id=42))
    client = TestClient(create_app(store, bot))

    store._settings = Settings(output_channel_id=99)
    response = client.post("/api/v1/ping")

    assert response.status_code == 200
    assert response.json()["channel_id"] == 99
    bot.get_channel.assert_called_once_with(99)


def test_ping_without_bot_is_unavailable():
    """With no token configured there is no bot to send with."""
    response = _client(None).post("/api/v1/ping")

    assert response.status_code == 503
    assert "DISCORD_TOKEN" in response.json()["detail"]


def test_ping_before_connect_is_unavailable():
    """A bot that has not finished connecting cannot resolve channels yet."""
    response = _client(_bot(_channel(), ready=False)).post("/api/v1/ping")

    assert response.status_code == 503
    assert "not connected" in response.json()["detail"]


def test_ping_without_configured_channel_conflicts():
    """config.json with a null output channel leaves nowhere to post."""
    response = _client(_bot(_channel()), output_channel_id=None).post("/api/v1/ping")

    assert response.status_code == 409


def test_ping_with_unknown_channel_is_not_found():
    """A channel ID the bot cannot see is reported as missing."""
    response = _client(_bot(None)).post("/api/v1/ping")

    assert response.status_code == 404
    assert "42" in response.json()["detail"]


def test_ping_surfaces_discord_failure():
    """A rejected send (e.g. missing permissions) becomes a 502."""
    channel = _channel()
    channel.send = AsyncMock(
        side_effect=discord.Forbidden(Mock(status=403, reason="Forbidden"), "no access")
    )

    response = _client(_bot(channel)).post("/api/v1/ping")

    assert response.status_code == 502


def test_ping_content_is_the_documented_string():
    """The posted text is the literal the README advertises."""
    assert PING_CONTENT == "ping from client"
