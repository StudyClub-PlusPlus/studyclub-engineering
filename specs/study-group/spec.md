# 분반 · 참여 명단 (백오피스) API Spec

> ERD: [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_APPLICATION](../../docs/erd/STUDY_APPLICATION.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md) · [POL-0006 시간대와 지역](../../01-planning/_registry/policies/POL-0006-timezone.md)
> 생성일: 2026-10-06
> 갱신: 2026-10-23 — 참여 명단 `groups[].isDefault` 추가 (기본 반 칩을 서버 판정으로)
> 갱신: 2026-10-21 — 한 사람씩 바꾸던 `PATCH …/{participantId}/role` · `…/group` 을 일괄 `PATCH …/participants` 하나로 합쳤다
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 개별 스터디의 참석자를 볼 수 있다.](../../01-planning/stories/captain-view-attendees/PRD.md)
> - [캡틴은 스터디 신청자를 보고 반을 결정할 수 있다.](../../01-planning/stories/captain-assign-classes/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/studies/{studyId}/participants | 참여 명단 (반 · 담당) | O (ADMIN) | 구현완료 |
| PATCH | /api/admin/studies/{studyId}/participants | 반 지정 · 이동 + 네비게이터 지정 · 해제를 한 번에 (신청자 탭 「저장」) | O (ADMIN) | 구현완료 |
| POST | /api/admin/studies/{studyId}/groups | 반 만들기 (제목만. 회차 없음) | O (ADMIN) | 구현완료 |
| PATCH | /api/admin/studies/{studyId}/groups/{groupId} | 반 제목 · 스터디 시간(요일 · 시각 · 시간대) 수정. 회차는 만들지 않는다 | O (ADMIN) | 구현중 (제목만 구현완료. 스터디 시간은 아직) |
| DELETE | /api/admin/studies/{studyId}/groups/{groupId} | 반 삭제 (빈 반만) | O (ADMIN) | 구현완료 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

모두 `@RequireAdmin`. 반 편성 · 역할(네비게이터) 지정은 네비게이터가 하지 못한다 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)).

---

