import json

import pytest

from app.config import SettingsStore, load_config_file, load_settings


def test_load_config_file_missing(tmp_path):
    """A missing config file yields an empty mapping."""
    assert load_config_file(tmp_path / "nope.json") == {}


def test_load_config_file_reads_json(tmp_path):
    """An existing config file is parsed as JSON."""
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"command_prefix": "?"}))
    assert load_config_file(path) == {"command_prefix": "?"}


@pytest.mark.parametrize("environ", [{}, {"DISCORD_TOKEN": "   "}])
def test_load_settings_without_token_yields_none(tmp_path, environ):
    """A missing or blank ``DISCORD_TOKEN`` leaves the token unset, not an error."""
    settings = load_settings(
        config_path=tmp_path / "config.json",
        environ=environ,
        load_dotenv_file=False,
    )
    assert settings.discord_token is None


def test_load_settings_reads_output_channel_and_ignores_removed_keys(tmp_path):
    """Only the output channel is taken from config.json; prefix/log level stay fixed."""
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps(
            {
                "discord_bot_output_channel": 123456789012345678,
                "command_prefix": "?",
                "log_level": "DEBUG",
            }
        )
    )

    settings = load_settings(
        config_path=path,
        environ={"DISCORD_TOKEN": "secret-token"},
        load_dotenv_file=False,
    )

    assert settings.discord_token == "secret-token"
    assert settings.output_channel_id == 123456789012345678
    # command_prefix / log_level are no longer sourced from config.json
    assert settings.command_prefix == "!"
    assert settings.log_level == "INFO"


def test_load_settings_defaults_without_config_file(tmp_path):
    """Without a config file the settings fall back to their defaults."""
    settings = load_settings(
        config_path=tmp_path / "absent.json",
        environ={"DISCORD_TOKEN": "t"},
        load_dotenv_file=False,
    )
    assert settings.command_prefix == "!"
    assert settings.api_port == 4800
    assert settings.output_channel_id is None


def test_settings_store_reload_picks_up_file_changes(tmp_path, monkeypatch):
    """``reload`` re-reads the file and updates the stored settings."""
    path = tmp_path / "config.json"
    path.write_text(json.dumps({"discord_bot_output_channel": None}))
    monkeypatch.setenv("DISCORD_TOKEN", "t")
    monkeypatch.setenv("CONFIG_PATH", str(path))

    store = SettingsStore(load_settings(load_dotenv_file=False))
    assert store.current.output_channel_id is None

    path.write_text(json.dumps({"discord_bot_output_channel": 42}))
    reloaded = store.reload()

    assert reloaded.output_channel_id == 42
    assert store.current.output_channel_id == 42