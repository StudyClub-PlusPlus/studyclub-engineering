"""Manual test harness for the Discord service API and its OAuth2 flow.

Runs a small FastAPI app on ``127.0.0.1:8900`` that serves a page (``static/``)
and two things the browser cannot do by itself:

1. **The OAuth2 authorization-code flow, leg by leg.** Each leg is a separate
   endpoint rather than one "log in" button, so the flow can be broken on
   purpose -- tamper with ``state``, exchange a spent ``code`` twice, refresh
   an expired token -- and every raw request/response is handed to the page.
2. **A proxy to the Discord service** (:data:`DEFAULT_API_BASE`). Direct calls
   from the page would fail CORS (the service sets no CORS headers) and would
   put ``X-API-Key`` in page source; going through here also puts the
   ``Idempotency-Key`` generation in one place.

Bind stays on loopback: this process holds the OAuth client secret and the
service API key, so it must not be reachable from the network.

Run it from ``discord/``::

    python tests/manual/server.py

Configuration comes from ``.env`` next to this file -- see ``README.md`` here.
"""

from __future__ import annotations

import json
import os
import secrets
import time
import uuid
from pathlib import Path
from typing import Any, Mapping

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import Cookie, FastAPI, Request, Response
from fastapi.responses import FileResponse, HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

HOST = "127.0.0.1"
PORT = 8900
STATIC_DIR = Path(__file__).parent / "static"
# The harness reads its own .env, not the repo-root one: none of these values
# are read by the services, so they have no business in the stack's env list.
ENV_FILE = Path(__file__).parent / ".env"

DISCORD_API = "https://discord.com/api/v10"
DISCORD_AUTHORIZE = "https://discord.com/oauth2/authorize"

# The bare `python -m app.main` port. Docker publishes 4800 as DISCORD_PORT
# (24800 by default), so the page offers both and this is only the fallback.
DEFAULT_API_BASE = "http://localhost:4800"
DEFAULT_SCOPE = "identify"

SESSION_COOKIE = "manual_session"
MASK = "********"

# Session state lives in this process only: the harness is single-user, local,
# and restarting it should forget every token it ever held.
_sessions: dict[str, dict[str, Any]] = {}


# --------------------------------------------------------------------------
# configuration
# --------------------------------------------------------------------------


def _env() -> dict[str, str]:
    """Read the harness configuration from :data:`ENV_FILE`.

    Values are read per request, not captured at import, so editing the file
    and reloading the page is enough -- no restart between attempts.
    """
    load_dotenv(ENV_FILE, override=True)
    return {
        "client_id": os.environ.get("DISCORD_CLIENT_ID", "").strip(),
        "client_secret": os.environ.get("DISCORD_CLIENT_SECRET", "").strip(),
        "redirect_uri": os.environ.get(
            "DISCORD_OAUTH_REDIRECT_URI", f"http://localhost:{PORT}/oauth/callback"
        ).strip(),
        "api_key": os.environ.get("DISCORD_API_KEY", "").strip(),
        "api_base": os.environ.get("DISCORD_API_BASE_URL", DEFAULT_API_BASE).strip()
        or DEFAULT_API_BASE,
    }


# --------------------------------------------------------------------------
# session
# --------------------------------------------------------------------------


def _session(token: str | None) -> dict[str, Any]:
    """Return the session for ``token``, creating an empty one if unknown."""
    if token and token in _sessions:
        return _sessions[token]
    return {}


def _ensure_session(response: Response, token: str | None) -> dict[str, Any]:
    """Return the session for ``token``, minting a cookie when there is none."""
    if token and token in _sessions:
        return _sessions[token]
    token = secrets.token_urlsafe(24)
    _sessions[token] = {}
    response.set_cookie(SESSION_COOKIE, token, httponly=True, samesite="lax")
    return _sessions[token]


def _redact(payload: Any) -> Any:
    """Copy ``payload`` with token fields masked.

    The page asks for the real values through ``/api/oauth/tokens`` behind a
    reveal toggle; everything shown by default is safe to screenshot.
    """
    if not isinstance(payload, dict):
        return payload
    out = dict(payload)
    for key in ("access_token", "refresh_token"):
        if out.get(key):
            out[key] = f"{str(out[key])[:6]}{MASK}"
    return out


def _public(session: Mapping[str, Any]) -> dict[str, Any]:
    """Shape the session for the page: legs of the flow, tokens redacted."""
    token = session.get("token") or {}
    return {
        "authorize": session.get("authorize"),
        "callback": session.get("callback"),
        "token": {**token, "body": _redact(token.get("body"))} if token else None,
        "me": session.get("me"),
        "discordUserId": session.get("discord_user_id"),
        "username": session.get("username"),
        "hasAccessToken": bool(session.get("access_token")),
        "hasRefreshToken": bool(session.get("refresh_token")),
    }


