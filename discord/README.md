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
    routes/studies.py  # POST /api/v1/studies (create-study)
    routes/channels.py # POST /api/v1/channels/{id|alert|announcement}/msg (send-message and friends)
    headers.py         # common request headers (X-API-Key, X-Discord-User-ID, Idempotency-Key)
    guild.py           # resolves the caller in the guild and checks their role
  study_reservations.py  # SQLite study-name reservations for create-study
  backend_client.py      # the one place that calls OUT, to the StudyClub backend
  voice_activity_log.py  # SQLite last join/leave date per voice channel
  bot/
    client.py            # Discord bot factory
    bulletin.py          # the one-message 공부방 board, refreshed daily at 20:00 PT
    voice_monitor.py     # records joins/leaves, reports 3-week-quiet 공부방 daily
    commands/command_channel.py    # the DISCORD_BOT_CHANNEL_ID gate every command passes
    commands/test_cmd.py           # testCmd command
    commands/bulletin_cmd.py       # updateBulletin command
    commands/voice_monitor_cmd.py  # checkVoiceChannels command
    commands/attendance_cmd.py  # !출석체크 command
    commands/help_cmd.py           # the !help menu, grouped by category
tests/                 # pytest unit tests
```

## Configuration

- **Secrets** — environment variables, loaded from `.env` in development.
  `.env` and `.env.example` live at the repo root (shared across projects).
  Copy `.env.example` to `.env` there and set `DISCORD_TOKEN`. With no token
  the API still starts and `/api/v1/health` reports `"bot": "disabled"`; only a
  token that is set but invalid is fatal.
- **Settings** — `DISCORD_BOT_CHANNEL_ID` is the numeric Discord channel ID the
  bot takes commands from; see [Bot commands](#bot-commands). Leave it empty and
  every command is refused everywhere — a missing setting never means "any
  channel". A non-numeric value is logged and dropped at startup, which lands in
  that same refusal; the service always starts either way. It is read once at
  startup, so changing it means `docker compose up -d discord`
  (a restart alone will not re-read `.env`).
- **Calling the backend** — `!출석체크` is the only thing here that calls *out*.
  It reads `API_BASE_URL` (the same key the frontends use; `docker-compose.yml`
  overrides it to the internal `http://api:8080` for this service too) and
  sends `DISCORD_API_KEY` as `X-API-Key`. That one key serves both directions:
  Spring reads it as `discord.api-key` for the calls coming the other way.
  With either unset the command refuses and says so; nothing else is affected.
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

`health` is unauthenticated, so do not expose port 4800 beyond a trusted network.

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

## Bot commands

Every command is read from **one channel only**, the one in
`DISCORD_BOT_CHANNEL_ID`. These are moderator tools, so keeping the traffic in
one place means the rest of the guild never has to read it and whoever runs the
guild has one scrollback to check when something went wrong.

