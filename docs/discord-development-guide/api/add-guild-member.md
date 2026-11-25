# add-guild-member

유저를 스터디클럽 서버(길드)에 넣는다. 백엔드가 계정 연동(`POST /api/me/discord/link`) 중에 유저가 서버 밖이면 부른다 (ZAPP 스터디클럽 #112).

- **Method / Path**: `PUT /api/v1/members/{discordUserId}`
- **헤더**: [공통 헤더](common-header.md) — `X-API-Key` · `X-Discord-User-ID`(백엔드는 봇 시스템 사용자 ID). `Idempotency-Key` 는 받지 않는다 — 디스코드 PUT 이 이미 멱등이다
- **구현**: `discord/app/api/routes/members.py`

## Request Body

```json
{ "accessToken": "<유저가 guilds.join 을 허락한 OAuth2 액세스 토큰>" }
```

토큰은 디스코드 `PUT /guilds/{guild}/members/{user}` 에 한 번 넘기고 저장 · 로그하지 않는다.

## Response — 200

```json
{ "joined": true }
```

| 필드 | 설명 |
|------|------|
| joined | 새로 들어왔으면 true(디스코드 201), 이미 서버에 있었으면 false(디스코드 204) |

서버에 규칙 확인(Membership Screening)이 켜져 있으면 새 멤버는 대기(pending) 상태로 들어온다. 규칙 동의는 유저가 디스코드에서 한다.

## Error Responses

| 상태 | detail | 조건 |
|------|--------|------|
| 409 | `BANNED` | 서버에서 차단된 계정 (디스코드 40007) |
| 409 | `TOO_MANY_GUILDS` | 그 계정이 들어갈 수 있는 서버 수 한도 (디스코드 30001) |
| 409 | `INVALID_ACCESS_TOKEN` | 토큰이 틀렸거나 `guilds.join` 이 없음 (디스코드 50025) |
| 409 | `MISSING_PERMISSION` | 봇에 초대 만들기 권한이 없음, 또는 로그인용 OAuth 앱과 봇이 다른 앱 |
| 409 | `DISCORD_REJECTED` | 그 밖의 디스코드 거절 |
| 503 | — | 봇 미연결 · 길드 없음 ([guild 공통](summary.md#공통-규칙)) |

백엔드는 어떤 거절이든 연동을 `403 DISCORD_NOT_IN_GUILD` 로 돌려준다. 화면은 초대 링크 안내로 내려간다.
