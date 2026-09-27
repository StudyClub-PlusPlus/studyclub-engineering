import pytest

from app.config import load_settings


@pytest.mark.parametrize("environ", [{}, {"DISCORD_TOKEN": "   "}])
def test_load_settings_without_token_yields_none(environ):
    """A missing or blank ``DISCORD_TOKEN`` leaves the token unset, not an error."""
    settings = load_settings(environ=environ, load_dotenv_file=False)
    assert settings.discord_token is None


def test_load_settings_reads_output_channel():
    """The output channel comes from the environment as an int."""
    settings = load_settings(
        environ={
            "DISCORD_TOKEN": "secret-token",
            "DISCORD_BOT_OUTPUT_CHANNEL": "123456789012345678",
        },
        load_dotenv_file=False,
    )

    assert settings.discord_token == "secret-token"
    assert settings.output_channel_id == 123456789012345678


@pytest.mark.parametrize("raw", ["", "   "])
def test_load_settings_blank_output_channel_is_none(raw):
    """An unset or blank channel var means "no output channel", not an error."""
    settings = load_settings(
        environ={"DISCORD_TOKEN": "t", "DISCORD_BOT_OUTPUT_CHANNEL": raw},
        load_dotenv_file=False,
    )
    assert settings.output_channel_id is None


def test_load_settings_drops_non_numeric_output_channel_with_a_warning(caplog):
    """A typo'd ID neither stops startup nor passes silently: it is logged and dropped."""
    with caplog.at_level("WARNING"):
        settings = load_settings(
            environ={"DISCORD_TOKEN": "t", "DISCORD_BOT_OUTPUT_CHANNEL": "not-an-id"},
            load_dotenv_file=False,
        )

    assert settings.output_channel_id is None
    assert "not-an-id" in caplog.text


def test_load_settings_defaults():
    """Settings not sourced from the environment keep their fixed defaults."""
    settings = load_settings(environ={"DISCORD_TOKEN": "t"}, load_dotenv_file=False)

    assert settings.command_prefix == "!"
    assert settings.api_port == 4800
    assert settings.log_level == "INFO"
    assert settings.output_channel_id is None


def test_load_settings_reads_study_settings():
    """The guild, captain and navigator roles, and API key come from the environment."""
    settings = load_settings(
        environ={
            "DISCORD_GUILD_ID": "123456789012345678",
            "DISCORD_CAPTAIN_ROLE_ID": "223456789012345678",
            "DISCORD_NAVIGATOR_ROLE_ID": "323456789012345678",
            "DISCORD_API_KEY": " key ",
        },
        load_dotenv_file=False,
    )

    assert settings.guild_id == 123456789012345678
    assert settings.captain_role_id == 223456789012345678
    assert settings.navigator_role_id == 323456789012345678
    assert settings.api_key == "key"


def test_load_settings_study_settings_default_to_unset(caplog):
    """Blank values leave the settings unset; a non-numeric ID is logged and dropped."""
    with caplog.at_level("WARNING"):
        settings = load_settings(
            environ={"DISCORD_GUILD_ID": "not-an-id", "DISCORD_API_KEY": "  "},
            load_dotenv_file=False,
        )

    assert settings.guild_id is None
    assert settings.captain_role_id is None
    assert settings.navigator_role_id is None
    assert settings.api_key is None
    assert settings.db_path == "data/discord.sqlite3"
    assert "not-an-id" in caplog.text
