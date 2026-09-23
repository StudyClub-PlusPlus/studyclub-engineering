import logging

from fastapi.testclient import TestClient

from app.api.server import create_app
from app.config import Settings


def test_request_is_logged(caplog):
    """Each request logs its method, path, and status, without the query string."""
    client = TestClient(create_app(Settings(), None))

    with caplog.at_level(logging.INFO, logger="app.api.server"):
        client.get("/api/v1/health?secret=x")

    messages = [r.getMessage() for r in caplog.records if r.name == "app.api.server"]
    assert len(messages) == 1
    assert messages[0].startswith("GET /api/v1/health -> 200 (")
    assert "secret" not in messages[0]
