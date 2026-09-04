import json
from unittest.mock import AsyncMock

import discord
import pytest
from discord.ext import commands

from app.bot.commands.reload_cmd import build_reload_response, register
from app.config import Settings, SettingsStore, load_settings


def _make_bot() -> commands.Bot:
    """Return a minimal bot instance for command registration tests."""
    return commands.Bot(command_prefix="!", intents=discord.Intents.none())


def _settings(output_channel_id=None, extra=None) -> Settings:
    """Return a Settings snapshot for response-formatting tests."""
    return Settings(
        discord_token="t", output_channel_id=output_channel_id, extra=extra or {}
    )


def test_build_reload_response_variants():
    """Each channel-lookup outcome produces its own message, plus the extra dict."""
    assert "no output channel" in build_reload_response(_settings(), None)
    assert "not in cache" in build_reload_response(_settings(42), None)
    assert build_reload_response(_settings(42), "general") == (
        "config reloaded — output channel: #general (42); extra: {}"
    )
    assert "extra: {'k': 'v'}" in build_reload_response(
        _settings(42, {"k": "v"}), "general"
    )


def test_register_adds_command():
    """``register`` makes ``reloadConfig`` resolvable on the bot."""
    bot = _make_bot()
    register(bot, SettingsStore(None))
    assert bot.get_command("reloadConfig") is not None


@pytest.mark.asyncio
async def test_command_reloads_and_reports_channel(tmp_path, monkeypatch):
    """Invoking the command reloads config.json and reports the new channel."""
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"discord_bot_output_channel": None}))
    monkeypatch.setenv("DISCORD_TOKEN", "t")
    monkeypatch.setenv("CONFIG_PATH", str(path))

    store = SettingsStore(load_settings(load_dotenv_file=False))
    bot = _make_bot()
    register(bot, store)

    path.write_text(json.dumps({"discord_bot_output_channel": 42}))

    ctx = AsyncMock()
    await bot.get_command("reloadConfig").callback(ctx)

    assert store.current.output_channel_id == 42
    ctx.send.assert_awaited_once_with(build_reload_response(store.current, None))
