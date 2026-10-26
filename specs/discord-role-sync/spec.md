# 디스코드 → 웹 captain · navigator role 알림 Spec

> ERD: [ACCOUNT](../../docs/erd/ACCOUNT.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md)
> 관련 스펙: [discord-attendance](../discord-attendance/spec.md) — 같은 봇 전용 진입점(`X-API-Key`) · [admin-users](../admin-users/spec.md) — 캡틴 권한
> 봇 계약: [discord-development-guide/api/summary.md](../../docs/discord-development-guide/api/summary.md)
> 결정: [share 10-24 디스코드 스쿼드 합의](../../docs/share/2026-10-24-discord-squad-agreement.md) 결정 7 · 8, 물어볼 것 1 · 5
> 생성일: 2026-10-26
> 상태: 구현완료
> 작업: DSC-16 (봇 쪽 DSC-14 · DSC-15)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| POST | /api/discord/role-changes | 디스코드에서 captain · navigator role 이 바뀌었다 (한 건) | `X-API-Key` (봇) | 구현완료 |
| PUT | /api/discord/role-members | 지금 captain · navigator role 을 가진 사람 전체 (하루 한 번) | `X-API-Key` (봇) | 구현완료 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

## WHAT

권한의 기준(SSOT)은 웹이다 (10-24 결정 3). 그런데 디스코드에서 운영자가 captain · navigator role 을 손으로 붙이거나 뗄 수 있다.
봇이 그 변화를 웹에 알리고, 웹은 **자기 기준과 어긋나면 디스코드를 웹에 맞춘다** (물어볼 것 1 의 (가)). 받은 값으로 웹을 바꾸지 않는다 —
그러면 디스코드에서 role 만 붙여도 캡틴이 된다.

- 한 건 알림(`role-changes`)은 그 사람만 다시 본다. 하루 한 번 명단(`role-members`)은 놓친 알림을 메우는 안전망이다. 하루 늦게 맞는 것은 감수한다 (결정 8).
- **봇이 자기 API 로 바꾼 role 은 알리지 않는다** (준희 10-26). 그래야 백엔드가 되돌린 변경이 다시 알림으로 와서 핑퐁이 되지 않는다.
- 두 API 모두 받자마자 `204` 를 돌려주고, 맞추는 일은 뒤에서 한다. 봇이 기다릴 이유가 없다 — 응답에 결과를 싣지 않는 것도 같은 이유다 (준희 10-26: 디스코드가 그 결과로 할 일이 없다).

## 웹 기준 — 누가 그 role 을 가져야 하나

| role | 가져야 하는 사람 | 어긋나면 |
|---|---|---|
| navigator | 디스코드를 연동했고, 진행 중 스터디(`STUDY.STATUS` `OPEN` · `ONGOING`) 어디서든 명부가 `LEADER` · (`ACTIVE` · `PAUSED`) 인 계정 | 봇 navigator 창구로 붙이거나 뗀다 |
| captain | 디스코드를 연동한 `SYSTEM_ROLE = ADMIN` 계정 | **경고 로그만** 남긴다. 봇에 captain role 창구가 없다 (준희 10-26) |

- navigator 판정은 DSC-08 의 회수 조건(「다른 진행 중 스터디 어디에서도 활성 `LEADER` 가 아닐 때만 뗀다」)과 같은 식이다. 같은 조회(`StudyParticipantRepository.findNavigatorDiscordIds`)를 쓴다.
- 디스코드 ID 로 계정을 못 찾는 사람(미연동 · 회원 아님)은 「가져야 하지 않는 사람」이다.

### 처음에는 기록만 한다 — `DISCORD_ROLE_SYNC_ENFORCE`

디스코드 서버에는 웹보다 먼저 손으로 붙인 navigator role 이 있다. 웹 명부에 없는 지난 기수 네비게이터다.
켜자마자 맞추면 첫 명단에서 그 사람들의 role 이 한꺼번에 떨어진다. 그래서 **기본은 어긋남을 경고 로그로만 남기고** 디스코드를 바꾸지 않는다.
운영자가 로그로 어긋난 명단을 확인한 뒤 `DISCORD_ROLE_SYNC_ENFORCE=true` 로 켠다 (물어볼 것 1 의 「처음에는 (나)로 기록만 하다가 (가)로」).

