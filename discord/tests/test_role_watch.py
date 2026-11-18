import json
from types import SimpleNamespace

import httpx
import pytest

from app.backend_client import BackendError, notify_role_change
from app.bot import role_watch
from app.config import Settings

BASE = "http://backend:8080"
GUILD_ID = 100000000000000001
CAPTAIN = 100000000000000002
NAVIGATOR = 100000000000000003
OTHER = 100000000000000004
MEMBER_ID = 1327394882193880001

SETTINGS = Settings(
    guild_id=GUILD_ID,
    captain_role_id=CAPTAIN,
    navigator_role_id=NAVIGATOR,
    api_key="k3y",
    backend_base_url=BASE,
)


def _member(*role_ids, guild_id=GUILD_ID):
    return SimpleNamespace(
        id=MEMBER_ID,
        guild=SimpleNamespace(id=guild_id),
        roles=[SimpleNamespace(id=r) for r in role_ids],
    )


@pytest.fixture(autouse=True)
def _clear_own_changes():
    role_watch._own_changes.clear()


@pytest.fixture
def sent(monkeypatch):
    """Capture every report instead of calling the backend."""
    calls = []

    async def fake(base_url, api_key, uid, role, change, occurred_at):
        calls.append((uid, role, change))

    monkeypatch.setattr(role_watch, "notify_role_change", fake)
    return calls


async def test_reports_a_hand_added_navigator(sent):
    await role_watch.report_role_changes(SETTINGS, _member(OTHER), _member(OTHER, NAVIGATOR))
    assert sent == [(str(MEMBER_ID), "NAVIGATOR", "ADDED")]


async def test_reports_a_hand_removed_captain(sent):
    await role_watch.report_role_changes(SETTINGS, _member(CAPTAIN), _member())
    assert sent == [(str(MEMBER_ID), "CAPTAIN", "REMOVED")]


async def test_ignores_roles_that_are_not_watched(sent):
    await role_watch.report_role_changes(SETTINGS, _member(), _member(OTHER))
    await role_watch.report_role_changes(SETTINGS, _member(NAVIGATOR), _member(NAVIGATOR, OTHER))
    assert sent == []


async def test_ignores_other_guilds(sent):
    await role_watch.report_role_changes(
        SETTINGS, _member(guild_id=1), _member(NAVIGATOR, guild_id=1)
    )
    assert sent == []


async def test_skips_the_bots_own_change_once(sent):
    """The bot's own change is dropped; the next hand change is still reported."""
    role_watch.expect_own_change(MEMBER_ID, NAVIGATOR, True)
    await role_watch.report_role_changes(SETTINGS, _member(), _member(NAVIGATOR))
    assert sent == []
    await role_watch.report_role_changes(SETTINGS, _member(), _member(NAVIGATOR))
    assert sent == [(str(MEMBER_ID), "NAVIGATOR", "ADDED")]


async def test_own_change_in_the_other_direction_does_not_hide_a_hand_change(sent):
    role_watch.expect_own_change(MEMBER_ID, NAVIGATOR, True)
    await role_watch.report_role_changes(SETTINGS, _member(NAVIGATOR), _member())
    assert sent == [(str(MEMBER_ID), "NAVIGATOR", "REMOVED")]


async def test_expired_own_change_is_not_skipped(sent, monkeypatch):
    role_watch.expect_own_change(MEMBER_ID, NAVIGATOR, True)
    later = role_watch.time.monotonic() + role_watch.OWN_CHANGE_TTL_SECONDS + 1
    monkeypatch.setattr(role_watch.time, "monotonic", lambda: later)
    await role_watch.report_role_changes(SETTINGS, _member(), _member(NAVIGATOR))
    assert sent == [(str(MEMBER_ID), "NAVIGATOR", "ADDED")]


async def test_a_backend_failure_is_logged_not_raised(monkeypatch):
    async def boom(*args):
        raise BackendError(500, "down")

    monkeypatch.setattr(role_watch, "notify_role_change", boom)
    await role_watch.report_role_changes(SETTINGS, _member(), _member(CAPTAIN, NAVIGATOR))


def test_register_skips_without_a_backend():
    added = []
    bot = SimpleNamespace(add_listener=lambda fn, name: added.append(name))
    role_watch.register(bot, Settings(guild_id=GUILD_ID, navigator_role_id=NAVIGATOR))
    assert added == []
    role_watch.register(bot, SETTINGS)
    assert added == ["on_member_update"]


async def test_notify_role_change_posts_the_contract(monkeypatch):
    seen = {}
    original = httpx.AsyncClient

    def handler(request):
        seen["request"] = request
        return httpx.Response(204)

    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: original(transport=httpx.MockTransport(handler), **kw)
    )
    await notify_role_change(BASE + "/", "k3y", "1", "NAVIGATOR", "ADDED", "2026-10-26T01:00:00Z")
    request = seen["request"]
    assert str(request.url) == f"{BASE}/api/discord/role-changes"
    assert request.headers["X-API-Key"] == "k3y"
    assert json.loads(request.content) == {
        "discordUserId": "1",
        "role": "NAVIGATOR",
        "change": "ADDED",
        "occurredAt": "2026-10-26T01:00:00Z",
    }


async def test_notify_role_change_raises_on_non_204(monkeypatch):
    original = httpx.AsyncClient
    monkeypatch.setattr(
        httpx,
        "AsyncClient",
        lambda **kw: original(
            transport=httpx.MockTransport(lambda r: httpx.Response(401, json={"errorMessage": "no"})),
            **kw,
        ),
    )
    with pytest.raises(BackendError) as info:
        await notify_role_change(BASE, "bad", "1", "CAPTAIN", "REMOVED", "2026-10-26T01:00:00Z")
    assert info.value.status == 401