# --------------------------------------------------------------------------
# app
# --------------------------------------------------------------------------

app = FastAPI(title="Discord manual test harness", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def index() -> FileResponse:
    """Serve the harness page."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/config")
async def config(session_token: str | None = Cookie(None, alias=SESSION_COOKIE)) -> dict:
    """Report what is configured, without handing out any secret."""
    env = _env()
    return {
        "clientId": env["client_id"],
        "redirectUri": env["redirect_uri"],
        "defaultScope": DEFAULT_SCOPE,
        "apiBase": env["api_base"],
        "hasClientSecret": bool(env["client_secret"]),
        "hasApiKey": bool(env["api_key"]),
        "session": _public(_session(session_token)),
    }


# --------------------------------------------------------------------------
# OAuth2 -- one endpoint per leg
# --------------------------------------------------------------------------


class AuthorizeRequest(BaseModel):
    scope: str = DEFAULT_SCOPE
    prompt: str = "consent"


@app.post("/api/oauth/authorize-url")
async def authorize_url(
    body: AuthorizeRequest,
    response: Response,
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE),
) -> dict:
    """Build the authorize URL and remember the ``state`` we expect back.

    The URL is returned rather than redirected to, so the page can show it
    before anything leaves the browser.
    """
    env = _env()
    session = _ensure_session(response, session_token)
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": env["client_id"],
        "redirect_uri": env["redirect_uri"],
        "response_type": "code",
        "scope": body.scope,
        "state": state,
        "prompt": body.prompt,
    }
    url = str(httpx.URL(DISCORD_AUTHORIZE, params=params))
    session["pending_mode"] = "manual"
    session["expected_state"] = state
    session["authorize"] = {"url": url, "params": params, "at": time.time()}
    # The redirect_uri sent here has to match the token exchange exactly, so
    # the exchange reuses this one instead of re-reading the environment.
    session["redirect_uri"] = params["redirect_uri"]
    return {"url": url, "state": state}


@app.get("/oauth/callback")
async def oauth_callback(
    request: Request, session_token: str | None = Cookie(None, alias=SESSION_COOKIE)
) -> Response:
    """Handle Discord's redirect for whichever flow started it.

    Both flows register the same ``redirect_uri`` -- Discord only accepts URLs
    that are registered on the app, and asking for a second one just to demo
    the button would be a setup step for no gain. ``pending_mode`` says which
    of the two is waiting.
    """
    params = dict(request.query_params)
    session = _session(session_token)
    expected = session.get("expected_state")
    state_ok = bool(expected) and params.get("state") == expected
    mode = session.pop("pending_mode", "manual") if session else "manual"

    if mode == "production":
        return await _production_callback(request, session, params, state_ok)

    leg = {
        "params": params,
        "stateMatches": state_ok,
        "expectedState": expected,
        "at": time.time(),
    }
    if session:
        session["callback"] = leg
        session["code"] = params.get("code")
    return RedirectResponse(url="/#oauth", status_code=303)


class TokenRequest(BaseModel):
    code: str | None = None


@app.post("/api/oauth/token")
async def oauth_token(
    body: TokenRequest,
    response: Response,
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE),
) -> dict:
    """Exchange the authorization code for tokens.

    ``code`` defaults to the one the callback stored; pass it explicitly to
    replay a spent code (Discord answers 400 ``invalid_grant``).
    """
    env = _env()
    session = _ensure_session(response, session_token)
    code = body.code or session.get("code")
    if not code:
        return {"error": "no authorization code yet -- run authorize first"}

    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": session.get("redirect_uri") or env["redirect_uri"],
    }
    return await _token_call(session, form, env)


class RefreshRequest(BaseModel):
    refreshToken: str | None = None


@app.post("/api/oauth/refresh")
async def oauth_refresh(
    body: RefreshRequest,
    response: Response,
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE),
) -> dict:
    """Trade the refresh token for a new access token."""
    env = _env()
    session = _ensure_session(response, session_token)
    refresh = body.refreshToken or session.get("refresh_token")
    if not refresh:
        return {"error": "no refresh token yet -- exchange the code first"}
    form = {"grant_type": "refresh_token", "refresh_token": refresh}
    return await _token_call(session, form, env)


async def _post_token(
    env: Mapping[str, str], form: dict[str, str]
) -> tuple[int | None, Any]:
    """POST to Discord's token endpoint.

    Returns ``(status, payload)``, or ``(None, message)`` when the request
    could not be made at all -- both flows need to tell those apart.
    """
    secret = env["client_secret"]
    if not env["client_id"] or not secret:
        return None, "DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET are not set"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.post(
                f"{DISCORD_API}/oauth2/token",
                data=form,
                auth=(env["client_id"], secret),
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        except httpx.HTTPError as exc:
            return None, f"{type(exc).__name__}: {exc}"
    return resp.status_code, _json_or_text(resp)


async def _token_call(
    session: dict[str, Any], form: dict[str, str], env: Mapping[str, str]
) -> dict:
    """POST to Discord's token endpoint and record the exchange on the session."""
    status, payload = await _post_token(env, form)
    if status is None:
        return {"error": payload}

    leg = {
        "request": {"url": f"{DISCORD_API}/oauth2/token", "form": form, "auth": "basic (client_id:secret)"},
        "status": status,
        "body": payload,
        "at": time.time(),
    }
    session["token"] = leg
    if isinstance(payload, dict) and payload.get("access_token"):
        session["access_token"] = payload["access_token"]
        session["refresh_token"] = payload.get("refresh_token")
    return {"leg": {**leg, "body": _redact(payload)}, "session": _public(session)}


@app.post("/api/oauth/me")
async def oauth_me(
    response: Response, session_token: str | None = Cookie(None, alias=SESSION_COOKIE)
) -> dict:
    """Call ``/users/@me`` with the access token and adopt the Discord user ID.

    That ID is what every proxied call sends as ``X-Discord-User-ID`` -- the
    header ``common-header.md`` says callers cannot fill in yet.
    """
    session = _ensure_session(response, session_token)
    access = session.get("access_token")
    if not access:
        return {"error": "no access token yet -- exchange the code first"}

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                f"{DISCORD_API}/users/@me", headers={"Authorization": f"Bearer {access}"}
            )
        except httpx.HTTPError as exc:
            return {"error": f"{type(exc).__name__}: {exc}"}

    payload = _json_or_text(resp)
    leg = {"status": resp.status_code, "body": payload, "at": time.time()}
    session["me"] = leg
    if isinstance(payload, dict) and payload.get("id"):
        session["discord_user_id"] = str(payload["id"])
        session["username"] = payload.get("username")
    return {"leg": leg, "session": _public(session)}


