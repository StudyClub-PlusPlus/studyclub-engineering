"""Per-voice-channel activity dates in SQLite, so a quiet 공부방 can be noticed.

One row per voice channel, holding when we started watching it and when someone
last joined or left. Nothing accumulates: a row is rewritten, never appended to,
because the only question asked of it is "how long has this room been quiet".

Plan and decisions: docs/discord-development-guide/voice-channel-activity-monitor.md.

Channel and category names are deliberately absent -- names change, and the
guild already knows the current one. Only IDs and timestamps live here.

Timestamps go in as ISO8601 UTC and come back as aware ``datetime`` objects, so
callers never see the wire format. Local time is a display concern; storing it
would put the DST-repeated hour in the table.
"""

from __future__ import annotations

import datetime
import sqlite3
from contextlib import closing
from pathlib import Path
from typing import Iterable, NamedTuple


class Activity(NamedTuple):
    """One channel's row. ``None`` means "has not happened yet", not "unknown"."""

    first_seen_at: datetime.datetime
    # None until the first join or leave we witness.
    last_activity_at: datetime.datetime | None
    # None re-arms the alert: ``touch`` clears it so a room that goes quiet
    # again is reported again.
    last_alerted_at: datetime.datetime | None


def _parse(value: str | None) -> datetime.datetime | None:
    return None if value is None else datetime.datetime.fromisoformat(value)


class VoiceActivityLog:
    """The ``voice_channel_activity`` table: one row per voice channel."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)

    def _connect(self) -> sqlite3.Connection:
        # Created on first use, so building the bot never touches the disk.
        self._path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self._path)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS voice_channel_activity ("
            " channel_id INTEGER PRIMARY KEY,"
            " first_seen_at TEXT NOT NULL,"
            " last_activity_at TEXT,"
            " last_alerted_at TEXT)"
        )
        return conn

    def observe(self, channel_ids: Iterable[int], now: datetime.datetime) -> None:
        """Start watching every channel that has no row yet.

        ``first_seen_at`` is what the inactivity window counts from while a
        channel has no activity: counting from the epoch would report every room
        on the first day, and counting from the channel's creation date would
        report every room that existed before this feature shipped.

        A channel that already has a row is left exactly as it is -- this runs
        on every check, and moving ``first_seen_at`` would reset its clock.
        """
        with closing(self._connect()) as conn, conn:
            conn.executemany(
                "INSERT OR IGNORE INTO voice_channel_activity (channel_id, first_seen_at)"
                " VALUES (?, ?)",
                [(channel_id, now.isoformat()) for channel_id in channel_ids],
            )

    def touch(self, channel_id: int, now: datetime.datetime) -> None:
        """Record activity in ``channel_id``, creating the row if it is new.

        Clearing ``last_alerted_at`` is what makes the alert fire once per quiet
        streak rather than once ever: the room is alive again, so the next time
        it falls silent is a new thing to report.
        """
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "INSERT INTO voice_channel_activity"
                " (channel_id, first_seen_at, last_activity_at) VALUES (?, ?, ?)"
                " ON CONFLICT(channel_id) DO UPDATE SET"
                " last_activity_at = excluded.last_activity_at, last_alerted_at = NULL",
                (channel_id, now.isoformat(), now.isoformat()),
            )

    def rows(self) -> dict[int, Activity]:
        """Every row, by channel ID.

        The whole table is read at once: it holds one row per voice channel in
        one guild, so there is no page worth paging.
        """
        with closing(self._connect()) as conn:
            return {
                channel_id: Activity(
                    _parse(first_seen_at),  # type: ignore[arg-type] -- NOT NULL
                    _parse(last_activity_at),
                    _parse(last_alerted_at),
                )
                for channel_id, first_seen_at, last_activity_at, last_alerted_at in conn.execute(
                    "SELECT channel_id, first_seen_at, last_activity_at, last_alerted_at"
                    " FROM voice_channel_activity"
                )
            }

    def mark_alerted(self, channel_ids: Iterable[int], now: datetime.datetime) -> None:
        """Remember that these channels have just been reported.

        Called after the alert is posted, never before: a send that fails leaves
        the rows unmarked so tomorrow's check reports them again.
        """
        with closing(self._connect()) as conn, conn:
            conn.executemany(
                "UPDATE voice_channel_activity SET last_alerted_at = ? WHERE channel_id = ?",
                [(now.isoformat(), channel_id) for channel_id in channel_ids],
            )

    def forget(self, channel_id: int) -> None:
        """Drop the channel's row -- it has been deleted from the guild.

        A channel with no row is not an error: the same deletion event arrives
        for text channels and categories, which never had one.
        """
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "DELETE FROM voice_channel_activity WHERE channel_id = ?", (channel_id,)
            )
