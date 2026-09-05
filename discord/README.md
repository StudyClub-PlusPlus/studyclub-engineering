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
{"status": "sent", "channel_id": 42, "message_id": 1234567890}
```

Failures are explicit: `503` when the bot is disabled or still connecting,
`409` when no output channel is configured, `404` when the bot cannot see that
channel, and `502` when Discord rejects the send (e.g. missing permissions).
The API is unauthenticated, so do not expose port 4800 beyond a trusted network.

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