@app.get("/api/oauth/tokens")
async def oauth_tokens(session_token: str | None = Cookie(None, alias=SESSION_COOKIE)) -> dict:
    """Return the unmasked tokens -- what the page's reveal toggle asks for."""
    session = _session(session_token)
    return {
        "accessToken": session.get("access_token"),
        "refreshToken": session.get("refresh_token"),
    }


@app.post("/api/oauth/reset")
async def oauth_reset(
    response: Response, session_token: str | None = Cookie(None, alias=SESSION_COOKIE)
) -> dict:
    """Drop every token and leg, so the next run starts from an empty state."""
    if session_token and session_token in _sessions:
        _sessions[session_token] = {}
    return {"session": _public(_session(session_token))}


# --------------------------------------------------------------------------
# production-shaped login -- one button, popup, nothing but the user at the end
# --------------------------------------------------------------------------
#
# This is the same grant the legs above run by hand, packaged the way the app
# would ship it and the way frontend-development-guide/auth-flow.md already
# does Google: a popup, a callback that exchanges the code server-side, and a
# postMessage back to the opener. The browser never sees a code or a token --
# only the profile.


@app.get("/auth/discord/start")
async def auth_start(
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE),
) -> Response:
    """Open the consent screen. This is everything the button knows about."""
    env = _env()
    configured = bool(env["client_id"] and env["client_secret"])
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": env["client_id"],
        "redirect_uri": env["redirect_uri"],
        "response_type": "code",
        "scope": DEFAULT_SCOPE,
        "state": state,
        "prompt": "consent",
    }
    target = (
        str(httpx.URL(DISCORD_AUTHORIZE, params=params))
        if configured
        else "/auth/discord/failed?reason=DISCORD_CLIENT_ID+/+SECRET+not+set"
    )

    response = RedirectResponse(url=target, status_code=303)
    session = _ensure_session(response, session_token)
    if configured:
        session["pending_mode"] = "production"
        session["expected_state"] = state
        session["redirect_uri"] = env["redirect_uri"]
        # A fresh attempt starts a fresh trace.
        session["prod_debug"] = {}
        _trace(session, "authorize", {"url": target, "params": params})
    return response