---

## role 변경 알림

### 기본 정보

- **Method**: POST
- **Path**: `/api/discord/role-changes`
- **인증**: `X-API-Key` — 봇 전용 (`SecurityConfig` 의 discord 체인)
- **설명**: 디스코드에서 한 사람의 captain · navigator role 이 바뀌었다. 웹 기준과 그 사람을 다시 맞춘다

### Request Body

```json
{
  "discordUserId": "1327394882193880001",
  "role": "NAVIGATOR",
  "change": "ADDED",
  "occurredAt": "2026-10-26T01:00:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| discordUserId | String | Y | snowflake (`^[0-9]{17,20}$`) |
| role | String | Y | `CAPTAIN` \| `NAVIGATOR` |
| change | String | Y | `ADDED` \| `REMOVED`. 바뀐 뒤 상태다 — 웹 기준과 같으면 할 일이 없고, 다르면 웹 기준으로 되돌린다 |
| occurredAt | String (ISO-8601) | Y | 디스코드에서 바뀐 시각. 로그에만 쓴다 |

같은 알림이 두 번 와도 안전하다 — 웹 기준으로 다시 맞출 뿐이고, 봇 role 창구도 멱등이다.

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 필드 없음 · snowflake 아님 · `role` · `change` 값이 목록 밖 |
| 401 | UNAUTHORIZED | `X-API-Key` 없음 · 틀림 |

---

## role 명단

### 기본 정보

- **Method**: PUT
- **Path**: `/api/discord/role-members`
- **인증**: `X-API-Key` — 봇 전용
- **설명**: 지금 captain · navigator role 을 가진 사람 전체. 웹 기준과 양쪽으로 비교해 어긋난 사람을 맞춘다

### Request Body

```json
{
  "snapshotAt": "2026-10-26T00:00:00Z",
  "captains": ["1327394882193880001"],
  "navigators": ["1327394882193880002", "1327394882193880003"]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| snapshotAt | String (ISO-8601) | Y | 명단을 뽑은 시각. 로그에만 쓴다 |
| captains | String[] | Y | 지금 captain role 을 가진 사람. 빈 배열 가능. snowflake, 최대 10,000 |
| navigators | String[] | Y | 지금 navigator role 을 가진 사람. 빈 배열 가능. snowflake, 최대 10,000 |

- navigator: 명단에 있는데 웹 기준이 아니면 떼고, 웹 기준인데 명단에 없으면 붙인다. 봇 창구 한 번에 100명씩 나눠 부른다.
- captain: 양쪽 어긋남을 경고 로그로만 남긴다.

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 필드 없음 · snowflake 아님 · 10,000 명 넘음 |
| 401 | UNAUTHORIZED | `X-API-Key` 없음 · 틀림 |

---

## 백엔드가 봇을 부를 때

- `X-Discord-User-ID` 는 시스템 아이디(`DISCORD_BOT_ID`)다. 사람이 시킨 일이 아니다.
- navigator 창구의 `discordStudyId` 는 봇이 로그에만 쓰는 값이라, 특정 스터디가 아닌 이 일에는 **길드 ID(`DISCORD_GUILD_ID`)** 를 싣는다.
- 봇 설정 · `DISCORD_BOT_ID` · `DISCORD_GUILD_ID` 중 하나라도 없으면 맞추지 않고 경고 로그만 남긴다.
- 봇 navigator 창구는 DSC-13(#343)부터 시스템 아이디로 부를 수 있다.
- 실패는 던지지 않는다. 다음 날 명단이 다시 맞춘다.

## 미확정

- [NEEDS CLARIFICATION] captain 이 어긋날 때 alert 채널에 메시지까지 남길지 (준희 10-26: 「필요하면」). 지금은 로그만
- [NEEDS CLARIFICATION] `DISCORD_ROLE_SYNC_ENFORCE` 를 언제 켤지 — 지난 기수 네비게이터 role 을 어떻게 할지 운영과 정한 뒤
