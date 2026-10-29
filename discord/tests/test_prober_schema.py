"""discord/.prober/map/schema.json matches the tables the bot really creates.

Prober (the DB-structure map) reads that file as-is; nothing here runs a DB in CI
for it. So the file is hand- (or AI-) maintained next to the CREATE TABLE
statements, and this test is what keeps the two from drifting: it lets each
store create its table in a scratch SQLite file and compares PRAGMA output.

After changing a CREATE TABLE, regenerate with:
    python -m tests.test_prober_schema > .prober/map/schema.json
"""

from __future__ import annotations

import json
import sqlite3
import tempfile
from pathlib import Path

from app.study_reservations import StudyReservations
from app.voice_activity_log import VoiceActivityLog

SCHEMA = Path(__file__).resolve().parents[1] / ".prober" / "map" / "schema.json"
STORES = (StudyReservations, VoiceActivityLog)


def actual() -> dict:
    """The ERD of a fresh SQLite file after every store has created its table."""
    with tempfile.TemporaryDirectory() as tmp:
        path = str(Path(tmp) / "discord.sqlite3")
        for store in STORES:
            store(path)._connect().close()
        conn = sqlite3.connect(path)
        names = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
        tables = []
        for name in names:
            columns = [
                {"name": c, "type": t.lower(), "nullable": not (notnull or pk), "default": d, **({"pk": True} if pk else {})}
                for _, c, t, notnull, d, pk in conn.execute(f"PRAGMA table_info({name})")
            ]
            fks = [
                {"name": f"fk_{name}_{i}", "columns": [frm], "refTable": ref, "refColumns": [to]}
                for i, _, ref, frm, to, *_ in conn.execute(f"PRAGMA foreign_key_list({name})")
            ]
            tables.append({"name": name, "columns": columns, "fks": fks, "indexes": []})
        version = conn.execute("SELECT sqlite_version()").fetchone()[0].split(".")[0]
        conn.close()
    return {"engine": f"sqlite {version}", "tables": tables}


def test_schema_file_matches_the_tables_the_bot_creates():
    assert json.loads(SCHEMA.read_text()) == actual(), (
        "discord/.prober/map/schema.json is stale -- run: python -m tests.test_prober_schema > .prober/map/schema.json"
    )


if __name__ == "__main__":
    print(json.dumps(actual(), ensure_ascii=False, indent=2))