@app.get("/auth/discord/failed")
async def auth_failed(
    request: Request,
    reason: str = "unknown",
    session_token: str | None = Cookie(None, alias=SESSION_COOKIE),
) -> Response:
    """Close the popup with an error, for failures that happen before Discord."""
    session = _session(session_token)
    if session:
        session["prod_debug"] = {}
        _trace(session, "result", {"ok": False, "error": reason})
    return _popup_result(request, ok=False, error=reason)


def _trace(session: dict[str, Any], step: str, data: dict[str, Any]) -> None:
    """Record one step of the button's login for the panel's debug view.

    The flow itself does not need this -- it exists so a failed login can be
    read after the popup has closed, which is otherwise the one thing the
    packaged flow hides that the manual legs show.
    """
    session.setdefault("prod_debug", {})[step] = {**data, "at": time.time()}


async def _production_callback(
    request: Request, session: dict[str, Any], params: Mapping[str, str], state_ok: bool
) -> Response:
    """Finish the button's login: verify state, exchange, read the profile.

    Every failure ends the same way -- the popup closes and the opener is told
    it failed. Nothing partial is left on screen for the user to act on.
    """
    _trace(
        session,
        "callback",
        {
            "params": dict(params),
            "stateMatches": state_ok,
            "expectedState": session.get("expected_state"),
        },
    )

    def failed(error: str) -> Response:
        _trace(session, "result", {"ok": False, "error": error})
        return _popup_result(request, ok=False, error=error)

    if params.get("error"):
        return failed(str(params["error"]))
    if not state_ok:
        return failed("state mismatch")
    code = params.get("code")
    if not code:
        return failed("no code in the callback")

    env = _env()
    form = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": session.get("redirect_uri") or env["redirect_uri"],
    }
    status, payload = await _post_token(env, form)
    _trace(
        session,
        "token",
        {
            "request": {
                "url": f"{DISCORD_API}/oauth2/token",
                "form": form,
                "auth": "basic (client_id:secret)",
            },
            "status": status,
            "body": payload,
        },
    )
    if status is None:
        return failed(str(payload))
    if status != 200 or not isinstance(payload, dict) or not payload.get("access_token"):
        detail = payload.get("error") if isinstance(payload, dict) else payload
        return failed(f"token exchange failed ({status}): {detail}")

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            me = await client.get(
                f"{DISCORD_API}/users/@me",
                headers={"Authorization": f"Bearer {payload['access_token']}"},
            )
        except httpx.HTTPError as exc:
            return failed(f"{type(exc).__name__}: {exc}")

    profile = _json_or_text(me)
    _trace(session, "me", {"status": me.status_code, "body": profile})
    if me.status_code != 200 or not isinstance(profile, dict):
        return failed(f"/users/@me failed ({me.status_code})")

    # Tokens stay here. In the real thing they would be the backend's, and the
    # browser would get the app's own JWT instead -- never Discord's token.
    session["prod_tokens"] = payload
    session["profile"] = _profile(profile)
    # The same ID the proxy sends as X-Discord-User-ID, so logging in here is
    # enough to start calling the API endpoints below.
    session["discord_user_id"] = str(profile.get("id", ""))
    session["username"] = profile.get("username")
    _trace(session, "result", {"ok": True})
    return _popup_result(request, ok=True)


def _profile(user: Mapping[str, Any]) -> dict[str, str | None]:
    """Keep the handful of fields the page shows, and drop the rest."""
    user_id = str(user.get("id", ""))
    avatar = user.get("avatar")
    return {
        "id": user_id,
        "username": user.get("username"),
        "globalName": user.get("global_name"),
        "avatarUrl": (
            f"https://cdn.discordapp.com/avatars/{user_id}/{avatar}.png?size=128" if avatar else None
        ),
    }


def _popup_result(request: Request, ok: bool, error: str | None = None) -> Response:
    """Close the popup and tell the opener how it went.

    ``targetOrigin`` is pinned to this harness rather than ``"*"`` -- the same
    rule auth-flow.md gives for the Google popup, since any other page the user
    has open would otherwise receive the message.
    """
    origin = str(request.base_url).rstrip("/")
    payload = json.dumps({"source": "studyclub-discord-auth", "ok": ok, "error": error})
    html = f"""<!doctype html><meta charset="utf-8"><title>Discord</title>
<body style="font:13px system-ui;background:#14161a;color:#dfe3ea;padding:2rem">
<p>{"signed in" if ok else "login failed"} — closing…</p>
<script>
  var payload = {payload};
  if (window.opener) window.opener.postMessage(payload, {json.dumps(origin)});
  window.close();
</script>
</body>"""
    return HTMLResponse(html)


