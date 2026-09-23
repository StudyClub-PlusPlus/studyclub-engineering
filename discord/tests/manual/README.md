# Manual test harness

로컬에서 손으로 돌려 보는 테스트용 웹페이지다. `127.0.0.1:8900` 에 뜨고 두 가지를 한다.

1. **Discord OAuth2 authorization code flow** 를 leg 단위로 실행한다 —
   authorize → callback → token → `/users/@me`. 각 단계가 따로 있어서 일부러 깨 볼 수 있다.
2. **Discord 서비스 API** ([`docs/discord-development-guide/api/`](../../../docs/discord-development-guide/api/))
   9개 엔드포인트를 호출하고 요청·응답 원문을 보여 준다.

> ⚠️ 그 9개는 **아직 구현 전이다** (`app/api/routes/` 에는 `health` · `ping` 뿐).
> 지금 보내면 전부 404 다 — 구현되는 대로 여기서 바로 확인하라고 만든 도구다.
> `X-API-Key` 인증도 아직 서버에 없어서 관련 토글은 당분간 아무 차이를 만들지 않는다.

**pytest 대상이 아니다.** `pytest.ini` 의 `norecursedirs` 로 수집에서 빠져 있다.

## 설정

**설정은 이 폴더의 `.env` 에만 둔다.** 루트 `.env` 는 docker-compose 가 띄우는 서비스들이 읽는
파일이라, 하니스만 쓰는 값으로 그 목록을 늘리지 않는다.

```bash
cd discord/tests/manual
cp .env.example .env        # 그 다음 값 채우기 (discord/.gitignore 가 이 .env 를 무시한다)
```

| 변수 | 쓰임 | 없으면 |
|------|------|--------|
| `DISCORD_CLIENT_ID` | OAuth2 클라이언트 ID | authorize URL 을 만들 수 없다 |
| `DISCORD_CLIENT_SECRET` | 토큰 교환 (confidential client) | 토큰 교환이 실패한다 |
| `DISCORD_OAUTH_REDIRECT_URI` | 기본 `http://localhost:8900/oauth/callback` | 위 기본값을 쓴다 |
| `DISCORD_API_KEY` | 프록시가 붙이는 `X-API-Key` | 빈 값으로 나간다 |
| `DISCORD_API_BASE_URL` | 호출 대상 | `http://localhost:4800` |

**Discord Developer Portal 설정이 먼저다.** 앱의 OAuth2 → Redirects 에
`http://localhost:8900/oauth/callback` 을 **등록**해야 한다. 등록 전에는 authorize 단계에서
Discord 가 `invalid_redirect_uri` 로 막는다.

값은 요청마다 다시 읽는다 — `.env` 를 고쳤으면 페이지만 새로고침하면 된다 (파일 값이 우선한다).

> `DISCORD_TOKEN` · `DISCORD_PORT` · `DISCORD_BOT_OUTPUT_CHANNEL` 은 **서비스** 설정이라 계속
> 루트 `.env` 에 있다. 여기 것과 섞지 않는다.

## 실행

```bash
cd discord
source .venv/bin/activate
pip install -r requirements-dev.txt     # httpx 가 여기 있다
python tests/manual/server.py
```

서버는 `tests/manual/.env` 를 읽는다 — 어디서 실행하든 파일 위치 기준이다.

`http://localhost:8900` 을 연다. 테스트 대상(`python -m app.main` 또는 `docker compose up discord`)은
따로 띄워 둔다 — 페이지 상단 `target` 에서 `4800`(직접 실행) / `24800`(도커) 를 고른다.

## OAuth2 flow

| leg | 무엇 | 깨 보는 법 |
|-----|------|-----------|
| 1 authorize | `state` 를 만들고 authorize URL 을 보여 준다. `scope` · `prompt` 수정 가능 | 동의 화면에서 거부, URL 의 `state` 를 손으로 바꾸기 |
| 2 callback | Discord 가 준 `code` · `state` 원문과 `state` 일치 여부. **자동으로 교환하지 않는다** | `state` 불일치 확인 |
| 3 token | `code` → 토큰 교환, `refresh_token` 교환 | 같은 code 로 두 번 누르기 → `invalid_grant` |
| 4 /users/@me | access token 으로 조회. 여기 `id` 가 아래 모든 호출의 `X-Discord-User-ID` 가 된다 | 토큰 없이 누르기 |

