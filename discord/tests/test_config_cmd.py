from unittest.mock import ANY, AsyncMock, Mock

import discord
import pytest

from app.bot.commands import command_channel, config_cmd
from app.config import Settings

GUILD_ID = 100000000000000001
CAPTAIN_ROLE_ID = 100000000000000002
COMMAND_CHANNEL_ID = 300000000000000001
ALERT_CHANNEL_ID = 300000000000000002
ANCHOR_CATEGORY_ID = 300000000000000003
BOT_USER_ID = 400000000000000001
USER_ID = 327394882193883136


def _guild() -> Mock:
    """A guild holding one role, one text channel, one category, and the bot."""
    roles = {CAPTAIN_ROLE_ID: Mock(spec=discord.Role)}
    roles[CAPTAIN_ROLE_ID].name = "captain"

    text = Mock(spec=discord.TextChannel, mention=f"<#{ALERT_CHANNEL_ID}>")
    category = Mock(spec=discord.CategoryChannel)
    category.name = "구분선"
    channels = {ALERT_CHANNEL_ID: text, ANCHOR_CATEGORY_ID: category}

    members = {BOT_USER_ID: Mock(spec=discord.Member, display_name="StudyClub Bot")}

    guild = Mock(spec=discord.Guild, id=GUILD_ID)
    guild.name = "StudyClub"
    guild.get_role.side_effect = roles.get
    guild.get_channel.side_effect = channels.get
    guild.get_member.side_effect = members.get
    return guild


def _settings(**overrides) -> Settings:
    return Settings(
        **{
            "guild_id": GUILD_ID,
            "captain_role_id": CAPTAIN_ROLE_ID,
            "command_channel_id": COMMAND_CHANNEL_ID,
            **overrides,
        }
    )


def _ctx(*, roles=(CAPTAIN_ROLE_ID,), in_guild=True, channel_id=COMMAND_CHANNEL_ID) -> Mock:
    ctx = Mock()
    ctx.guild = _guild() if in_guild else None
    ctx.channel = Mock(id=channel_id)
    ctx.author = Mock(id=USER_ID)
    ctx.author.get_role.side_effect = lambda rid: Mock(id=rid) if rid in roles else None
    ctx.send = AsyncMock()
    return ctx


# --- describe --------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("", "(설정 안 됨)"),
        ("   ", "(설정 안 됨)"),
        (str(GUILD_ID), "StudyClub (server)"),
        (str(CAPTAIN_ROLE_ID), "@captain"),
        (str(ALERT_CHANNEL_ID), f"<#{ALERT_CHANNEL_ID}>"),
        (str(ANCHOR_CATEGORY_ID), "구분선 (category)"),
        (str(BOT_USER_ID), "StudyClub Bot (user)"),
        ("999999999999999999", "⚠️ 서버에서 찾을 수 없음 (999999999999999999)"),
    ],
)
def test_describe_says_what_the_id_is(raw, expected):
    assert config_cmd.describe(_guild(), raw) == expected


def test_describe_does_not_echo_a_value_that_is_not_an_id():
    """Under the safe prefix but not an ID, so there is no telling what it is."""
    assert config_cmd.describe(_guild(), "구분선") == "⚠️ ID 가 아님"


def test_describe_reads_the_guild_id_as_the_guild_not_as_everyone():
    """``@everyone`` shares the guild's ID, so the guild has to win."""
    guild = _guild()
    everyone = Mock(spec=discord.Role)
    everyone.name = "@everyone"
    guild.get_role.side_effect = lambda rid: everyone if rid == GUILD_ID else None

    assert config_cmd.describe(guild, str(GUILD_ID)) == "StudyClub (server)"


# --- build_lines -----------------------------------------------------------


def test_build_lines_shows_only_the_config_prefix_sorted_by_name():
    environ = {
        "DISCORD_CONFIG_GUILD_ID": str(GUILD_ID),
        "DISCORD_CONFIG_ALERT_CHANNEL_ID": str(ALERT_CHANNEL_ID),
        "DISCORD_CONFIG_CAPTAIN_ROLE_ID": str(CAPTAIN_ROLE_ID),
        "PATH": "/usr/bin",
    }

    assert config_cmd.build_lines(_guild(), environ) == [
        f"`DISCORD_CONFIG_ALERT_CHANNEL_ID`: <#{ALERT_CHANNEL_ID}>",
        "`DISCORD_CONFIG_CAPTAIN_ROLE_ID`: @captain",
        "`DISCORD_CONFIG_GUILD_ID`: StudyClub (server)",
    ]


