# myDiscordBotTest

Baseline Discord bot + FastAPI service in Python. The Discord client and the HTTP
API run concurrently on one asyncio event loop, so neither blocks the other.

## Layout

```
app/
  config.py            # .env (secrets) + config.json (settings) -> Settings
  main.py              # runs the API and the bot together (asyncio.TaskGroup)
  api/
    server.py          # FastAPI app factory (holds the bot + settings store)
    routes/health.py   # GET /api/v1/health (liveness + bot state)
    routes/ping.py     # POST /api/v1/ping (bot posts a ping to the output channel)
  bot/
    client.py            # Discord bot factory
    commands/test_cmd.py    # testCmd command
    commands/reload_cmd.py  # reloadConfig command (owner-only)
tests/                 # pytest unit tests
```

## Configuration

- **Secrets** — environment variables, loaded from `.env` in development.
  `.env` and `.env.example` live at the repo root (shared across projects).
  Copy `.env.example` to `.env` there and set `DISCORD_TOKEN`. With no token
  the API still starts and `/api/v1/health` reports `"bot": "disabled"`; only a
  token that is set but invalid is fatal.
- **Settings** — `config.json` holds `discord_bot_output_channel` (a numeric
  Discord channel ID, or `null`). Copy `config.json.example` to `config.json`;
  like `.env`, the real file is git-ignored and only the example is committed.
  A missing file is not an error — the settings fall back to their defaults.
  Override the file path with `CONFIG_PATH`.
  A running bot re-reads the file when the owner runs `!reloadConfig`, so the
  output channel can change without a restart. `command_prefix` and `log_level`
  are fixed per deployment — change their defaults in `app/config.py`. The API
  binds `0.0.0.0:4800` (fixed to match the container).

## Run locally

```bash
cd discordBot
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp ../.env.example ../.env     # shared root .env, then edit DISCORD_TOKEN
cp config.json.example config.json
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
`discord_bot_output_channel`, so `!reloadConfig` also redirects this endpoint:

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

In Discord: `!testCmd`, or `!reloadConfig` (owner only) after editing `config.json`

## Docker

`docker-compose.yml` lives at the repo root. From there:

```bash
cp discordBot/config.json.example discordBot/config.json   # mounted read-only
docker compose up --build
```

## Tests

```bash
cd discordBot
pip install -r requirements-dev.txt
pytest
```