@app.get("/api/auth/user")
async def auth_user(
    reveal: bool = False, session_token: str | None = Cookie(None, alias=SESSION_COOKIE)
) -> dict:
    """Return the logged-in profile, plus the trace of how it was obtained.

    A shipped app would return the profile alone -- the trace is the harness
    showing its work, and it is the only reason a token is reachable from the
    browser here at all. ``reveal`` unmasks the tokens in it.
    """
    session = _session(session_token)
    debug = dict(session.get("prod_debug") or {})
    token = debug.get("token")
    if token and not reveal:
        debug["token"] = {**token, "body": _redact(token.get("body"))}
    return {"user": session.get("profile"), "debug": debug or None}


@app.post("/api/auth/logout")
async def auth_logout(session_token: str | None = Cookie(None, alias=SESSION_COOKIE)) -> dict:
    """Drop the profile and the tokens the button's login collected."""
    session = _session(session_token)
    for key in ("profile", "prod_tokens", "prod_debug", "discord_user_id", "username"):
        session.pop(key, None)
    return {"user": None}


# --------------------------------------------------------------------------
# proxy to the Discord service
# --------------------------------------------------------------------------


class CallRequest(BaseModel):
    method: str
    path: str
    query: dict[str, str] = Field(default_factory=dict)
    body: Any = None
    baseUrl: str | None = None
    # Negative-test switches: most of what these API docs specify is the
    # 400/401/403 behaviour, so every required header has to be breakable.
    omitIdempotencyKey: bool = False
    idempotencyKey: str | None = None
    badApiKey: bool = False
    omitApiKey: bool = False
    omitUserId: bool = False
    userIdOverride: str | None = None


@app.post("/api/call")
async def call(
    body: CallRequest, session_token: str | None = Cookie(None, alias=SESSION_COOKIE)
) -> dict:
    """Forward one request to the Discord service and report both sides.

    Returns the request as it was actually sent (API key masked) next to the
    response, so the page's log shows the whole exchange rather than just the
    part the browser knew about.
    """
    env = _env()
    session = _session(session_token)
    base = (body.baseUrl or env["api_base"]).rstrip("/")
    url = f"{base}{body.path}"

    headers: dict[str, str] = {}
    if not body.omitApiKey:
        headers["X-API-Key"] = "not-the-real-key" if body.badApiKey else env["api_key"]

    user_id = body.userIdOverride or session.get("discord_user_id")
    if not body.omitUserId and user_id:
        headers["X-Discord-User-ID"] = str(user_id)

    if body.method.upper() != "GET" and not body.omitIdempotencyKey:
        headers["Idempotency-Key"] = body.idempotencyKey or str(uuid.uuid4())

    if body.body is not None:
        headers["Content-Type"] = "application/json"

    sent = {
        "method": body.method.upper(),
        "url": str(httpx.URL(url, params=body.query)),
        "headers": _mask_key(headers),
        "body": body.body,
    }

    started = time.perf_counter()
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.request(
                body.method.upper(),
                url,
                params=body.query or None,
                json=body.body if body.body is not None else None,
                headers=headers,
            )
        except httpx.HTTPError as exc:
            return {"request": sent, "error": f"{type(exc).__name__}: {exc}"}

    return {
        "request": sent,
        "response": {
            "status": resp.status_code,
            "headers": dict(resp.headers),
            "body": _json_or_text(resp),
            "elapsedMs": round((time.perf_counter() - started) * 1000, 1),
        },
    }


def _mask_key(headers: Mapping[str, str]) -> dict[str, str]:
    """Copy ``headers`` with ``X-API-Key`` replaced by a description of it."""
    out = dict(headers)
    if "X-API-Key" in out:
        value = out["X-API-Key"]
        if not value:
            out["X-API-Key"] = "(empty -- DISCORD_API_KEY is not set)"
        elif value == "not-the-real-key":
            out["X-API-Key"] = "(deliberately wrong)"
        else:
            out["X-API-Key"] = MASK
    return out


def _json_or_text(response: httpx.Response) -> Any:
    """Return the parsed JSON body, or the raw text when it is not JSON.

    204s and HTML error pages both land here, and a harness that hid them
    behind a parse error would be useless for exactly the cases worth seeing.
    """
    if not response.content:
        return None
    try:
        return response.json()
    except ValueError:
        return response.text


if __name__ == "__main__":
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")