## 참여 명단

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/studies/{studyId}/participants`
- **인증**: 필요 — ADMIN
- **설명**: 그 스터디의 명부 전체. 반 · 담당(네비게이터)을 함께 준다. 캡틴도 신청했으면 크루와 같은 행으로 들어 있다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 기본 | 설명 |
|------|------|------|------|------|
| includeLeft | Boolean | N | false | true 면 `WITHDRAWN` 행도 준다. `DELETED`(탈퇴) 행은 늘 뺀다 |

### Response — 200

```json
{
  "studyId": 3,
  "participantCount": 18,
  "recruitmentCapacity": 20,
  "groups": [{ "groupId": 7, "name": "A반", "isDefault": true, "canDelete": false }],
  "participants": [
    {
      "participantId": 41,
      "accountId": 12,
      "nickname": "jamie",
      "discordNickname": "제이미/BE/서울/분산시스템",
      "email": "jamie@example.com",
      "regionGroup": "KR",
      "groupId": 7,
      "participantRole": "LEADER",
      "status": "ACTIVE",
      "captain": false,
      "joinedAt": "2026-09-01T00:00:00Z"
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| participantCount | Int | N | `ACTIVE` · `PAUSED` 행 수. 신청한 담당 캡틴도 크루와 같이 센다 | 계산 |
| recruitmentCapacity | Int | Y | 정원. null 이면 제한 없음 | 최신 STUDY_RECRUITMENT.RECRUITMENT_CAPACITY |
| groups[] | Array | N | 그 스터디의 분반. 만든 순서(`ID` 오름차순) | STUDY_GROUP |
| groups[].isDefault | Boolean | N | 기본 반(그 스터디에서 처음 만든 반)이면 true — 「기본」 칩. 「반 삭제」의 `DEFAULT_GROUP_NOT_DELETABLE` 과 같은 판정 | 계산 |
| groups[].canDelete | Boolean | N | 이 반을 지울 수 있으면 true — 신청자 탭 「삭제」 버튼. `includeLeft` 와 상관없이 `DELETED` 밖의 명부 행(`ACTIVE` · `PAUSED` · `COMPLETED` · `WITHDRAWN`)도, 탈퇴 회원 밖의 출석 행도 하나도 없을 때만 true. 기본 반은 늘 false. 「반 삭제」 API 와 같은 판정 | 계산 |
| participants[].participantId | Long | N | | STUDY_PARTICIPANT.ID |
| participants[].nickname · email | String | N | 이메일은 이 백오피스 응답에만 | ACCOUNT |
| participants[].discordNickname | String | Y | 디스코드 서버 별명. 신청 때 받은 값으로 갱신된다. 없으면 null — 화면 「—」 | ACCOUNT.DISCORD_NICKNAME |
| participants[].regionGroup | String | Y | `KR` · `NA` · `ETC` | ACCOUNT.REGION_GROUP |
| participants[].groupId | Long | N | 반. 신청 직후에는 기본 반 (2026-10-20) | STUDY_PARTICIPANT.STUDY_GROUP_ID |
| participants[].participantRole | String | N | `LEADER` = 네비게이터 · `MEMBER` | STUDY_PARTICIPANT.PARTICIPANT_ROLE |
| participants[].captain | Boolean | N | 이 행이 담당 캡틴이면 true — 「캡틴」 칩. 담당 캡틴은 신청했을 때만 행이 있다 | 계산: `STUDY.CREATED_BY = ACCOUNT_ID` |
| participants[].status | String | N | `ACTIVE` · `PAUSED` · `WITHDRAWN` | STUDY_PARTICIPANT.STATUS |

정렬: 네비게이터 → 반 이름 → 닉네임.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 토큰 없음 |
| 403 | FORBIDDEN | ADMIN 아님 |
| 404 | NOT_FOUND | 없는 스터디 |

---

## 반 · 역할 한 번에 바꾸기

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/participants`
- **인증**: 필요 — ADMIN
- **설명**: 신청자 탭의 「저장」. 고른 크루들의 반 지정 · 이동과 네비게이터 지정 · 해제를 **한 번에** 반영한다. 한 줄이라도 거절되면 아무것도 바뀌지 않는다 (2026-10-21 — [share](../../docs/share/2026-10-21-participant-bulk-change.md)).
  화면이 여러 명을 고쳐 모았다가 한 번에 저장하므로 API 도 한 번이다 — 한 사람씩 부르면 중간에 실패했을 때 「어중간한 편성」이 남는다 ([PRD 3-5](../../01-planning/stories/captain-view-attendees/PRD.md)). 출석부 저장(`updates[]` · `withdrawals[]`)과 같은 방식이다.

### Request Body

```json
{
  "changes": [
    { "participantId": 41, "groupId": 7, "participantRole": "LEADER" },
    { "participantId": 42, "groupId": 7 },
    { "participantId": 43, "participantRole": "MEMBER" }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| changes[] | Array | Y | 바뀐 줄만. 1개 이상. 같은 `participantId` 가 두 번 나오면 400 |
| changes[].participantId | Long | Y | 그 스터디의 명부 행 |
| changes[].groupId | Long | N | 옮길 반. 같은 스터디의 분반. 없으면 반은 그대로 |
| changes[].participantRole | String | N | `LEADER` = 네비게이터 · `MEMBER`. 없으면 역할은 그대로 (부반장 `CO_LEADER` 는 2026-10-09 에 없앴다 — [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)) |

한 줄에 `groupId` · `participantRole` 중 하나는 있어야 한다 — 둘 다 없으면 400.

### 서버 동작

1. 요청 전체를 먼저 검사한다. 하나라도 걸리면 그 오류로 끝내고 아무것도 쓰지 않는다
2. 활성 행(`ACTIVE` · `PAUSED`)만 바꾼다. 아니면 409 `PARTICIPANT_NOT_ACTIVE`
3. 한 줄 안에서는 **반을 먼저 바꾸고 역할을 본다** — 「B반으로 옮기며 네비게이터로」를 한 줄로 보낼 수 있다
4. 바뀐 뒤 반이 없는(`groupId` null) 행을 `LEADER` 로 만들지 않는다 — 400. 네비게이터는 그 반을 맡는 사람이다 (출석 · 일정 권한도 반 단위로 판정한다)
5. 반 이동 — 신청자는 기본 반에 들어와 있다. 반을 나누면 이 요청으로 옮긴다. 아래는 전체 요청과 **같은 트랜잭션**이다
   1. **잠근다 — 이 요청에 걸린 반(옛 반 · 새 반 모두) id 오름차순으로, 반 행 다음 그 반의 회차 행** (`StudyGroupRepository.findByIdForUpdate` → `StudyMeetingRepository.findByStudyGroupIdForUpdate`)
      - 반 행: 회차 추가·수정·삭제도 반 행을 잠근다([회차 스펙 「잠금」](../study-meeting/spec.md#잠금)). 옮기는 동안 반에 회차가 새로 생기거나 지워지지 않는다
      - 회차 행: 디스코드 출석이 같은 잠금으로 회차를 자동 시작한다. 잠근 뒤에 「예정 회차」를 판정해야 판정 직후 회차가 시작되는 일이 없다
      - 순서를 반 id 오름차순으로 고정한다 — 디스코드 출석도 반 id 오름차순으로 회차를 잠근다. 순서가 다르면 서로를 기다리며 멈춘다
     - 구현: 참여 중단과 같은 「분반 → 명부 행 → 회차」 순서다 — 트랜잭션의 첫 조회로 이 스터디의 분반을 모두 id 오름차순으로 잠그고(`findByStudyIdForUpdate`), 대상 명부 행을 잠가 최신 상태로 읽은 뒤(`findByIdInAndStudyIdForUpdate`) 1~4 를 검증하고, 옛 반 · 새 반의 회차를 잠근다. 그래야 검증과 이동 사이에 참여 중단이 끼어들지 못한다 ([share 10-18 D7](../../docs/share/2026-10-18-schedule-attendance-feedback.md))
   2. **옛 반의 예정 회차 출석 행을 지운다** — 상태(`ABSENT`·`EXCUSED` 등)와 상관없이
      - 예정 회차 = 잠금을 얻은 **뒤** 시각으로 아직 시작하지 않은 회차 (`START_AT IS NULL AND SCHEDULED_AT > now()`). 회차 목록의 `started = false` 와 같은 기준이다
      - 이유: 그 사람은 이제 그 회차에 오지 않는다. 남겨 두면 옛 반 출석 집계(대시보드)에 그 사람이 결석으로 섞이고, 화면 명단에는 없는 사람의 행이 된다
      - 사전 휴가(`EXCUSED`)도 지운다 — 휴가는 그 회차에 붙은 것이라, 오지 않을 회차의 휴가는 뜻이 없다
   3. **옛 반의 지난 회차(시작한 회차) 출석은 그대로 둔다.** 이미 일어난 사실이다
   4. 옛 반에서 맡은 **예정** 회차의 발표자 칸은 비운다 — [회차 스펙](../study-meeting/spec.md)
   5. 명부 행의 반을 바꾼다 (`STUDY_PARTICIPANT.STUDY_GROUP_ID = groupId`). `STUDY_ID` · `JOINED_AT` 은 그대로
   6. **새 반의 예정 회차마다 출석 행을 `ABSENT` 로 만든다** — 회차 생성 규칙과 같다. 이미 행이 있으면(그 반에 있다가 나갔다 돌아온 경우) 건드리지 않는다 (`UNIQUE(STUDY_MEETING_ID, ACCOUNT_ID)`)
   7. 새 반의 지난 회차에는 출석 행을 만들지 않는다 — 그때 그 반에 없었다

   > 비유: 학원에서 반을 옮기면 **지난 수업 출석부**는 옛 반에 그대로 남고, **다음 수업부터** 새 반 출석부에 이름이 올라간다. 옛 반 출석부의 앞으로 칸은 지운다.
6. 지금 값과 같은 필드는 건너뛴다 — 같은 값만 보낸 줄도 200
7. 역할이 실제로 바뀐 줄마다 [ADMIN_AUDIT_LOG](../../docs/erd/ADMIN_AUDIT_LOG.md) 한 줄(`ACTION = PARTICIPANT_ROLE` · `BEFORE` = 변경 전 역할 · `AFTER` = 명부 행 ID)을 같은 트랜잭션에 남기고, `study_participant.role_changed` 를 발행한다 (`previousRole` · `newRole`). 반만 바뀐 줄은 발행하지 않는다. 구독자(디스코드 네비게이터 role, DSC-08)는 커밋 뒤에 받는다 — 페이로드는 [domain-events](../domain-events/spec.md) 에 COM-01 로 올린다

### Response — 200

바뀐 줄의 결과. 화면은 이 값으로 명단을 다시 그린다 (또는 명단을 다시 받는다).

```json
{
  "participants": [
    { "participantId": 41, "groupId": 7, "participantRole": "LEADER" },
    { "participantId": 42, "groupId": 7, "participantRole": "MEMBER" },
    { "participantId": 43, "groupId": 8, "participantRole": "MEMBER" }
  ]
}
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `changes` 비었음 · 같은 행 두 번 · 한 줄에 바꿀 값 없음 · 역할 값 목록 밖 · 다른 스터디의 반 · 반 없는 행을 `LEADER` 로 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 그 스터디의 명부 행이 아님 · 없는 반 |
| 409 | PARTICIPANT_NOT_ACTIVE | 하차 · 탈퇴 · 완주한 행 |

`errorMessage` 에는 걸린 `participantId` 를 적는다 — 화면이 그 줄을 짚어 준다.

---

## 반 만들기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/studies/{studyId}/groups`
- **인증**: 필요 — ADMIN
- **설명**: 제목만 받아 분반을 만든다. **회차는 만들지 않는다** — 스터디 시간은 아래 「반 이름 · 스터디 시간」으로 따로 정하고, 회차는 회차 추가로 만든다 (→ [share 10-14](../../docs/share/2026-10-14-class-title-and-captain-applies.md)).

### Request Body

```json
{ "name": "A반" }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | Y | 반 제목. 앞뒤 공백을 자르고 1~20자(코드포인트 기준). 같은 스터디에 같은 이름(대소문자 무시)의 반이 있으면 409 |

### 서버 동작

- `START_AT` · `TIMEZONE` · 시작일 · 종료일 · 요일은 비운다
- 이름 중복은 `UNIQUE(STUDY_ID, NAME)` 가 막는다. 운영 DB 정렬(`utf8mb4_unicode_ci`)이 대소문자를 가리지 않아 `A반` 과 `a반` 도 같은 이름이다 — 서버도 대소문자를 무시하고 먼저 확인한다. 확인과 저장 사이에 같은 이름이 먼저 들어오면 제약 위반을 409 로 바꾼다
- 회차 · 출석 행은 만들지 않는다

### Response — 201

```json
{ "groupId": 7, "name": "A반" }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `name` 누락 · 공백뿐 · 20자 초과 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 |
| 409 | CONFLICT | 이 스터디에 같은 이름의 반이 있음 — 화면은 `errorMessage` 를 입력칸 아래에 적는다 |

---

## 반 이름 · 스터디 시간

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/groups/{groupId}`
- **인증**: 필요 — ADMIN
- **설명**: 반 제목(신청자 탭 「수정」)이나 스터디 시간(일정 탭 「스터디 시간 정하기 · 수정」)을 바꾼다. 보낸 필드만 바꾼다. **회차는 만들지도 바꾸지도 않는다** (→ [share 10-14](../../docs/share/2026-10-14-class-title-and-captain-applies.md))

### Request Body

```json
{
  "name": "A반",
  "daysOfWeek": ["thu"],
  "startTime": "20:00",
  "timezone": "Asia/Seoul"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | N | 반 제목. 앞뒤 공백을 자르고 1~20자(코드포인트 기준) |
| daysOfWeek | String[] | N | `mon` ~ `sun`, 1개 이상 |
| startTime | String (HH:mm, 분반 현지) | N | |
| timezone | String (IANA) | N | [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) 의 값 |

기간(시작일 · 종료일)은 받지 않는다. 반의 기간은 저장하지 않고 첫 회차 ~ 마지막 회차로 계산한다.

> **구현 범위 (1차)**: 지금은 `name` 만 받고 응답도 `{ "groupId", "name" }` 이다. `daysOfWeek` · `startTime` · `timezone` 은 `DAYS_OF_WEEK` 마이그레이션(「데이터 변경」) 뒤에 붙인다.

### 서버 동작

- 보낸 필드만 `NAME` · `DAYS_OF_WEEK` · `START_AT` · `TIMEZONE` 에 쓴다
- 이름 중복 규칙은 「반 만들기」와 같다 — 같은 스터디의 다른 반과 이름(대소문자 무시)이 겹치면 409 `CONFLICT`. 지금 이름 그대로 보내면 통과
- 회차 · 출석은 건드리지 않는다. 회차는 [회차 스펙](../study-meeting/spec.md)의 추가 · 수정 · 삭제로만 바뀐다
- 이미 있는 회차의 시각은 따라 바뀌지 않는다 — 회차마다 `SCHEDULED_AT` 을 갖는다

### Response — 200

```json
{ "groupId": 7, "name": "A반", "daysOfWeek": ["thu"], "startTime": "20:00", "timezone": "Asia/Seoul" }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 빈 바디 · 이름 길이 밖 · 요일 0개 · 요일 키 밖 · 시각 형식 밖 · 시간대 밖 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 반 |
| 409 | CONFLICT | 이 스터디의 다른 반과 이름이 같음 |

### 킥오프

반 만들기도, 회차 추가도 킥오프를 만들지 않는다. **캡틴이 백오피스 일정 탭에서 「킥오프 정하기」로 정한다** — `PUT /api/admin/studies/{studyId}/groups/{groupId}/kickoff`, [회차 스펙 「킥오프 정하기」](../study-meeting/spec.md#킥오프-정하기-백오피스) (2026-10-22, [share](../../docs/share/2026-10-22-kickoff-by-captain.md)).

---

## 반 삭제

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/admin/studies/{studyId}/groups/{groupId}`
- **인증**: 필요 — ADMIN

### 서버 동작

- 기본 반(그 스터디에서 처음 만든 반)은 명부가 비어 있어도 409 `DEFAULT_GROUP_NOT_DELETABLE` — 신청자가 들어가는 반이다 (2026-10-20)
- `ACTIVE` · `PAUSED` · `COMPLETED` · `WITHDRAWN` 명부 행이 하나라도 있으면 409 `GROUP_NOT_EMPTY` — 수료 · 참여 중단 크루가 어느 반이었는지 기록이 끊기지 않게 지우지 않는다. 참여 중단 크루의 반은 출석률(`LEFT_AT` 까지의 회차) 계산에도 쓰인다
- 그 반 회차에 출석 행이 하나라도 있으면 409 `GROUP_NOT_EMPTY` — 반을 지우려고 출석 기록을 지우지 않는다. 다른 반으로 옮긴 크루의 지난 출석은 옛 반에 남아 있어(「반 · 역할 한 번에 바꾸기」 서버 동작 5), 명부가 비어도 출석 기록은 남을 수 있다. 회원 탈퇴(그 스터디 명부 행이 `DELETED`)한 사람의 출석 행은 세지 않는다 (2026-10-21)
- 회원 탈퇴로 남은 `DELETED` 행만 있고 위 출석 행도 없으면 지울 수 있다
- 지우면 그 반의 회차와, 탈퇴 회원의 출석 행만 함께 지운다

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 반 |
| 409 | DEFAULT_GROUP_NOT_DELETABLE | 기본 반 (명부가 비어 있어도) |
| 409 | GROUP_NOT_EMPTY | `ACTIVE` · `PAUSED` · `COMPLETED` · `WITHDRAWN` 크루가 있음, 또는 탈퇴 회원 밖의 출석 기록이 남아 있음 |

---

## 데이터 변경 (필요)

- `STUDY_GROUP` 에 `DAYS_OF_WEEK` (VARCHAR, NULL 허용) 추가 — 스터디 시간 수정 창과 「회차 추가」 기본 요일이 읽는다. 시작일 · 종료일 컬럼은 두지 않는다(기간은 회차에서 계산)
- `ErrorCode` 에 `PARTICIPANT_NOT_ACTIVE(409)` · `GROUP_NOT_EMPTY(409)` 추가

## 프론트엔드 사용처

- back-office-front 스터디 상세 · `/studies/{id}/applicants` — `features/participants/ParticipantsTab.tsx`: 명단 · 반 생성/제목 수정/삭제 · 개별/일괄 반 · 역할(크루 · 네비게이터) 변경 후 한 번에 저장 — 한 줄에 `groupId` · `participantRole` 중 바뀐 것만 싣는다. 참여 명단 GET · 일괄 PATCH는 위 계약에 연결했으며 BE 구현 후 실제 연동 검증이 필요하다.
- back-office-front 일정 탭 — 스터디 시간 정하기 · 수정은 화면은 있고 브라우저 저장소에 남는다. 이 API 가 시간 칸을 받으면 붙인다
- 역할 변경 프로토: playground `console/studies/{id}` 신청자 탭

## 퍼널·계측

해당 없음 — 백오피스 분반 · 명단 관리라 트래킹 플랜 대상 밖이다.

## 미확정

- 보류(MVP 이후): 신청자 가능 시간 집계(`GET …/availability`) — 신청 폼의 가능한 시간 질문이 필수가 아니라 2026-10-14 에 화면과 함께 뺐다
- ~~한 사람씩 바꾸는 `PATCH …/{participantId}/role` · `…/group`~~ → 일괄 `PATCH …/participants` 로 합쳤다. 화면이 「저장」으로 한 번에 반영하는데 API 가 한 사람씩이면 중간 실패 때 일부만 바뀐다 (2026-10-21)
- ~~신청자를 명부(`STUDY_PARTICIPANT`)에 넣는 시점~~ → **신청 제출 때, 기본 반으로**. 기본 반은 스터디를 만들 때 생기는 첫 반(「기본반」)이고 지울 수 없다. 다른 반으로는 「반 · 역할 한 번에 바꾸기」(`PATCH …/participants`)로 옮긴다 (2026-10-20, → [share 10-18](../../docs/share/2026-10-18-roster-on-apply.md))
- ~~반 일정을 바꿀 때 지워지는 회차에 걸린 휴가 신청 처리~~ → 스터디 시간 수정이 회차를 지우지 않아 없어졌다 (2026-10-14)
- [NEEDS CLARIFICATION · 기획 미정] **스터디 시작 뒤 반 이동** — 시작 뒤에도 반을 옮길 수 있다(2026-10-20 확인). 그런데 출석률 계산기(`AttendanceRateCalculator`)는 **지금 반의 회차**만 본다. 그래서 옮기면 (1) 옛 반 지난 출석은 남지만 출석률에서 빠지고, (2) 새 반의 지난 회차는 `JOINED_AT` 이후면 출석 행 없이 분모에 들어가 결석처럼 센다. 「옮긴 시각」을 기록해 반별로 나눠 셀지 등 기획이 필요하다. 위 「서버 동작」의 지난 출석 · 예정 출석 처리는 이 결정과 별개로 유지한다
- [NEEDS CLARIFICATION · 기획 미정] **다른 반 출석** — A반 참여자가 B반 회차에 나와 출석할 수 있다(2026-10-20 확인). 어느 반 회차에 어떤 상태로 기록하고 출석률에 어떻게 셀지 정해지지 않았다. 지금 임시 규칙: 대시보드는 다른 반 참석을 **소속 반 회차의 `EXCUSED`** 로 인정한다([대시보드 스펙](../dashboard/spec.md)), 디스코드 출석은 다른 반 회차에 찍지 않고 `noMeeting[]` 으로 돌려준다([디스코드 출석 스펙](../discord-attendance/spec.md)). ERD 의 `STUDY_ATTENDANCE.STUDY_GROUP_ID` 는 「실제 참석한 반」을 가정했지만 코드는 소속 반으로 쓴다
  - 검토 중인 안 (2026-10-20, 미결정) — 두 항목을 한 규칙으로 묶는다: **출석은 언제나 소속 반 회차에 적고, 다른 반에서 한 출석은 같은 회차 번호의 소속 반 회차로 옮겨 적는다.** 반 이동은 지난 회차 전부를 새 반 같은 번호 회차로 옮겨 적는다. 함께 검토: (a) 출석 행에 실제 참석한 회차 표시 (b) 반 이동 이력 (c) 크루별 출석 기록 목록. (a)(b)는 나중에 채울 수 없으니 옮겨 적기와 같이 넣어야 한다
- [NEEDS CLARIFICATION] 명단 열람을 그 스터디의 네비게이터에게도 열지 (PRD 는 허용) — 연다면 사용자 사이트 경로를 따로 두고 이메일을 빼야 한다