| Command | Category | Who | What |
|---------|----------|-----|------|
| `!updateBulletin` | Captain | captain | rewrites the [bulletin](#voice-channel-bulletin) now instead of waiting for 8PM |
| `!checkVoiceChannels` | Captain | captain | prints every 공부방's last activity date ([monitor](#voice-channel-activity-monitor)) |
| `!출석체크` | Navigator | the 반's 반장(navigator) — the backend checks, not the bot | marks everyone in the 공부방 present ([출석체크](#출석체크)) |
| `!help` | ETC | anyone | lists the commands above, grouped by this Category column |
| `!testCmd` | ETC | anyone in the command channel | replies `testCmd OK ✅` — proves the bot hears and answers |

**Category** is the heading `!help` files the command under, narrowest audience
first. It is a label for whoever reads the menu, not a permission check: each
command enforces its own, and `!출석체크` is checked by the backend per study
(see [출석체크](#출석체크)). A new command declares its category in `extras` where
it is registered; `app/bot/commands/help_cmd.py` groups on that, and a command
naming none lands under `ETC`.

Used anywhere else, a command replies with a link to the right channel and does
nothing. With `DISCORD_BOT_CHANNEL_ID` unset every command is refused in every
channel, including DMs.

The gate lives in `app/bot/commands/command_channel.py` and each command above
calls it before doing anything else. A command that has to work outside that
channel is an **exception** and must say so in its own docstring and be listed
here, or the rule is only true by accident.

| Exception | Why | To close it |
|-----------|-----|-------------|
| `!help` | discord.py registers it, not us, so the gate never runs for it. It answers in any channel, listing only the commands above — it leaks nothing. | pass `help_command=None` to `commands.Bot(...)` in `app/bot/client.py`, dropping `help_cmd.CategorizedHelpCommand` |
| `!출석체크` | the voice channel it is typed in *is* the input — members, study id, and audience all come from it. See [출석체크](#출석체크). | by design; not closable |

### 출석체크

Mark everyone in the study's voice room present (contract:
`specs/discord-attendance/spec.md`). It is answered **only inside a voice
channel's own chat**, so one channel decides everything: its connected members
are the snapshot, its category is the study id, and the reply lands where those
same people read it. Run from a lobby instead, a 반장(navigator) sitting in another
study's room would have that study's roster posted here. Bots in the room are
dropped, and the reply names people without mentioning them.

The bot only collects and reports. Which meeting, which group, and what not to
overwrite are decided by the backend, because the timestamps that decide them
live there.

Needs `API_BASE_URL` and `DISCORD_API_KEY`, and a `STUDY_DISCORD_LINK` row for
the category — study registration creates it (#145); without it the backend
answers `404` and the bot says the study is not connected yet.

## Voice channel bulletin

The bot keeps one message in `DISCORD_BULLETIN_CHANNEL_ID` listing every study's
voice channels as clickable links, so a member reaches their 공부방 without
scrolling the sidebar:

```
알고리즘 스터디 : <#1327394882193883138> - <#1327394882193883139>
CS 전공 스터디 : <#1327394882193883142>
```

One line per category below the `===== New Study =====` category -- the same
category `create-study` places new studies under. Without it the bot leaves the
board alone rather than risk publishing operational categories.

It refreshes once a day at 20:00 America/Los_Angeles -- 8PM local through the
PST/PDT switch -- and once more whenever the bot starts, so a deploy does not
leave a stale board up until the evening. The schedule is not configurable:
change `BULLETIN_TIME` in `app/bot/bulletin.py`.

A captain who does not want to wait for 8PM can rewrite it now:

```
!updateBulletin
```

The bot replies either way, and a failure has already reached the alert channel.
Captain only, like every other write this service performs: a refresh costs a
history read and an edit against Discord's rate limits, and the board is what
every member reads. To let navigators run it too, widen `may_update` in
`app/bot/commands/bulletin_cmd.py`.

Leave `DISCORD_BULLETIN_CHANNEL_ID` empty and the loop never starts; everything
else runs as before. The bot needs `View Channel`, `Send Messages`, and
**`Read Message History`** in that channel: without the last one it cannot find
the message it wrote and posts a new one every refresh. "Exactly one message" is
a channel-permission setup (members read-only, moderators and the bot may post),
not something the bot enforces -- it only ever edits its own oldest message.
Any failure leaves the board untouched and lands in the alert channel.

Design and decisions:
`docs/discord-development-guide/voice-channel-bulletin.md`.

## Voice channel activity monitor

The bot writes down every join and leave in the guild's voice channels -- a date
per channel in `data/discord.sqlite3`, not a log -- and once a day reports the
공부방 nobody has joined or left for **three weeks** to
`DISCORD_ALERT_CHANNEL_ID`:

```
3주(21일) 이상 입·퇴장이 없는 공부방이 2개 있습니다. (기준일: 2026-09-29)
알고리즘 스터디 - 공부방-알고리즘 스터디 : 2026-08-20
영어 회화 - 공부방-영어 회화 : 기록 없음 (관찰 시작 2026-08-25)
```

Each room is reported **once per quiet streak**: activity clears the mark, so it
can be reported again the next time it falls silent. The check runs at 20:00
America/Los_Angeles and once more whenever the bot starts. Neither the schedule
nor the three weeks are configurable: change `CHECK_TIME` and `INACTIVITY` in
`app/bot/voice_monitor.py`.

A captain can see the whole picture at any time, quiet or not:

```
!checkVoiceChannels
→ 알고리즘 스터디 - 공부방-알고리즘 스터디 : 2026-08-20
  알고리즘 스터디 - 공부방-2조 : 2026-09-29
  영어 회화 - 공부방-영어 회화 : 기록 없음 (관찰 시작 2026-08-25)
```

Both outputs cover the voice channels below the `===== New Study =====`
category; without that category nothing is judged, since there would be no
telling a study from an operational one. A channel deleted from the guild loses
its row, and a channel nobody has used yet is measured from the day the bot
first saw it -- a 공부방 created yesterday is never reported.

**Recording and reporting are switched on separately.** With no
`DISCORD_GUILD_ID` nothing is recorded; with no `DISCORD_ALERT_CHANNEL_ID`
activity is still recorded but never reported, so turning the channel on later
does not mean waiting three weeks for the first report -- the daily check still
runs and registers the rooms nobody has joined, and skips only the report. No
new environment variable belongs to this feature.

Two limits are worth knowing: activity that happens while the bot is **offline**
is lost (gateway events are not replayed, and Discord has no "last join" API),
so a room can be reported as quiet when it was not -- the daily check credits
rooms that have someone in them at that moment, which covers the common case.
And "activity" means joins and leaves, not time spent.

Design and decisions:
`docs/discord-development-guide/voice-channel-activity-monitor.md`.

## Docker

`docker-compose.yml` lives at the repo root. From there:

```bash
docker compose up --build
```

The service reads the root `.env` via `env_file`, so `DISCORD_TOKEN` and
`DISCORD_BOT_CHANNEL_ID` are picked up there (and every other `DISCORD_*`
setting, `DISCORD_BULLETIN_CHANNEL_ID` included). After editing either, run
`docker compose up -d discord` to recreate the container with the new values.

## Tests

```bash
cd discord
pip install -r requirements-dev.txt
pytest
```
