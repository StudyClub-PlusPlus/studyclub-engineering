# Common Header

Discord 서비스(`discord/`, FastAPI)의 HTTP API 를 호출할 때 붙이는 **공통 요청 헤더** 규약.
호출자는 백엔드(Spring) 같은 내부 서비스다 — 브라우저에서 직접 부르지 않는다.

> ⚠️ **일부만 구현됐다.** 헤더 검사는 `discord/app/api/headers.py` 의 FastAPI 의존성이고, 지금은
> `POST /api/v1/studies` · `GET /api/v1/studies/{discordStudyId}/channels` ·
> `POST /api/v1/channels/alert/msg` · `POST /api/v1/channels/announcement/msg` ·
> `POST /api/v1/channels/{discordChannelId}/msg` · `POST` · `DELETE /api/v1/roles/navigator/users` ·
> `POST` · `DELETE /api/v1/roles/{discordRoleId}/users` 에만 걸려 있다. `health` 는 여전히 인증 없이 열려 있고,
> 없는 경로에 401 을 우선하는 동작도 아직 없다 (`discord/README.md` 참고).

## Table of Contents

- [헤더 목록](#헤더-목록)
- [Content-Type](#content-type)
- [X-API-Key](#x-api-key)
- [X-Discord-User-ID](#x-discord-user-id)
  - [시스템 호출](#시스템-호출)
- [Idempotency-Key](#idempotency-key)
- [요청 예시](#요청-예시)

## 헤더 목록

| 헤더 | 필수 | 예시 |
|------|------|------|
| `Content-Type` | 바디가 있을 때 | `application/json` |
| `X-API-Key` | O | `<서비스 간 인증 키>` |
| `X-Discord-User-ID` | O | `327394882193883136` |
| `Idempotency-Key` | 상태를 바꾸는 요청(`POST`/`PUT`/`PATCH`/`DELETE`) | `9f1c...` (UUID v4) |

앞의 `Content-Type` 만 일반적인 헤더고, 나머지 셋은 이 서비스의 커스텀 헤더다.

## Content-Type

- 바디가 있으면 `application/json` 고정.
- 바디가 없는 `GET`/`DELETE` 에는 붙이지 않는다.

## X-API-Key

**호출자(서비스) 인증.** Discord 서비스는 사용자 JWT 를 검증하지 않는다 — 사용자 인증은
호출자(백엔드)가 이미 끝낸 것으로 본다.

- 키가 없거나 틀리면 **401**. 경로가 존재하지 않아도 401 을 우선한다
  (밖에서 엔드포인트를 훑을 수 없게 — BE 규약과 동일).
- 키는 환경변수 `DISCORD_API_KEY` 다. 백엔드도 같은 값을 읽어 헤더에 싣는다. 비어 있으면 모든 요청이 401 이다
  (키가 없다고 열리지 않는다).
- **키는 레포에 평문 금지.** 환경변수로 주입하고 코드에서는 `os.environ` 으로 참조만 한다
  ([`../../../AGENT.md`](../../../AGENT.md) 의 PUBLIC 레포 규칙).

## X-Discord-User-ID

**요청자의 Discord 유저 ID** (snowflake). StudyClub 의 `ACCOUNT.ID` 가 아니다 — 메시지에
`<@ID>` 로 찍혀 Discord 가 이름으로 그려 주므로, 디스코드 쪽 식별자를 그대로 넘긴다.

**봇은 이 ID 로 아무것도 검사하지 않는다.** 길드 멤버인지도, captain · navigator 역할이 있는지도
보지 않는다. 누가 이 요청을 시킬 수 있는지는 **백엔드가 호출 전에** 정한다 — 봇은 `X-API-Key` 로
백엔드가 부른 것인지만 확인한다. 이 ID 를 쓰는 곳은 **발신자 줄** 하나다 —
[`send-message`](send-message.md) · [`send-alert-message`](send-alert-message.md) 는 메시지 맨 위에
`발신: <@ID>` 를 붙인다.

- **모든 엔드포인트에 필수**다 (`health` 제외). 쓰지 않는 엔드포인트도 받는다 — 사람이 시킨 요청이
  아니어도 생략하지 않는다 ([시스템 호출](#시스템-호출) 참고).
- **엔드포인트 경계에서 snowflake 는 항상 문자열이다** — 요청 헤더도, 응답 바디에 실어 보낼 때도.
  64비트라 JS `number` 로 담으면 정밀도가 깨진다 (2^53 초과).
- 숫자가 아니면 **400**, 필요한데 없으면 **400**. 검증은 `^[0-9]{17,20}$` 로 한다 —
  `int()` 는 `+123` · `1_2_3` · 공백 · 비ASCII 숫자(`١٢٣`)까지 받아주고, `str.isdigit()` 도
  `"١٢٣"` 에 `True` 라 둘 다 검증에는 못 쓴다.
- `int` 변환은 **요청 경계에서 한 번** 한다 (FastAPI 의존성). discord.py 는 `int` 를 받으므로
  내부 코드는 `int` 를 들고 다니고, 파싱 실패는 거기서 400 이 된다 — 호출 직전마다 변환하면
  같은 파싱과 에러 처리를 엔드포인트마다 반복하게 된다. `config.py` 가 
  `DISCORD_CONFIG_BOT_CHANNEL_ID` 을 시작 시점에 한 번 파싱해 `int` 로 들고 있는 것과 같은 결.
- **넘기는 건 이 ID 까지다** — 이름·이메일 같은 개인정보는 헤더로도 로그로도 넘기지 않는다.

### 시스템 호출

백엔드가 **사람 대신 자기 이름으로** 부르는 요청이 있다. 예를 들어 navigator 가 스터디를 완료 처리하면
그 알림은 navigator 가 직접 올리는 게 아니라 **백엔드가** [`send-alert-message`](send-alert-message.md)
로 올린다.

이때 백엔드는 `X-Discord-User-ID` 에 **봇 자신의 유저 ID** 를 싣는다. 백엔드 환경변수 `DISCORD_CONFIG_BOT_ID` 다.
Discord 서비스는 이 값을 읽지 않는다 — 봇에게 봇 ID 는 다른 ID 와 다를 게 없다.

- 시스템 호출이라고 봇이 다르게 처리하는 것은 없다. 어떤 엔드포인트를 백엔드 이름으로 부를지는 백엔드가 정한다.
- 달라지는 건 **발신자 줄**이다. alert 채널에는 `발신: <@봇 ID>` 가 찍혀 봇 이름으로 보인다 —
  사람이 올린 것과 구분된다.

## Idempotency-Key

**요청 식별자다 — 로그에서 요청을 추적하는 데 쓴다.** 서버는 이 키를 저장하지 않고, 같은 키가 다시 와도
응답을 재생하지 않는다. 이름을 `Idempotency-Key` 로 둔 건 나중에 실제 멱등 처리를 붙일 때
헤더 계약을 바꾸지 않기 위해서다.

- 요청당 하나의 새 UUID v4. **재시도할 때는 같은 값을 그대로 다시 보낸다** — 한 요청의 시도들이
  로그에서 같은 ID 로 묶인다.
- 상태를 바꾸는 요청에는 **필수**다. 없으면 **400**.
- 키로는 중복 요청을 막지 않는다. 같은 요청이 두 번 오면 두 번 실행된다. 중복의 영향이 큰
  [`create-study`](create-study.md#중복-요청) 만 `studyName` 으로 따로 막고, 나머지는 막지 않는다.
- 조회(`GET`)에는 붙이지 않는다.

## 요청 예시

```bash
curl -X POST http://localhost:4800/api/v1/channels/alert/msg \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H 'Idempotency-Key: 9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa' \
  -d '{"msg": "알고리즘 스터디 1기가 완료 처리되었습니다."}'
```
