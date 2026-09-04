"""Configuration loading.

Secrets come from the environment (populated from ``.env`` in development).
``config.json`` holds the runtime-tunable settings (currently just the output
channel). ``load_settings`` merges the two into an immutable :class:`Settings`
object; :class:`SettingsStore` lets a running bot re-read the file on demand.

``command_prefix`` and ``log_level`` are not read from ``config.json`` -- they
are effectively fixed for a deployment, so change their defaults below.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

DEFAULT_CONFIG_PATH = Path(os.getenv("CONFIG_PATH", "config.json"))


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
    # Re-read from config.json at runtime via SettingsStore.reload().
    output_channel_id: int | None = None
    extra: dict[str, Any] = field(default_factory=dict)


def load_config_file(path: Path | str = DEFAULT_CONFIG_PATH) -> dict[str, Any]:
    """Return the parsed ``config.json`` contents, or ``{}`` when absent."""
    path = Path(path)
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def load_settings(
    config_path: Path | str | None = None,
    environ: Mapping[str, str] | None = None,
    load_dotenv_file: bool = True,
) -> Settings:
    """Build :class:`Settings` from ``config.json`` + environment variables.

    A missing ``DISCORD_TOKEN`` is not an error -- it yields
    ``discord_token=None`` so the API can run without the Discord bot.

    Parameters are injectable so tests never touch the real filesystem or env.
    """
    if load_dotenv_file:
        from dotenv import load_dotenv

        load_dotenv()

    env: Mapping[str, str] = environ if environ is not None else os.environ
    # Resolve CONFIG_PATH at call time so SettingsStore.reload() honours it.
    cfg = load_config_file(config_path or Path(os.getenv("CONFIG_PATH", "config.json")))

    token = env.get("DISCORD_TOKEN", "").strip()

    raw_channel = cfg.get("discord_bot_output_channel")
    output_channel_id = int(raw_channel) if raw_channel is not None else None

    return Settings(
        discord_token=token or None,
        output_channel_id=output_channel_id,
        extra=dict(cfg.get("extra", {}) or {}),
    )


class SettingsStore:
    """Holds the current :class:`Settings` and re-reads ``config.json`` on demand.

    Only :attr:`Settings.output_channel_id` is expected to change between
    reloads; secrets and the API bind address are captured once at startup.
    """

    def __init__(self, settings: Settings) -> None:
        """Store the initial settings snapshot."""
        self._settings = settings

    @property
    def current(self) -> Settings:
        """Return the settings currently in effect."""
        return self._settings

    def reload(self) -> Settings:
        """Re-read ``config.json``, replace the stored settings, and return them."""
        self._settings = load_settings()
        return self._settings
