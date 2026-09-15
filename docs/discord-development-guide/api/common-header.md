# Common Header

Discord 서비스(`discord/`, FastAPI)의 HTTP API 를 호출할 때 붙이는 **공통 요청 헤더** 규약.
호출자는 백엔드(Spring) 같은 내부 서비스다 — 브라우저에서 직접 부르지 않는다.

> ⚠️ **아직 구현 전이다.** 현재 `/api/v1/*` 는 인증 없이 열려 있다 (`discord/README.md` 참고).
> 이 문서는 앞으로 구현할 계약이고, 구현 전까지 아래 헤더는 무시된다.

## Table of Contents

- [헤더 목록](#헤더-목록)
- [Content-Type](#content-type)
- [X-API-Key](#x-api-key)
- [X-Discord-User-ID](#x-discord-user-id)
- [Idempotency-Key](#idempotency-key)
- [요청 예시](#요청-예시)

## 헤더 목록

| 헤더 | 필수 | 예시 |
|------|------|------|
| `Content-Type` | 바디가 있을 때 | `application/json` |
| `X-API-Key` | O | `<서비스 간 인증 키>` |
| `X-Discord-User-ID` | 조건부 — 길드 내 자격 검사가 필요한 요청 | `327394882193883136` |
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
- **키는 레포에 평문 금지.** 환경변수로 주입하고 코드에서는 `os.environ` 으로 참조만 한다
  ([`../../../AGENT.md`](../../../AGENT.md) 의 PUBLIC 레포 규칙).

## X-Discord-User-ID

**Discord 유저 ID** (snowflake). StudyClub++ 의 `ACCOUNT.ID` 가 아니다 — 봇이 이 ID 로
길드(Discord 서버) 멤버를 조회해야 하므로, 디스코드 쪽 식별자를 그대로 넘긴다.

봇은 이 ID 로 두 가지를 한다:

1. **정보 추출** — 길드 멤버 정보(닉네임·역할·가입 시각 등)를 읽는다.
2. **자격 검사** — 그 멤버가 요청한 액션을 길드 안에서 수행할 자격이 있는지 확인한다.
   자격 기준(어떤 역할·채널 권한이 필요한지)은 엔드포인트마다 다르므로 각 엔드포인트 문서에 적는다.

즉 **인증은 `X-API-Key`, 길드 내 인가는 `X-Discord-User-ID` 로 봇이** 한다. 이 헤더 자체는
호출자가 주장하는 값이라 인증 수단이 아니다 — 신뢰 경계는 `X-API-Key` 가 긋는다.

- 길드 내 자격 검사가 필요한 요청에는 필수. 시스템·스케줄러 발 요청은 생략한다.
- **엔드포인트 경계에서 snowflake 는 항상 문자열이다** — 요청 헤더도, 응답 바디에 실어 보낼 때도.
  64비트라 JS `number` 로 담으면 정밀도가 깨진다 (2^53 초과).
- 숫자가 아니면 **400**, 필요한데 없으면 **400**. 검증은 `^[0-9]{17,20}$` 로 한다 —
  `int()` 는 `+123` · `1_2_3` · 공백 · 비ASCII 숫자(`١٢٣`)까지 받아주고, `str.isdigit()` 도
  `"١٢٣"` 에 `True` 라 둘 다 검증에는 못 쓴다.
- `int` 변환은 **요청 경계에서 한 번** 한다 (FastAPI 의존성). discord.py 는 `int` 를 받으므로
  내부 코드는 `int` 를 들고 다니고, 파싱 실패는 거기서 400 이 된다 — 호출 직전마다 변환하면
  같은 파싱과 에러 처리를 엔드포인트마다 반복하게 된다. `config.py` 가 
  `DISCORD_BOT_OUTPUT_CHANNEL` 을 시작 시점에 한 번 파싱해 `int` 로 들고 있는 것과 같은 결.
- 그 유저가 길드에 없으면 **404**, 있지만 자격이 없으면 **403**
  (봇이 채널을 못 찾을 때 404 를 쓰는 `POST /api/v1/ping` 과 같은 결).
- **넘기는 건 이 ID 까지다** — 이름·이메일 같은 개인정보는 헤더로도 로그로도 넘기지 않는다.

> **나중에:** Discord 로그인 연동과 StudyClub++ 계정 ↔ Discord 유저 ID 매핑은 추후 추가한다.
> 현재 [`ACCOUNT_IDENTITY`](../../erd/ACCOUNT_IDENTITY.md) 의 `ISSUER` 는 `GOOGLE` / `APPLE`
> 뿐이라, 그때까지 호출자는 이 헤더를 채울 수 없다.

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
curl -X POST http://localhost:4800/api/v1/ping \
  -H 'Content-Type: application/json' \
  -H "X-API-Key: $DISCORD_API_KEY" \
  -H 'X-Discord-User-ID: 327394882193883136' \
  -H 'Idempotency-Key: 9f1c2b3e-7a54-4d61-9c88-0f2b6d5e41aa'
```