def test_build_lines_never_shows_secrets():
    """Secrets share the ``DISCORD_`` prefix but not ``DISCORD_CONFIG_``."""
    environ = {
        "DISCORD_TOKEN": "sentinel-token",
        "DISCORD_API_KEY": "sentinel-api-key",
        "DISCORD_OAUTH_CLIENT_SECRET": "sentinel-oauth-secret",
        "DISCORD_BOT_URL": "http://sentinel-bot-url",
        "API_BASE_URL": "http://sentinel-backend",
        "DISCORD_CONFIG_CAPTAIN_ROLE_ID": str(CAPTAIN_ROLE_ID),
    }

    output = "\n".join(config_cmd.build_lines(_guild(), environ))

    assert "sentinel" not in output
    assert "TOKEN" not in output and "API_KEY" not in output and "SECRET" not in output


def test_build_lines_pings_nobody():
    """Roles and members are names, not ``<@&id>`` / ``<@id>`` mentions."""
    environ = {
        "DISCORD_CONFIG_CAPTAIN_ROLE_ID": str(CAPTAIN_ROLE_ID),
        "DISCORD_CONFIG_BOT_ID": str(BOT_USER_ID),
    }

    assert "<@" not in "\n".join(config_cmd.build_lines(_guild(), environ))


# --- config_print ----------------------------------------------------------


async def test_config_print_sends_the_lines_to_a_captain():
    ctx = _ctx()
    environ = {"DISCORD_CONFIG_CAPTAIN_ROLE_ID": str(CAPTAIN_ROLE_ID)}

    await config_cmd.config_print(ctx, _settings(), environ)

    ctx.send.assert_awaited_once_with("`DISCORD_CONFIG_CAPTAIN_ROLE_ID`: @captain", allowed_mentions=ANY)


async def test_config_print_says_so_when_nothing_is_set():
    """An empty reply would be refused by Discord, and silence reads as a dead bot."""
    ctx = _ctx()

    await config_cmd.config_print(ctx, _settings(), {"DISCORD_TOKEN": "t"})

    ctx.send.assert_awaited_once_with(config_cmd.NOTHING_SET, allowed_mentions=ANY)


async def test_config_print_pings_nobody_even_if_a_name_reads_as_a_mention():
    """Role and member names are guild-controlled: a role named ``here`` prints as ``@here``."""
    ctx = _ctx()
    here = Mock(spec=discord.Role)
    here.name = "here"
    ctx.guild.get_role.side_effect = lambda rid: here if rid == CAPTAIN_ROLE_ID else None

    await config_cmd.config_print(ctx, _settings(), {"DISCORD_CONFIG_CAPTAIN_ROLE_ID": str(CAPTAIN_ROLE_ID)})

    assert ctx.send.await_args.args == ("`DISCORD_CONFIG_CAPTAIN_ROLE_ID`: @here",)
    allowed = ctx.send.await_args.kwargs["allowed_mentions"]
    assert (allowed.everyone, allowed.users, allowed.roles) == (False, False, False)


async def test_config_print_refuses_a_member_without_the_captain_role():
    ctx = _ctx(roles=())

    await config_cmd.config_print(ctx, _settings(), {"DISCORD_CONFIG_GUILD_ID": str(GUILD_ID)})

    ctx.send.assert_awaited_once_with(config_cmd.NOT_ALLOWED)


async def test_config_print_refuses_when_no_captain_role_is_configured():
    """An unset role shuts the door rather than opening it."""
    ctx = _ctx()

    await config_cmd.config_print(ctx, _settings(captain_role_id=None), {})

    ctx.send.assert_awaited_once_with(config_cmd.NOT_ALLOWED)


async def test_config_print_refuses_in_a_dm():
    """A DM has no member and no role -- and is never the command channel either."""
    ctx = _ctx(in_guild=False, channel_id=999)

    await config_cmd.config_print(ctx, _settings(), {})

    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


async def test_config_print_is_refused_outside_the_command_channel():
    """The channel gate comes first, so a refusal there says nothing about roles."""
    ctx = _ctx(channel_id=999)

    await config_cmd.config_print(ctx, _settings(), {"DISCORD_CONFIG_GUILD_ID": str(GUILD_ID)})

    ctx.send.assert_awaited_once_with(command_channel.wrong_channel(COMMAND_CHANNEL_ID))


async def test_config_print_is_refused_everywhere_without_a_command_channel():
    """An unset DISCORD_CONFIG_BOT_CHANNEL_ID refuses everywhere rather than allowing anywhere."""
    ctx = _ctx()

    await config_cmd.config_print(ctx, _settings(command_channel_id=None), {})

    ctx.send.assert_awaited_once_with(command_channel.DISABLED)
