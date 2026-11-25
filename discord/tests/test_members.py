from unittest.mock import AsyncMock, Mock

import discord
from fastapi.testclient import TestClient

from app.api.server import create_app
from app.config import Settings

GUILD_ID = 100000000000000001
USER_ID = "327394882193883136"
API_KEY = "test-api-key"
HEADERS = {"X-API-Key": API_KEY, "X-Discord-User-ID": USER_ID}
PATH = f"/api/v1/members/{USER_ID}"


def _bot(response=None, error=None) -> Mock:
    guild = Mock(id=GUILD_ID)
    bot = Mock()
    bot.is_ready.return_value = True
    bot.get_guild.side_effect = lambda gid: guild if gid == GUILD_ID else None
    bot.http.request = AsyncMock(return_value=response, side_effect=error)
    return bot


def _client(bot, tmp_path) -> TestClient:
    settings = Settings(guild_id=GUILD_ID, api_key=API_KEY, db_path=str(tmp_path / "d.sqlite3"))
    return TestClient(create_app(settings, bot))


def _error(cls, status, code):
    return cls(Mock(status=status, reason="x"), {"code": code, "message": "x"})


def test_new_member_is_joined(tmp_path):
    bot = _bot(response={"user": {"id": USER_ID}})
    res = _client(bot, tmp_path).put(PATH, json={"accessToken": "tok"}, headers=HEADERS)

    assert res.status_code == 200
    assert res.json() == {"joined": True}
    route = bot.http.request.call_args.args[0]
    assert route.method == "PUT"
    assert route.path == "/guilds/{guild_id}/members/{user_id}"
    assert bot.http.request.call_args.kwargs["json"] == {"access_token": "tok"}


def test_existing_member_is_not_joined(tmp_path):
    res = _client(_bot(response=""), tmp_path).put(PATH, json={"accessToken": "tok"}, headers=HEADERS)

    assert res.json() == {"joined": False}


def test_banned_user_is_409_with_reason(tmp_path):
    bot = _bot(error=_error(discord.Forbidden, 403, 40007))
    res = _client(bot, tmp_path).put(PATH, json={"accessToken": "tok"}, headers=HEADERS)

    assert res.status_code == 409
    assert res.json()["detail"] == "BANNED"


def test_too_many_guilds_is_409_with_reason(tmp_path):
    bot = _bot(error=_error(discord.HTTPException, 400, 30001))
    res = _client(bot, tmp_path).put(PATH, json={"accessToken": "tok"}, headers=HEADERS)

    assert res.json()["detail"] == "TOO_MANY_GUILDS"


def test_requires_api_key(tmp_path):
    res = _client(_bot(), tmp_path).put(PATH, json={"accessToken": "tok"}, headers={"X-Discord-User-ID": USER_ID})

    assert res.status_code in (401, 403)
