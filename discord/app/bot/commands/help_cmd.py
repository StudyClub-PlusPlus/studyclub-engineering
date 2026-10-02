"""The ``!help`` menu, grouped by who may run each command.

discord.py's ``DefaultHelpCommand`` groups by cog, and nothing here is a cog, so
every command lands under one heading. Wrapping each command in a cog for the
sake of a heading would be a lot of ceremony for a list of five, so each one
names its category in ``extras`` and this subclass groups on that instead.
"""

from __future__ import annotations

from typing import Any

from discord.ext import commands

# Heading order, not alphabetical: the narrowest audience first, so a member
# reads the commands they may run last. A command that names no category -- or
# one discord.py registers itself, like ``help`` -- is filed under the last one.
CATEGORIES = ("Captain", "Navigator", "ETC")


def category_of(command: commands.Command[Any, ..., Any]) -> str:
    """Return the heading ``command`` belongs under."""
    return command.extras.get("category", CATEGORIES[-1])


class CategorizedHelpCommand(commands.DefaultHelpCommand):
    """``DefaultHelpCommand`` with the command list split by category."""

    def get_ending_note(self) -> str:
        """Point at a command, not at a category.

        The stock note offers ``!help <category>`` too, and here that answers
        "No command called ..." -- the headings are ours, not cogs discord.py
        can look up. The note is also replaced because the stock one is English,
        which is not what the rest of this menu reads like.
        """
        return (
            f"명령어 하나만 자세히 보려면 {self.context.clean_prefix}{self.invoked_with}"
            " <명령어> 를 쳐주세요."
        )

    async def send_bot_help(self, mapping, /) -> None:
        filtered = await self.filter_commands(self.context.bot.commands, sort=False)
        max_size = self.get_max_size(filtered)

        for category in CATEGORIES:
            in_category = sorted(
                (command for command in filtered if category_of(command) == category),
                key=lambda command: command.name,
            )
            self.add_indented_commands(in_category, heading=f"{category}:", max_size=max_size)

        note = self.get_ending_note()
        if note:
            self.paginator.add_line()
            self.paginator.add_line(note)

        await self.send_pages()
