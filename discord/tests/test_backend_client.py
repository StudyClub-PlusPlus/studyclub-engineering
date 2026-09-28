import json

import httpx
import pytest

from app.backend_client import (
    BackendError,
    BackendUnreachable,
    mark_attendances,
)

BASE = "http://backend:8080"


def _client_with(handler):
    """Patch httpx.AsyncClient so the call goes to ``handler`` instead of the net."""
    original = httpx.AsyncClient

    def factory(**kwargs):
        return original(transport=httpx.MockTransport(handler), **kwargs)

    return factory


@pytest.fixture
def capture(monkeypatch):
    """Record the one request the client makes and answer it with ``box['response']``."""
    box = {"request": None, "response": httpx.Response(200, json={})}

    def handler(request: httpx.Request) -> httpx.Response:
        box["request"] = request
        return box["response"]

    monkeypatch.setattr(httpx, "AsyncClient", _client_with(handler))
    return box


@pytest.mark.asyncio
async def test_posts_the_snapshot_to_the_contracted_path(capture):
    """Path, key header, and body shape all come from the spec."""
    await mark_attendances(BASE, "k3y", "900", "1", ["1", "2"])

    request = capture["request"]
    assert request.method == "POST"
    assert str(request.url) == f"{BASE}/api/discord/studies/900/attendances"
    assert request.headers["X-API-Key"] == "k3y"
    assert json.loads(request.content) == {
        "callerDiscordUserId": "1",
        "discordUserIds": ["1", "2"],
    }


@pytest.mark.asyncio
async def test_parses_every_bucket(capture):
    """The four buckets map onto the result object."""
    capture["response"] = httpx.Response(
        200,
        json={
            "groups": [
                {
                    "studyGroupId": 70,
                    "studyMeetingId": 41,
                    "meetingStarted": True,
                    "marked": ["1", "2"],
                }
            ],
            "unmatched": ["3"],
            "notParticipant": ["4"],
            "noMeeting": ["5"],
        },
    )

    result = await mark_attendances(BASE, "k", "900", "1", ["1"])

    assert result.marked_count == 2
    assert result.groups[0].study_group_id == 70
    assert result.groups[0].meeting_started is True
    assert result.unmatched == ["3"]
    assert result.not_participant == ["4"]
    assert result.no_meeting == ["5"]


@pytest.mark.asyncio
async def test_parses_a_response_with_nothing_marked(capture):
    """Before account linking exists, every field but unmatched is empty."""
    capture["response"] = httpx.Response(200, json={"unmatched": ["1"]})

    result = await mark_attendances(BASE, "k", "900", "1", ["1"])

    assert result.marked_count == 0
    assert result.groups == []
    assert result.unmatched == ["1"]


@pytest.mark.asyncio
async def test_non_200_raises_with_the_status(capture):
    """The command branches on the status, not on the wording."""
    capture["response"] = httpx.Response(404, json={"errorMessage": "not found"})

    with pytest.raises(BackendError) as exc:
        await mark_attendances(BASE, "k", "900", "1", ["1"])

    assert exc.value.status == 404
    assert exc.value.detail == "not found"


@pytest.mark.asyncio
async def test_error_detail_survives_a_body_that_is_not_json(capture):
    """A proxy or a stack trace can answer with plain text."""
    capture["response"] = httpx.Response(502, text="Bad Gateway")

    with pytest.raises(BackendError) as exc:
        await mark_attendances(BASE, "k", "900", "1", ["1"])

    assert exc.value.status == 502
    assert "Bad Gateway" in exc.value.detail


@pytest.mark.asyncio
async def test_transport_failure_is_its_own_error(monkeypatch):
    """A backend that cannot be reached is not a backend that said no."""

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    monkeypatch.setattr(httpx, "AsyncClient", _client_with(handler))

    with pytest.raises(BackendUnreachable):
        await mark_attendances(BASE, "k", "900", "1", ["1"])


@pytest.mark.asyncio
async def test_trailing_slash_in_the_base_url_does_not_double(capture):
    """Settings strips it, but the client must not depend on that."""
    await mark_attendances(BASE, "k", "900", "1", ["1"])

    assert "//api/" not in str(capture["request"].url)
