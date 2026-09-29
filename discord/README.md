# StudyClub++ Discord

Baseline Discord bot + FastAPI service in Python. The Discord client and the HTTP
API run concurrently on one asyncio event loop, so neither blocks the other.

## Layout

```
app/
  config.py            # environment (.env in dev) -> Settings
  main.py              # runs the API and the bot together (asyncio.TaskGroup)
  api/
    server.py          # FastAPI app factory (holds the bot + settings)
    routes/health.py   # GET /api/v1/health (liveness + bot state)
    routes/ping.py     # POST /api/v1/ping (bot posts a ping to the output channel)
    routes/studies.py  # POST /api/v1/studies (create-study)
    routes/channels.py # POST /api/v1/channels/{id|alert|announcement}/msg (send-message and friends)
    headers.py         # common request headers (X-API-Key, X-Discord-User-ID, Idempotency-Key)
    guild.py           # resolves the caller in the guild and checks their role
  study_reservations.py  # SQLite study-name reservations for create-study
  bot/
    client.py            # Discord bot factory
    commands/test_cmd.py   # testCmd command
tests/                 # pytest unit tests
```

## Configuration

- **Secrets** — environment variables, loaded from `.env` in development.
  `.env` and `.env.example` live at the repo root (shared across projects).
  Copy `.env.example` to `.env` there and set `DISCORD_TOKEN`. With no token
  the API still starts and `/api/v1/health` reports `"bot": "disabled"`; only a
  token that is set but invalid is fatal.
- **Settings** — `DISCORD_BOT_OUTPUT_CHANNEL` is the numeric Discord channel ID
  the bot posts to. Leave it empty for "no output channel": the service starts
  and `/api/v1/ping` answers `409`. A non-numeric value is logged and dropped at
  startup, which lands in that same `409` — the service always starts. It is
  read once at startup, so changing it means `docker compose up -d discord`
  (a restart alone will not re-read `.env`).
  `command_prefix` and `log_level` are fixed per deployment — change
  their defaults in `app/config.py`. The API binds `0.0.0.0:4800` (fixed to
  match the container).

## Run locally

```bash
cd discord
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example ../.env     # shared root .env, then edit DISCORD_TOKEN
python -m app.main
```

Check the API: `curl http://localhost:4800/api/v1/health`

```json
{"status": "ok", "version": "0.1.0", "uptime_seconds": 4.511, "bot": "running"}
```

`bot` is `"disabled"` when no `DISCORD_TOKEN` is set. The status stays `ok` and
the response stays 200 either way — it tracks the API, so the container
healthcheck passes on an API-only run.

Ping Discord through the API — the bot posts `ping from client` to
`DISCORD_BOT_OUTPUT_CHANNEL`:

```bash
curl -X POST http://localhost:4800/api/v1/ping
```

```json
{"status": "sent", "channel_id": "42", "message_id": "1234567890"}
```

Failures are explicit: `503` when the bot is disabled or still connecting,
`409` when no output channel is configured, `404` when the bot cannot see that
channel, and `502` when Discord rejects the send (e.g. missing permissions).
`health` and `ping` are unauthenticated, so do not expose port 4800 beyond a trusted network.

Create a study (contract: `docs/discord-development-guide/api/create-study.md`).
Needs `DISCORD_GUILD_ID`, `DISCORD_CAPTAIN_ROLE_ID`, and `DISCORD_API_KEY` set,
and a caller who has the captain role:

```bash
curl -X POST http://localhost:4800/api/v1/studies \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"studyName": "알고리즘 스터디"}'
```

The bot needs `Manage Channels` and `Manage Roles` in that guild. Study names are
reserved in SQLite at `data/discord.sqlite3` (fixed in `app/config.py`); in
Docker that directory is the `studyclub-discord-data` volume.

List a study's text and voice channels (contract:
`docs/discord-development-guide/api/get-study-channels.md`). Also needs
`DISCORD_NAVIGATOR_ROLE_ID`, and a caller with the captain or navigator role
(or `DISCORD_BOT_ID`, see below):

```bash
curl http://localhost:4800/api/v1/studies/1327394882193883136/channels \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136'
```

Post an operational alert (contract:
`docs/discord-development-guide/api/send-alert-message.md`). Needs
`DISCORD_ALERT_CHANNEL_ID`, and a caller with the captain role -- a navigator
cannot raise one by hand:

```bash
curl -X POST http://localhost:4800/api/v1/channels/alert/msg \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"msg": "알고리즘 스터디 1기가 완료 처리되었습니다."}'
```

Answers `204` with no body. The bot needs `Send Messages` in the alert channel --
without it *every* request fails with `502`, so fix the channel permission rather
than retry. `@everyone` and `@here` are removed from `msg`, and nothing the
message contains ever notifies anyone.

The backend also raises alerts on its own behalf rather than a member's. It says
so by sending `DISCORD_BOT_ID` as `X-Discord-User-ID`, and such a request skips
the member and role lookup entirely -- `X-API-Key` has already established who
the caller is. The same goes for listing a study's channels. No other endpoint
accepts it, and leaving `DISCORD_BOT_ID` unset means no request is ever a system
call.

Post a guild-wide announcement (contract:
`docs/discord-development-guide/api/send-announcement-message.md`). Needs
`DISCORD_ANNOUNCEMENT_CHANNEL_ID`, and a caller with the captain role --
navigators cannot send one:

```bash
curl -X POST http://localhost:4800/api/v1/channels/announcement/msg \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"msg": "알고리즘 스터디 2기 모집을 시작합니다."}'
```

Answers `204` with no body. The message goes up under an `@everyone` line that
the bot adds; `@everyone` and `@here` inside `msg` are removed, so only that one
line notifies. The bot needs `Send Messages` and `Mention Everyone` in the
announcement channel. Without `Mention Everyone` Discord posts the announcement
anyway with nobody notified, so the answer is still `204` and the bot leaves a
note in the alert channel.

Post to a channel of a study, mentioning whoever should be notified (contract:
`docs/discord-development-guide/api/send-message.md`). The caller picks the
channel, and either the captain or the navigator role may call:

```bash
curl -X POST http://localhost:4800/api/v1/channels/1327394882193883137/msg \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"discordStudyId": "1327394882193883136",
       "msg": "이번 주 모임은 목요일 저녁 9시로 옮깁니다.",
       "discordUserIds": ["427394882193883136"]}'
```

Answers `204` with no body. The channel must sit directly under the
`discordStudyId` category, but that check only compares the two IDs in the
request: it does not check that the category belongs to a study, so it is no
defense against a navigator -- whose role is guild-wide -- reaching a channel
outside their study. Staying inside study channels rests on the backend sending
a pair from its own records.
Only the users in `discordUserIds` (at most 40) are notified; the sender line,
anything typed into `msg`, and a `@everyone` that somehow survived stripping all
render as text and ring nobody. A user who has left the guild does not hold the
message back -- it goes up mentioning everyone still there, and the bot leaves a
note in the alert channel naming who was left out. Here `Send Messages` is per
channel, so a `502` means that one channel's permissions, not every request.

In Discord: `!testCmd`

## Docker

`docker-compose.yml` lives at the repo root. From there:

```bash
docker compose up --build
```

The service reads the root `.env` via `env_file`, so `DISCORD_TOKEN` and
`DISCORD_BOT_OUTPUT_CHANNEL` are picked up there. After editing either, run
`docker compose up -d discord` to recreate the container with the new values.

## Tests

```bash
cd discord
pip install -r requirements-dev.txt
pytest
```
