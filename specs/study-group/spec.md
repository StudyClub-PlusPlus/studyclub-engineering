# 분반 · 참여 명단 (백오피스) API Spec

> ERD: [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_APPLICATION](../../docs/erd/STUDY_APPLICATION.md)
> 정책: [POL-0001 역할과 권한](../../01-planning/_registry/policies/POL-0001-roles.md) · [POL-0006 시간대와 지역](../../01-planning/_registry/policies/POL-0006-timezone.md)
> 생성일: 2026-10-06
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 개별 스터디의 참석자를 볼 수 있다.](../../01-planning/stories/captain-view-attendees/PRD.md)
> - [캡틴은 스터디 신청자를 보고 반을 결정할 수 있다.](../../01-planning/stories/captain-assign-classes/PRD.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/studies/{studyId}/participants | 참여 명단 (반 · 담당) | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/participants/{participantId}/role | 네비게이터 지정 · 해제 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/participants/{participantId}/group | 크루의 반 지정 · 이동 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/studies/{studyId}/groups | 반 만들기 (제목만. 회차 없음) | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/groups/{groupId} | 반 제목 · 스터디 시간(요일 · 시각 · 시간대) 수정. 회차는 만들지 않는다 | O (ADMIN) | 스펙작성중 |
| DELETE | /api/admin/studies/{studyId}/groups/{groupId} | 반 삭제 (빈 반만) | O (ADMIN) | 스펙작성중 |

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
  "groups": [{ "groupId": 7, "name": "A반" }],
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
| groups[] | Array | N | 그 스터디의 분반 | STUDY_GROUP |
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

## 네비게이터 지정 · 해제

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/participants/{participantId}/role`
- **인증**: 필요 — ADMIN
- **설명**: 명부 행의 스터디 역할을 바꾼다. 한 스터디(한 분반)에 네비게이터를 여러 명 둘 수 있다.

### Request Body

```json
{ "participantRole": "LEADER" }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| participantRole | String | Y | `LEADER` · `MEMBER` (부반장 `CO_LEADER` 는 2026-10-09 에 없앴다 — [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)) |

### 서버 동작

- 활성 행(`ACTIVE` · `PAUSED`)만 바꾼다. 아니면 409 `PARTICIPANT_NOT_ACTIVE`
- 같은 값이면 그대로 200

### Response — 200

```json
{ "participantId": 41, "participantRole": "LEADER" }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 값 누락 · 목록 밖 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 그 스터디의 명부 행이 아님 |
| 409 | PARTICIPANT_NOT_ACTIVE | 하차 · 탈퇴한 행 |

---

## 크루의 반 지정 · 이동

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/participants/{participantId}/group`
- **인증**: 필요 — ADMIN

### Request Body

```json
{ "groupId": 7 }
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| groupId | Long | Y | 같은 스터디의 분반 |

### 서버 동작

신청자는 기본 반에 들어와 있다. 반을 나누면 이 API 로 옮긴다. 아래를 **한 트랜잭션**에서 한다.

1. 명부 행을 확인한다. `ACTIVE`·`PAUSED` 가 아니면 `409`. `groupId` 가 지금 반과 같으면 아무것도 바꾸지 않고 `200`
2. **잠근다 — 반 id 오름차순으로, 반 행 다음 그 반의 회차 행** (`StudyGroupRepository.findByIdForUpdate` → `StudyMeetingRepository.findByStudyGroupIdForUpdate`)
   - 반 행: 회차 추가·수정·삭제도 반 행을 잠근다([회차 스펙 「잠금」](../study-meeting/spec.md#잠금)). 옮기는 동안 두 반에 회차가 새로 생기거나 지워지지 않는다
   - 회차 행: 디스코드 출석이 같은 잠금으로 회차를 자동 시작한다. 잠근 뒤에 「예정 회차」를 판정해야 판정 직후 회차가 시작되는 일이 없다
   - 순서를 반 id 오름차순으로 고정한다 — 디스코드 출석도 반 id 오름차순으로 회차를 잠근다. 순서가 다르면 서로를 기다리며 멈춘다
3. **옛 반의 예정 회차 출석 행을 지운다** — 상태(`ABSENT`·`EXCUSED` 등)와 상관없이
   - 예정 회차 = 잠금을 얻은 **뒤** 시각으로 아직 시작하지 않은 회차 (`START_AT IS NULL AND SCHEDULED_AT > now()`). 회차 목록의 `started = false` 와 같은 기준이다
   - 이유: 그 사람은 이제 그 회차에 오지 않는다. 남겨 두면 옛 반 출석 집계(대시보드)에 그 사람이 결석으로 섞이고, 화면 명단에는 없는 사람의 행이 된다
   - 사전 휴가(`EXCUSED`)도 지운다 — 휴가는 그 회차에 붙은 것이라, 오지 않을 회차의 휴가는 뜻이 없다
4. **옛 반의 지난 회차(시작한 회차) 출석은 그대로 둔다.** 이미 일어난 사실이다
5. 옛 반에서 맡은 **예정** 회차의 발표자 칸은 비운다 — [회차 스펙](../study-meeting/spec.md)
6. 명부 행의 반을 바꾼다 (`STUDY_PARTICIPANT.STUDY_GROUP_ID = groupId`). `STUDY_ID` · `JOINED_AT` 은 그대로
7. **새 반의 예정 회차마다 출석 행을 `ABSENT` 로 만든다** — 회차 생성 규칙과 같다. 이미 행이 있으면(그 반에 있다가 나갔다 돌아온 경우) 건드리지 않는다 (`UNIQUE(STUDY_MEETING_ID, ACCOUNT_ID)`)
8. 새 반의 지난 회차에는 출석 행을 만들지 않는다 — 그때 그 반에 없었다

> 비유: 학원에서 반을 옮기면 **지난 수업 출석부**는 옛 반에 그대로 남고, **다음 수업부터** 새 반 출석부에 이름이 올라간다. 옛 반 출석부의 앞으로 칸은 지운다.

### Response — 200

```json
{ "participantId": 41, "groupId": 7 }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | `groupId` 누락 · 다른 스터디의 반 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 명부 행 · 반 |
| 409 | PARTICIPANT_NOT_ACTIVE | 하차 · 탈퇴한 행 |

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
| name | String | Y | 반 제목. 앞뒤 공백을 자르고 1~20자(코드포인트 기준) |

### 서버 동작

- `START_AT` · `TIMEZONE` · 시작일 · 종료일 · 요일은 비운다
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

### 서버 동작

- 보낸 필드만 `NAME` · `DAYS_OF_WEEK` · `START_AT` · `TIMEZONE` 에 쓴다
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

### 킥오프

반 일정이 회차를 만들지 않으므로 킥오프도 여기서 만들지 않는다. **킥오프가 없는 분반에 처음 정규 회차를 추가할 때** 회차 추가 API 가 첫 회차 한 주 전 같은 시각에 `MEETING_TYPE = KICKOFF` 회차를 함께 만든다 — [회차 스펙 결정 11](../study-meeting/spec.md#결정-사항). 회차 스펙 반영 필요.

---

## 반 삭제

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/admin/studies/{studyId}/groups/{groupId}`
- **인증**: 필요 — ADMIN

### 서버 동작

- 활성 명부 행이 하나라도 있으면 409 `GROUP_NOT_EMPTY`
- 지우면 그 반의 회차 · 출석도 함께 지운다

### Response — 204 No Content

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 반 |
| 409 | GROUP_NOT_EMPTY | 소속 크루가 있음 |

---

## 데이터 변경 (필요)

- `STUDY_GROUP` 에 `DAYS_OF_WEEK` (VARCHAR, NULL 허용) 추가 — 스터디 시간 수정 창과 「회차 추가」 기본 요일이 읽는다. 시작일 · 종료일 컬럼은 두지 않는다(기간은 회차에서 계산)
- `ErrorCode` 에 `PARTICIPANT_NOT_ACTIVE(409)` · `GROUP_NOT_EMPTY(409)` 추가

## 프론트엔드 사용처

- back-office-front 스터디 상세 — 신청자 탭(명단 · 역할 · 반 만들기 · 반 제목 수정 · 일괄 변경) · 일정 탭(스터디 시간 정하기 · 수정) (미구현 — 지금 신청자 탭은 신청 심사 화면). 프로토: playground `console/studies/{id}`

## 미확정

- 보류(MVP 이후): 신청자 가능 시간 집계(`GET …/availability`) — 신청 폼의 가능한 시간 질문이 필수가 아니라 2026-10-14 에 화면과 함께 뺐다
- ~~신청자를 명부(`STUDY_PARTICIPANT`)에 넣는 시점~~ → **신청 제출 때, 기본 반으로**. 기본 반은 스터디를 만들 때 생기는 첫 반(「기본반」)이고 지울 수 없다. 「크루의 반 지정」은 다른 반으로 옮긴다 (2026-10-20, → [share 10-18](../../docs/share/2026-10-18-roster-on-apply.md))
- ~~반 일정을 바꿀 때 지워지는 회차에 걸린 휴가 신청 처리~~ → 스터디 시간 수정이 회차를 지우지 않아 없어졌다 (2026-10-14)
- [NEEDS CLARIFICATION · 기획 미정] **스터디 시작 뒤 반 이동** — 시작 뒤에도 반을 옮길 수 있다(2026-10-20 확인). 그런데 출석률 계산기(`AttendanceRateCalculator`)는 **지금 반의 회차**만 본다. 그래서 옮기면 (1) 옛 반 지난 출석은 남지만 출석률에서 빠지고, (2) 새 반의 지난 회차는 `JOINED_AT` 이후면 출석 행 없이 분모에 들어가 결석처럼 센다. 「옮긴 시각」을 기록해 반별로 나눠 셀지 등 기획이 필요하다. 위 「서버 동작」의 지난 출석 · 예정 출석 처리는 이 결정과 별개로 유지한다
- [NEEDS CLARIFICATION · 기획 미정] **다른 반 출석** — A반 참여자가 B반 회차에 나와 출석할 수 있다(2026-10-20 확인). 어느 반 회차에 어떤 상태로 기록하고 출석률에 어떻게 셀지 정해지지 않았다. 지금 임시 규칙: 대시보드는 다른 반 참석을 **소속 반 회차의 `EXCUSED`** 로 인정한다([대시보드 스펙](../dashboard/spec.md)), 디스코드 출석은 다른 반 회차에 찍지 않고 `noMeeting[]` 으로 돌려준다([디스코드 출석 스펙](../discord-attendance/spec.md)). ERD 의 `STUDY_ATTENDANCE.STUDY_GROUP_ID` 는 「실제 참석한 반」을 가정했지만 코드는 소속 반으로 쓴다
  - 검토 중인 안 (2026-10-20, 미결정) — 두 항목을 한 규칙으로 묶는다: **출석은 언제나 소속 반 회차에 적고, 다른 반에서 한 출석은 같은 회차 번호의 소속 반 회차로 옮겨 적는다.** 반 이동은 지난 회차 전부를 새 반 같은 번호 회차로 옮겨 적는다. 함께 검토: (a) 출석 행에 실제 참석한 회차 표시 (b) 반 이동 이력 (c) 크루별 출석 기록 목록. (a)(b)는 나중에 채울 수 없으니 옮겨 적기와 같이 넣어야 한다
- [NEEDS CLARIFICATION] 명단 열람을 그 스터디의 네비게이터에게도 열지 (PRD 는 허용) — 연다면 사용자 사이트 경로를 따로 두고 이메일을 빼야 한다
