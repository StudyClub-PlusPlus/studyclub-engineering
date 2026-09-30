"""Study-name reservations in SQLite, so one name cannot be created twice.

Asking Discord whether a category exists cannot stop two concurrent requests
for the same name -- both see "not yet" and both create. A UNIQUE insert here
is the check and the claim in one statement, so only one of them gets through.
"""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

PROCESSING = "PROCESSING"
COMPLETED = "COMPLETED"
ERROR = "ERROR"


class StudyReservations:
    """The ``study_reservation`` table: one row per study name in use."""

    def __init__(self, path: str) -> None:
        self._path = Path(path)

    def _connect(self) -> sqlite3.Connection:
        # Created on first use, so building the app never touches the disk.
        self._path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self._path)
        conn.execute(
            "CREATE TABLE IF NOT EXISTS study_reservation ("
            " study_name TEXT PRIMARY KEY,"
            " status TEXT NOT NULL,"
            " idempotency_key TEXT NOT NULL,"
            " study_id INTEGER,"
            " role_id INTEGER)"
        )
        return conn

    def reserve(self, study_name: str, idempotency_key: str) -> bool:
        """Claim ``study_name`` as PROCESSING; False if any row already holds it."""
        with closing(self._connect()) as conn, conn:
            try:
                conn.execute(
                    "INSERT INTO study_reservation (study_name, status, idempotency_key) VALUES (?, ?, ?)",
                    (study_name, PROCESSING, idempotency_key),
                )
            except sqlite3.IntegrityError:
                return False
        return True

    def complete(self, study_name: str, study_id: int, role_id: int) -> None:
        """Mark the study as created, with its category and role IDs."""
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "UPDATE study_reservation SET status = ?, study_id = ?, role_id = ?"
                " WHERE study_name = ?",
                (COMPLETED, study_id, role_id, study_name),
            )

    def fail(self, study_name: str) -> None:
        """Mark the study as failed with leftovers in Discord to clean up by hand."""
        with closing(self._connect()) as conn, conn:
            conn.execute(
                "UPDATE study_reservation SET status = ? WHERE study_name = ?",
                (ERROR, study_name),
            )

    def release(self, study_name: str) -> None:
        """Free ``study_name`` -- the request left nothing behind in Discord."""
        with closing(self._connect()) as conn, conn:
            conn.execute("DELETE FROM study_reservation WHERE study_name = ?", (study_name,))

