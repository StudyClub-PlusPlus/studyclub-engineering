from unittest.mock import AsyncMock, Mock

import discord
import pytest

from app.bot.client import create_bot
from app.bot.commands.help_cmd import CATEGORIES, category_of
from app.config import Settings

EXPECTED = {
    "checkVoiceChannels": "Captain",
    "updateBulletin": "Captain",
    "출석체크": "Navigator",
    "help": "ETC",
    "testCmd": "ETC",
}


def _bot():
    return create_bot(Settings(command_channel_id=300000000000000001))


def test_every_command_is_filed_under_its_category():
    """The help menu's grouping is whatever the commands themselves declare."""
    bot = _bot()
    assert {name: category_of(bot.get_command(name)) for name in EXPECTED} == EXPECTED


def test_no_command_is_left_out():
    """A command added later shows up here, so its category is a deliberate choice."""
    assert {command.name for command in _bot().commands} == set(EXPECTED)


@pytest.mark.asyncio
async def test_send_bot_help_lists_each_category_in_order():
    """Headings come out narrowest-audience first, each above its own commands."""
    bot = _bot()
    help_command = bot.help_command
    help_command.context = Mock(bot=bot, clean_prefix="!", send=AsyncMock())
    help_command.get_destination = Mock(return_value=Mock(send=AsyncMock()))

    await help_command.send_bot_help({})

    page = "".join(help_command.paginator.pages)
    headings = [page.index(f"{category}:") for category in CATEGORIES]
    assert headings == sorted(headings)
    for name, category in EXPECTED.items():
        assert page.index(f"{category}:") < page.index(name)
