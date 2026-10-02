import pytest

from app.config import load_settings


@pytest.mark.parametrize("environ", [{}, {"DISCORD_TOKEN": "   "}])
def test_load_settings_without_token_yields_none(environ):
    """A missing or blank ``DISCORD_TOKEN`` leaves the token unset, not an error."""
    settings = load_settings(environ=environ, load_dotenv_file=False)
    assert settings.discord_token is None


def test_load_settings_reads_command_channel():
    """The command channel comes from the environment as an int."""
    settings = load_settings(
        environ={
            "DISCORD_TOKEN": "secret-token",
            "DISCORD_BOT_CHANNEL_ID": "123456789012345678",
        },
        load_dotenv_file=False,
    )

    assert settings.discord_token == "secret-token"
    assert settings.command_channel_id == 123456789012345678


@pytest.mark.parametrize("raw", ["", "   "])
def test_load_settings_blank_command_channel_is_none(raw):
    """An unset or blank channel var means "no channel takes commands", not an error."""
    settings = load_settings(
        environ={"DISCORD_TOKEN": "t", "DISCORD_BOT_CHANNEL_ID": raw},
        load_dotenv_file=False,
    )
    assert settings.command_channel_id is None


def test_load_settings_drops_non_numeric_command_channel_with_a_warning(caplog):
    """A typo'd ID neither stops startup nor passes silently: it is logged and dropped."""
    with caplog.at_level("WARNING"):
        settings = load_settings(
            environ={"DISCORD_TOKEN": "t", "DISCORD_BOT_CHANNEL_ID": "not-an-id"},
            load_dotenv_file=False,
        )

    assert settings.command_channel_id is None
    assert "not-an-id" in caplog.text


def test_load_settings_defaults():
    """Settings not sourced from the environment keep their fixed defaults."""
    settings = load_settings(environ={"DISCORD_TOKEN": "t"}, load_dotenv_file=False)

    assert settings.command_prefix == "!"
    assert settings.api_port == 4800
    assert settings.log_level == "INFO"
    assert settings.command_channel_id is None


def test_load_settings_reads_study_settings():
    """The guild, roles, channels, and API key come from the environment."""
    settings = load_settings(
        environ={
            "DISCORD_GUILD_ID": "123456789012345678",
            "DISCORD_CAPTAIN_ROLE_ID": "223456789012345678",
            "DISCORD_NAVIGATOR_ROLE_ID": "323456789012345678",
            "DISCORD_BOT_ID": "623456789012345678",
            "DISCORD_ALERT_CHANNEL_ID": "423456789012345678",
            "DISCORD_ANNOUNCEMENT_CHANNEL_ID": "523456789012345678",
            "DISCORD_BULLETIN_CHANNEL_ID": "723456789012345678",
            "DISCORD_API_KEY": " key ",
        },
        load_dotenv_file=False,
    )

    assert settings.guild_id == 123456789012345678
    assert settings.captain_role_id == 223456789012345678
    assert settings.navigator_role_id == 323456789012345678
    assert settings.bot_id == 623456789012345678
    assert settings.alert_channel_id == 423456789012345678
    assert settings.announcement_channel_id == 523456789012345678
    assert settings.bulletin_channel_id == 723456789012345678
    assert settings.api_key == "key"


def test_load_settings_study_settings_default_to_unset(caplog):
    """Blank values leave the settings unset; a non-numeric ID is logged and dropped."""
    with caplog.at_level("WARNING"):
        settings = load_settings(
            environ={
                "DISCORD_GUILD_ID": "not-an-id",
                "DISCORD_ALERT_CHANNEL_ID": "also-not-an-id",
                "DISCORD_ANNOUNCEMENT_CHANNEL_ID": "",
                "DISCORD_BULLETIN_CHANNEL_ID": "nor-this",
                "DISCORD_API_KEY": "  ",
            },
            load_dotenv_file=False,
        )

    assert settings.guild_id is None
    assert settings.captain_role_id is None
    assert settings.navigator_role_id is None
    assert settings.bot_id is None
    assert settings.alert_channel_id is None
    assert settings.announcement_channel_id is None
    assert settings.bulletin_channel_id is None
    assert settings.api_key is None
    assert settings.db_path == "data/discord.sqlite3"
    assert "not-an-id" in caplog.text
    assert "nor-this" in caplog.text


def test_backend_base_url_is_read_from_api_base_url():
    """The bot calls the backend for !출석체크, reusing the key the rest of the stack uses."""
    settings = load_settings({"API_BASE_URL": "http://api:8080"}, load_dotenv_file=False)

    assert settings.backend_base_url == "http://api:8080"


def test_backend_base_url_loses_its_trailing_slash():
    """The path is appended, so a trailing slash would double up."""
    settings = load_settings({"API_BASE_URL": "http://api:8080/"}, load_dotenv_file=False)

    assert settings.backend_base_url == "http://api:8080"


def test_backend_base_url_unset_is_none():
    """Missing means the attendance command refuses, not that it posts to nowhere."""
    assert load_settings({}, load_dotenv_file=False).backend_base_url is None
