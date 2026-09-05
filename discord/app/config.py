"""Configuration loading.

Every setting comes from the environment (populated from ``.env`` in
development), so a deployment is fully described by its env vars.

``command_prefix`` and ``log_level`` are not read from the environment -- they
are effectively fixed for a deployment, so change their defaults below.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Mapping

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Settings:
    # ``None`` when DISCORD_TOKEN is unset: the API still runs, the bot is skipped.
    discord_token: str | None = None
    command_prefix: str = "!"
    api_host: str = "0.0.0.0"
    # Fixed to match the container's published port. If you change this, also
    # update: Dockerfile (EXPOSE), docker-compose.yml (ports + healthcheck URL),
    # and README.md.
    api_port: int = 4800
    log_level: str = "INFO"
    # DISCORD_BOT_OUTPUT_CHANNEL, as the int discord.py looks channels up by.
    # Captured at startup, so changing it needs a restart.
    output_channel_id: int | None = None


def load_settings(
    environ: Mapping[str, str] | None = None,
    load_dotenv_file: bool = True,
) -> Settings:
    """Build :class:`Settings` from environment variables.

    Nothing here raises, so a bad value cannot stop the service from starting:
    a missing ``DISCORD_TOKEN`` yields ``discord_token=None`` and the API runs
    without the Discord bot, while a ``DISCORD_BOT_OUTPUT_CHANNEL`` that is not
    a number is logged and dropped, leaving ``output_channel_id=None`` -- the
    same "nowhere to post" state as leaving it unset, which
    ``/api/v1/ping`` already reports as a 409.

    Parameters are injectable so tests never touch the real env.
    """
    if load_dotenv_file:
        from dotenv import load_dotenv

        load_dotenv()

    env: Mapping[str, str] = environ if environ is not None else os.environ

    token = env.get("DISCORD_TOKEN", "").strip()
    raw_channel = env.get("DISCORD_BOT_OUTPUT_CHANNEL", "").strip()

    output_channel_id: int | None = None
    if raw_channel:
        try:
            output_channel_id = int(raw_channel)
        except ValueError:
            logger.warning(
                "ignoring DISCORD_BOT_OUTPUT_CHANNEL=%r: not a channel ID, "
                "so /api/v1/ping has nowhere to post",
                raw_channel,
            )

    return Settings(
        discord_token=token or None,
        output_channel_id=output_channel_id,
    )
