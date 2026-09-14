# API Summary

Discord 서비스(`discord/`, FastAPI) HTTP API 의 **엔드포인트 한눈에 보기**. 자세한 계약은 각 문서가 원본이고,
이 문서는 무엇이 있는지와 공통 규칙만 모은다.

> ⚠️ **전부 아직 구현 전이다.** 아래는 구현할 계약의 요약이다.
> **대상 길드는 하나로 고정**이라 어떤 요청에도 길드를 넘기지 않는다.

## Table of Contents

- [엔드포인트 목록](#엔드포인트-목록)
- [공통 규칙](#공통-규칙)
- [스터디](#스터디)
- [역할](#역할)
- [메시지](#메시지)
- [경로 충돌](#경로-충돌)
- [공통 미정 사항](#공통-미정-사항)

## 엔드포인트 목록

| 메서드 | 경로 | 문서 | 호출 권한 | 성공 |
|--------|------|------|-----------|------|
| `POST` | `/api/v1/studies` | [create-study](create-study.md) | captain | 201 + `{discordStudyId, discordRoleId}` |
| `GET` | `/api/v1/studies/{discordStudyId}/channels` | [get-study-channels](get-study-channels.md) | captain · navigator | 200 + 채널 배열 |
| `POST` | `/api/v1/roles/{discordRoleId}/users` | [assign-role](assign-role.md) | captain | 204 |
| `DELETE` | `/api/v1/roles/{discordRoleId}/users/{discordUserId}?discordStudyId=` | [remove-role](remove-role.md) | captain | 204 |
| `POST` | `/api/v1/roles/navigator/users` | [assign-navigator-role](assign-navigator-role.md) | captain | 204 |
| `DELETE` | `/api/v1/roles/navigator/users/{discordUserId}?discordStudyId=` | [remove-navigator-role](remove-navigator-role.md) | captain | 204 |
| `POST` | `/api/v1/channels/{discordChannelId}/msg` | [send-message](send-message.md) | captain · navigator | 204 |
| `POST` | `/api/v1/channels/alert/msg` | [send-alert-message](send-alert-message.md) | captain · navigator | 204 |
| `POST` | `/api/v1/channels/announcement/msg` | [send-announcement-message](send-announcement-message.md) | captain | 204 |

## 공통 규칙

전 엔드포인트에 걸리는 것들. 헤더 규약의 원본은 [common-header.md](common-header.md) 다.

**헤더**

| 헤더 | 언제 | 없거나 틀리면 |
|------|------|---------------|
| `Content-Type: application/json` | 바디가 있을 때만 | — |
| `X-API-Key` | 항상 — 서비스 간 인증 | 401 (경로가 없어도 401 우선) |
| `X-Discord-User-ID` | 역할 확인이 필요한 요청 — **현재 모든 엔드포인트** | 400, 길드 멤버 아님 404, 자격 없음 403 |
| `Idempotency-Key` | 상태를 바꾸는 요청 (`GET` 제외 전부) | 같은 키에 다른 요청이면 409 |

**ID 와 설정**

- snowflake 는 경계에서 **항상 문자열**이고 `^[0-9]{17,20}$` 로 검증한다 (JS 정밀도 문제).
- 이름에 `discord` 가 붙은 ID 는 StudyClub++ 가 아니라 **Discord 쪽 ID** 다.
- captain · navigator 역할, alert · announcement 채널은 길드에 **이미 있는** 것이고, 모두 **설정값으로 ID 를 받는다**
  (`DISCORD_CAPTAIN_ROLE_ID` · `DISCORD_NAVIGATOR_ROLE_ID` · `DISCORD_ALERT_CHANNEL_ID` · `DISCORD_ANNOUNCEMENT_CHANNEL_ID`).
  이름으로 찾지 않고, 못 찾으면 만들지 않고 404 로 실패한다 — 호출자가 고칠 수 없는 **서버·길드 설정 문제**다.
- captain · navigator 역할은 **길드 전체에 하나**다. 봇은 "역할이 있다" 까지만 보고, 스터디 단위 권한
  (그 스터디의 captain 인지, 대상이 그 스터디 멤버인지)은 **백엔드가 호출 전에** 확인한다.

**에러와 재시도**

| 상태 | 뜻 | 재시도 |
|------|----|--------|
| 400 | 요청 형식·값 잘못 | 소용없음 |
| 401 / 403 | 인증 실패 / 역할 없음 | 조건이 바뀌기 전엔 소용없음 |
| 404 | 요청자·대상 멤버, 역할, 채널 없음 — `detail` 로 구분 | 원인에 따라 다름 |
| 409 | 멱등 키 충돌, 또는 서버 설정 누락 — `detail` 로 구분 | 소용없음 |
| 502 | Discord 가 거부 (권한 부족, 역할 서열, Discord 5xx) | 5xx 는 가능, 권한·서열은 설정을 고쳐야 함 |
| 503 | 봇 비활성 또는 아직 미연결 | 가능 |

- 에러 바디는 FastAPI 기본형 `{"detail": "..."}` 이다.
- **429 는 밖으로 나가지 않는다** — discord.py 가 내부에서 기다리므로 응답이 느려질 뿐이다. 호출자는 타임아웃을 넉넉히 잡는다.
- **먼저 다 확인하고, 그 다음에 실행한다** — 검증에서 걸리면 Discord 에 아무것도 보내지 않는다.
- **`Idempotency-Key` 는 성공했을 때만 저장한다.** 실패한 요청은 같은 키로 다시 오면 다시 실행한다.
  응답을 못 받은 호출자는 **같은 키로** 재시도한다.

## 스터디

### [create-study](create-study.md) — `POST /api/v1/studies`

- `{ "studyName": "..." }` (1–100자) 로 **카테고리 + 텍스트 채널 + 음성 채널 + 전용 역할**을 한 번에 만든다.
- 응답 `discordStudyId`(카테고리 ID) · `discordRoleId`(역할 ID) 쌍을 백엔드가 저장해 이후 요청에 그대로 쓴다.
- 같은 이름의 스터디 카테고리가 있으면 409.
- 네 단계 중 하나라도 실패하면 **만든 것을 역순으로 지운다.** 롤백까지 실패하면 502 + 남은 ID 를 로그에 남긴다.

### [get-study-channels](get-study-channels.md) — `GET /api/v1/studies/{discordStudyId}/channels`

- 스터디 카테고리 **바로 아래의 텍스트 채널** 목록 `[{discordChannelId, discordChannelName}]` 을 사이드바 순서로 돌려준다.
  `send-message` 에 쓸 채널을 고르는 용도다.
- 봇이 볼 수 없는 채널과 텍스트가 아닌 채널은 빠진다. 채널이 없으면 `[]` + 200.
- 조회라 `Idempotency-Key` 없음, 409 없음. 몇 번이고 다시 불러도 안전하다.

## 역할

네 엔드포인트 모두 **captain 만** 호출한다. `discordStudyId` 는 **로그용**이고 봇은 그 값으로 아무것도 검증하지 않는다.

| | 붙이기 | 떼기 |
|------|--------|------|
| 아무 역할 | [assign-role](assign-role.md) | [remove-role](remove-role.md) |
| navigator 고정 | [assign-navigator-role](assign-navigator-role.md) | [remove-navigator-role](remove-navigator-role.md) |
| 대상 | 바디의 `discordUserIds` 배열 (여러 명) | 경로의 `discordUserId` (한 명) |
| 길드에 없는 대상 유저 | **404**, 아무도 건드리지 않음 | **204** (이미 원하는 상태) |
| 역할이 없음 | 404 | 404 |
| 도중 실패 | 되돌리지 않고 502 — 같은 요청을 그대로 재시도 | 요청당 Discord 호출 1번이라 부분 실패 없음 |
| 여러 명 | 한 요청에 배열 | 호출자가 유저 수만큼 호출, **유저마다 다른 `Idempotency-Key`** |

- 붙이기·떼기 모두 **멱등**이다. 204 는 "지금 그 상태다" 라는 뜻이고, 이번에 바뀌었는지는 구분하지 않는다.
- `discordRoleId` 는 제한하지 않는다 — 올바른 스터디↔역할 쌍을 보내는 건 백엔드 책임이다.
- **navigator 역할은 길드 전체에 하나라**, 스터디 A 때문에 떼면 스터디 B 의 navigator 권한도 사라진다.
  백엔드는 유저가 **남은 어떤 스터디에서도 navigator 가 아닐 때만** `remove-navigator-role` 을 부른다.
- 봇 역할이 대상 역할보다 아래면 **역할 서열** 때문에 502 다. 재시도로 안 풀리고 길드에서 봇 역할을 올려야 한다
  (navigator 고정 엔드포인트는 이 경우 **모든 요청이** 실패한다).
- `discordUserIds` 상한은 미정 (100 정도 제안).

## 메시지

세 엔드포인트 모두 바디는 `msg` 를 받고, 성공은 **204** (메시지 ID 는 돌려주지 않음)다.
메시지 전송은 멱등이 아니라 **중복 전송**을 `Idempotency-Key` 로 막는다.

| | [send-message](send-message.md) | [send-alert-message](send-alert-message.md) | [send-announcement-message](send-announcement-message.md) |
|------|------|------|------|
| 채널 | 경로로 호출자가 고름 | alert 채널 고정 | announcement 채널 고정 |
| 용도 | 스터디 채널 안내 | captain 이 조치할 운영 알림 | 길드 전체 공지 |
| 호출 권한 | captain · navigator | captain · navigator | captain |
| 추가 바디 | `discordStudyId`, `discordUserIds` (최대 40명, 빈 배열 허용) | — | — |
| 맨 위에 붙는 줄 | `발신: <@요청자>` + 멘션 줄 | `발신: <@요청자>` | `@everyone` |
| 알림이 울리는 대상 | `discordUserIds` 의 유저만 | 없음 | `@everyone` |
| `msg` 상한 | 전체 2000자 이내 | 1900자 | 1990자 |

- 세 곳 모두 `msg` 안의 `@everyone` · `@here` 를 **남지 않을 때까지 지우고**, 지운 뒤 비면 400 이다. 길이는 **가공 전** 값으로 재고, 잘라서 보내지 않는다.
- 본문에는 **ID 까지만** 넣는다 — 닉네임 같은 개인정보는 풀어 쓰지 않는다.
- **send-message** 는 채널이 `discordStudyId` 카테고리 **바로 아래인지** 확인한다 (아니면 404). navigator 가
  스터디와 무관한 채널에 메시지를 뿌리지 못하게 막는 장치다. 길드에 없는 멘션 대상이 있으면 404 로 보내지 않는다.
- **alert · announcement** 는 채널 ID 설정이 없으면 409, 채널을 못 찾으면 404 다. 봇에게 `Send Messages` 권한이 없으면 **모든 요청이** 502 다.
- **announcement** 에서 봇에게 `Mention Everyone` 권한이 없으면 공지는 알림 없이 올리고 **204** 를 돌려준 뒤,
  alert 채널에 권한 문제를 따로 알린다 (그 알림이 실패해도 204).
- 키 저장 직전에 서비스가 죽으면 한 번 더 보내질 수 있다 — 드문 중복은 받아들이고 captain 이 직접 지운다.

## 경로 충돌

고정 경로와 동적 경로가 모양이 겹친다.

- `/roles/navigator/users[/{id}]` ↔ `/roles/{discordRoleId}/users[/{id}]`
- `/channels/alert/msg` · `/channels/announcement/msg` ↔ `/channels/{discordChannelId}/msg`

FastAPI 는 등록 순서대로 매칭하므로 **고정 경로를 먼저 등록**하고, 테스트로 순서를 고정한다.
순서가 뒤집히면 `navigator` · `alert` · `announcement` 가 snowflake 로 잡혀 400 이 난다.

## 공통 미정 사항

- **에러 바디 모양** — 여기는 `{"detail": ...}`, 백엔드는 `{errorCode, errorMessage}` 다. 맞출지 결정 필요.
- **Discord 유저 ID 매핑** — 현재 `ACCOUNT_IDENTITY` 는 `GOOGLE` / `APPLE` 뿐이라, 연동 전까지 호출자가
  `X-Discord-User-ID` 를 채울 수 없다.
- 엔드포인트별 미정 사항 (create-study 의 기본 채널 이름, 역할 배정 상한, 발신자 줄 문구, 공지 crosspost 등)은 각 문서에 있다.
