from fastapi.testclient import TestClient

from app.api.server import create_app
from app.config import Settings, SettingsStore


def _client(bot) -> TestClient:
    """Return a test client for an app wired to ``bot``."""
    return TestClient(create_app(SettingsStore(Settings()), bot))


def test_health_endpoint():
    """The health route returns 200 with status, version, uptime, and bot state."""
    client = _client(object())

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert isinstance(body["uptime_seconds"], (int, float))
    assert body["bot"] == "running"


def test_health_endpoint_reports_disabled_bot():
    """With no token configured the API still answers 200, flagging the bot down."""
    client = _client(None)

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["bot"] == "disabled"
