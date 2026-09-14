# Get Study Channels

**스터디 카테고리 아래의 텍스트 채널 목록**을 돌려준다. 호출자가 [`send-message`](send-message.md) 로
메시지를 올릴 채널을 고를 때 쓰는 조회용이다. 아무것도 만들거나 바꾸지 않는다.

> ⚠️ **아직 구현 전이다.** 이 문서는 구현할 계약이다.
> 공통 요청 헤더는 [`common-header.md`](common-header.md) 를 따른다.
> **대상 길드는 하나로 고정**이라 요청에 길드를 넘기지 않는다.

## Table of Contents

- [요청](#요청)
  - [돌려주는 채널](#돌려주는-채널)
- [성공 응답](#성공-응답)
- [실패 응답](#실패-응답)
- [재시도](#재시도)
- [미정 사항](#미정-사항)

## 요청

```
GET /api/v1/studies/{discordStudyId}/channels
```

| 경로 변수 | 타입 | 설명 |
|-----------|------|------|
| `discordStudyId` | string | [`create-study`](create-study.md#성공-응답) 가 돌려준 **스터디 카테고리의 Discord 채널 ID**(snowflake) |

바디는 없다. 헤더는 `X-API-Key` 와 `X-Discord-User-ID` 다 — 조회라서 `Idempotency-Key` 와
`Content-Type` 은 붙이지 않는다 ([공통 헤더](common-header.md#idempotency-key)).

**captain 역할 또는 navigator 역할을 가진 멤버만 호출할 수 있다.** [`send-message`](send-message.md#요청) 와
같은 규칙이다 — 봇이 `X-Discord-User-ID` 로 길드 멤버를 조회해 둘 중 **하나라도** 갖고 있는지 확인하고,
둘 다 없으면 **403** 이다.

captain 역할과 navigator 역할은 둘 다 길드에 **이미 존재하는** 역할이다. 이 엔드포인트는 어느 것도 만들지 않고,
찾지 못하면 목록을 돌려주지 말고 실패한다. 둘 다 **설정값으로 ID 를 받는다**
(예: `DISCORD_CAPTAIN_ROLE_ID` · `DISCORD_NAVIGATOR_ROLE_ID`) — 이름으로 찾지 않는다.

`discordStudyId` 는 `^[0-9]{17,20}$` 로 검증한다.

### 돌려주는 채널

- **`discordStudyId` 카테고리 바로 아래의 텍스트 채널만** 돌려준다 (`category.text_channels`).
  음성 · 포럼 · 스테이지 채널은 빠진다 — `send-message` 가 [텍스트 채널에만 올리므로](send-message.md#이-엔드포인트에서-나는-것)
  목록에 있어도 쓸 수 없다.
- **봇에게 `View Channel` 권한이 없는 채널은 빠진다.** `send-message` 가 그 채널을 [찾지 못해 404](send-message.md#이-엔드포인트에서-나는-것)
  를 내므로, 목록에 올리면 고를 수는 있는데 보낼 수는 없는 채널이 된다.
- **순서는 Discord 사이드바 순서**(`position` 오름차순)다.

검증하지 **않는** 것:

- **그 카테고리가 정말 스터디 카테고리인지.** 어떤 카테고리가 스터디인지의 주인은 백엔드다 —
  백엔드가 보낸 `discordStudyId` 는 스터디 카테고리로 본다 ([send-message](send-message.md#discordstudyid-의-역할) 와 같은 결).
- **요청자가 그 스터디의 captain · navigator 인지.** 두 역할 모두 [길드 전체에 하나](assign-navigator-role.md#navigator-는-스터디별-역할이-아니다)라
  봇이 볼 수 있는 건 "역할이 있다" 까지다. 스터디 단위 권한 검사가 필요하면 백엔드가 호출 전에 한다.
- **요청자가 각 채널을 볼 수 있는지.** 채널마다 요청자 권한으로 거르지 않는다 — 기준은 위의 봇 권한 하나다.

## 성공 응답

**200 OK**

```jsonc
[
  { "discordChannelId": "1327394882193883137", "discordChannelName": "일반" },
  { "discordChannelId": "1327394882193883141", "discordChannelName": "자료실" }
]
```

| 필드 | 타입 | 설명 |
|------|------|------|
| `discordChannelId` | string | 텍스트 채널의 Discord 채널 ID (snowflake). `send-message` 의 경로 변수로 그대로 쓴다 |
| `discordChannelName` | string | Discord 에 보이는 채널 이름 그대로 |

**둘 다 문자열이다** — snowflake 는 64비트라 JSON 숫자로 내보내면 JS 호출자에서 정밀도가
깨진다 ([common-header.md](common-header.md#x-discord-user-id) 와 같은 규칙).

**텍스트 채널이 하나도 없으면 빈 배열 `[]` 과 200 이다.** 카테고리는 있으므로 404 가 아니다.

목록은 **요청 시점의 스냅샷**이다. 받은 뒤 길드에서 채널이 지워지거나 옮겨지면 그 ID 로 보낸 `send-message` 는
404 가 난다 — 호출자는 목록을 오래 캐시하지 않는다.

## 실패 응답

에러 바디는 현재 FastAPI 기본형 `{"detail": "..."}` 이다
(BE 의 `{errorCode, errorMessage}` 와 다르다 — [미정 사항](#미정-사항) 참고).
같은 상태 코드가 여러 원인에 쓰이므로 **`detail` 로 구분한다.**

### 공통 헤더에서 나는 것

| 상태 | 언제 |
|------|------|
| **400** | `X-Discord-User-ID` 가 없거나 snowflake 형식이 아님 — 이 엔드포인트는 역할 확인 때문에 필수다 |
| **401** | `X-API-Key` 없음 또는 불일치 |
| **403** | 요청자에게 captain 역할도 navigator 역할도 없음 |
| **404** | `X-Discord-User-ID` 가 그 길드의 멤버가 아님 |

`Idempotency-Key` 를 쓰지 않으므로 409 는 없다.

### 이 엔드포인트에서 나는 것

| 상태 | 언제 | 원인 |
|------|------|------|
| **400** | `discordStudyId` 가 snowflake 형식이 아님 | 요청자 잘못. 그대로 재시도해도 실패한다 |
| **400** | `discordStudyId` 가 카테고리가 아닌 채널의 ID 임 (텍스트 · 음성 채널 등) | 위와 같음. 텍스트 채널 ID 를 카테고리 ID 자리에 넣은 경우가 흔하다 |
| **404** | captain 역할 또는 navigator 역할을 길드에서 찾지 못함 | 서버·길드 설정 문제(역할이 지워졌거나 잘못 지정됨). 요청자와 무관하므로 403 이 아니다. **요청자가 다른 쪽 역할을 갖고 있어도 실패한다** — 설정이 깨진 채로 권한 검사를 반쪽만 하지 않는다 ([send-message](send-message.md#이-엔드포인트에서-나는-것) 와 같다) |
| **404** | `discordStudyId` 카테고리를 봇이 찾지 못함 | 스터디 카테고리가 지워졌거나 없는 ID, 또는 봇에게 그 카테고리의 `View Channel` 권한이 없음 |
| **502** | 멤버 조회 중 Discord 가 5xx 를 돌려줌 | 캐시에 없는 멤버를 API 로 가져오다 실패한 경우. 채널 목록 자체는 봇 캐시에서 읽는다 |
| **503** | 봇 비활성 또는 아직 미연결 | `DISCORD_TOKEN` 미설정, 또는 기동 직후 `is_ready()` 가 아직 False. 연결 전에는 캐시가 비어 있어 빈 목록을 성공으로 돌려줄 수 있으므로 반드시 막는다 |

503 · 502 는 **재시도 가능**하다. 400 · 401 · 403 은 조건이 바뀌기 전에는 재시도해도 같다.
멤버 404 는 그 유저가 길드에 들어오면 통한다. 카테고리 404 는 백엔드가 가진 ID 가 길드 상태와 어긋난 것이라
재시도로는 풀리지 않는다 — 백엔드 데이터나 길드 채널 구성을 고쳐야 한다.
역할 404 는 호출자가 고칠 수 없다 — 길드나 서버 설정을 고쳐야 풀린다.

> **429 는 밖으로 나가지 않는다.** discord.py 가 레이트 리밋을 내부에서 기다렸다가 재시도하므로,
> 증상은 429 응답이 아니라 **응답이 느려지는 것**으로 나타난다
> ([create-study](create-study.md#이-엔드포인트에서-나는-것) 와 같다).

## 재시도

상태를 바꾸지 않는 조회라 **몇 번을 다시 불러도 안전하다.** 타임아웃이나 502 · 503 뒤에는 그냥 다시 부른다 —
중복 실행이나 부분 적용을 걱정할 일이 없어서 `Idempotency-Key` 가 필요 없다.

## 미정 사항

정해야 이 계약이 확정되는 것들.

- **에러 바디 모양** — 여기는 FastAPI 의 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다.
  맞출지 말지는 별도 결정 사항.