토큰은 기본적으로 가려서 보여 준다 (`reveal tokens` 로 원문). 세션은 이 프로세스 메모리에만 있고
재시작하면 사라진다.

## 프로덕션 방식 버튼 (`auth with discord`)

위 4단계와 **같은 grant** 를 실제 앱이 쓰는 모양으로 묶은 것이다.

```
버튼 클릭 → 팝업(/auth/discord/start) → Discord 동의 화면
  → /oauth/callback (서버가 state 검증 → code 교환 → /users/@me)
  → postMessage({source:"studyclub-discord-auth", ok}) → 팝업 닫힘
  → 부모 창이 /api/auth/user 로 프로필만 받아 표시
```

- **브라우저는 code 도 토큰도 보지 않는다.** 둘 다 서버에만 있고, 페이지가 받는 건 프로필뿐이다
  (`id` · `username` · `global_name` · 아바타).
- `postMessage` 의 `targetOrigin` 은 하니스 origin 으로 고정한다 — `"*"` 금지
  ([auth-flow.md](../../../docs/frontend-development-guide/auth-flow.md#apiauthcallback-보안-주의) 와 같은 이유).
- **redirect URI 는 위 수동 플로우와 같은 것을 쓴다** (`/oauth/callback`). Discord 는 등록된 URL 만
  받으므로 버튼 때문에 두 번째 URL 을 등록하게 만들지 않았다 — 세션의 `pending_mode` 로 구분한다.
- 로그인하면 그 유저 ID 가 아래 API 호출의 `X-Discord-User-ID` 가 된다. 수동 4단계를 밟은 것과 같은 결과다.
- 실패(거부 · state 불일치 · 교환 실패)는 팝업이 닫히고 버튼 옆에 한 줄로 뜬다.
- **`trace` 블록** — 서버가 실제로 밟은 단계를 전부 펼쳐 본다 (authorize params · callback params ·
  `stateMatches` · 토큰 교환 요청/응답 · `/users/@me` 응답 · 최종 결과). 성공이든 실패든 남으므로,
  팝업이 닫힌 뒤에도 어디서 깨졌는지 볼 수 있다 — 프로덕션 모양이 감추는 유일한 것을 디버깅용으로
  되돌려 놓은 것이다. 실제 앱은 프로필까지만 내려준다.
- 토큰은 기본적으로 마스킹하고 `reveal tokens` 로 푼다. **브라우저가 토큰을 볼 수 있는 건 이 trace
  때문뿐이다** — 실제 구현에서는 서버 밖으로 나가지 않는다.

**실제 앱과 다른 점**: 여기서는 하니스 한 프로세스가 Next(BFF)와 Spring 역할을 겸한다. 실제로는
Next 가 `code` 를 Spring 에 넘기고 **Spring 이** 교환·계정 매핑·자체 JWT 발급까지 한다
([spec](../../../specs/auth-google-login/spec.md)). 그리고 여기 세션은 메모리라 재시작하면 사라진다.

## 엔드포인트 호출

패널마다 문서의 예시 값이 미리 채워져 있다. `send` 를 누르면 harness 가 프록시로 보낸다 —
브라우저에서 직접 부르지 않는 이유는 (1) 서비스에 CORS 설정이 없고, (2) `X-API-Key` 를 페이지
소스에 두지 않기 위해서, (3) `Idempotency-Key` 를 한 곳에서 만들기 위해서다.

프록시가 붙이는 것:

- `X-API-Key` — `.env` 의 값 (로그에는 마스킹해서 남는다)
- `X-Discord-User-ID` — OAuth 세션의 유저 ID (상단에서 직접 덮어쓸 수 있다)
- `Idempotency-Key` — 요청마다 새 UUID v4 (`GET` 에는 붙이지 않는다)

상단 토글로 헤더를 일부러 빠뜨리거나 틀리게 보낼 수 있다. 문서가 규정하는 것의 절반이
400 / 401 / 403 동작이라, 그 경로를 손으로 밟을 수 있어야 한다.

## 나중에

시나리오 체인(`create-study` → `get-study-channels` → `send-message` 로 ID 를 이어서 넘기는 버튼)은
엔드포인트가 구현되면 추가한다. `app.js` 의 `ENDPOINTS` 배열이 패널을 만들고,
`call()` 이 한 번의 호출을 담당한다 — 체인은 `call()` 을 순서대로 부르면 된다.
