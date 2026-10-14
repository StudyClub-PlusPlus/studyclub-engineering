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
| PATCH | /api/admin/studies/{studyId}/groups/{groupId} | 반 제목 수정 · 반 일정 정하기·수정 (회차 생성 · 오늘 이후 재생성) | O (ADMIN) | 스펙작성중 |
| DELETE | /api/admin/studies/{studyId}/groups/{groupId} | 반 삭제 (빈 반만) | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

모두 `@RequireAdmin`. 반 편성 · 담당 지정은 네비게이터가 하지 못한다 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)).

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
| participants[].groupId | Long | Y | 반 미배정이면 null | STUDY_PARTICIPANT.STUDY_GROUP_ID |
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

- 반을 옮겨도 지난 출석은 그대로 둔다(출석은 회차에 붙어 있다)
- 옛 반에서 맡은 **예정** 회차의 발표자 칸은 비운다 — [회차 스펙](../study-meeting/spec.md)
- 새 반의 예정 회차 출석 행은 회차 생성 규칙대로 `ABSENT` 로 만든다

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
- **설명**: 제목만 받아 분반을 만든다. **회차는 만들지 않는다** — 일정은 아래 「반 이름 · 일정」으로 따로 정한다 (→ [share 10-14](../../docs/share/2026-10-14-class-title-and-captain-applies.md)).

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

## 반 이름 · 일정

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/groups/{groupId}`
- **인증**: 필요 — ADMIN
- **설명**: 반 제목을 수정하거나(신청자 탭 「수정」) 반 일정을 정하고 고친다(일정 탭). 보낸 필드만 바꾼다.

### Request Body

```json
{
  "name": "A반",
  "startDate": "2026-10-15",
  "endDate": "2026-12-03",
  "daysOfWeek": ["thu"],
  "startTime": "20:00",
  "timezone": "Asia/Seoul",
  "kickoffAt": "2026-10-08T11:00:00Z"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| name | String | N | 반 제목. 앞뒤 공백을 자르고 1~20자(코드포인트 기준) |
| startDate · endDate | String (yyyy-MM-dd, 분반 현지) | N* | `startDate ≤ endDate` |
| daysOfWeek | String[] | N* | `mon` ~ `sun`, 1개 이상 |
| startTime | String (HH:mm, 분반 현지) | N* | |
| timezone | String (IANA) | N* | [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) 의 값 |
| kickoffAt | String (ISO-8601 UTC) | N | 킥오프 회차 시각. **처음 일정을 정할 때만** 받는다. 첫 정규 회차보다 앞 |

\* 일정 필드는 처음 정할 때 다섯(`startDate` · `endDate` · `daysOfWeek` · `startTime` · `timezone`)을 함께 보낸다. 이미 일정이 있으면 바꿀 것만 보낸다.

### 서버 동작

- `name` 만 오면 이름만 바꾼다. 회차 · 출석은 그대로
- **처음 일정을 정할 때**(지금 회차가 없음): 시작일~종료일 사이 고른 요일마다 정규 회차를 만든다. 현지 날짜 · 시각을 `timezone` 으로 UTC 로 바꿔 `STUDY_MEETING.SCHEDULED_AT` 에 저장한다. `MEETING_TYPE = REGULAR`, 같은 `SERIES_ID`, **`TITLE` 은 NULL** — 일정 표에서 채운다. `kickoffAt` 이 오면 `MEETING_TYPE = KICKOFF` 회차 하나도 만든다 — [회차 스펙 결정 11](../study-meeting/spec.md#결정-사항)
- **일정을 바꿀 때**: 화면이 저장 전에 확인을 받는다(지워지는 회차의 제목 · 발표자 · 휴가 신청도 사라진다). 서버는 **오늘 이후 시작 전** 정규 회차를 지우고 새 일정으로 다시 만든다. 지난 회차 · 출석 · 킥오프는 둔다. 지우는 회차의 출석 행도 함께 지운다 (회차 삭제 규칙과 같다)
- 새로 만든 예정 회차의 출석 행은 그 반 활성 명부 행마다 `ABSENT` 로 만든다
- 회차 수 상한은 회차 스펙과 같다

### Response — 200

```json
{ "groupId": 7, "name": "A반", "meetingCount": 8, "regeneratedCount": 5 }
```

`meetingCount` 는 정규 회차 수(킥오프 제외). `regeneratedCount` 는 이번에 지우고 다시 만든 회차 수 — 처음 정할 때는 만든 수, 이름만 바꿨으면 0.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 빈 바디 · 이름 길이 밖 · 날짜 역전 · 요일 키 밖 · 시간대 밖 · 처음 정하는데 일정 필드 누락 · 킥오프가 첫 회차보다 늦음 · 회차 0개 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 · 반 |

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

- `STUDY_GROUP` 에 `START_DATE` · `END_DATE` (DATE) · `DAYS_OF_WEEK` (VARCHAR) 추가 — 일정 수정 화면이 지금 값을 다시 보여 주려면 필요하다. 반을 막 만들면 비어 있으므로 NULL 허용
- `ErrorCode` 에 `PARTICIPANT_NOT_ACTIVE(409)` · `GROUP_NOT_EMPTY(409)` 추가

## 프론트엔드 사용처

- back-office-front 스터디 상세 — 신청자 탭(명단 · 담당 · 반 만들기 · 반 제목 수정) · 일정 탭(반 일정 정하기 · 수정) (미구현). 프로토: playground `console/studies/{id}`

## 미확정

- 보류(MVP 이후): 신청자 가능 시간 집계(`GET …/availability`) — 신청 폼의 가능한 시간 질문이 필수가 아니라 2026-10-14 에 화면과 함께 뺐다
- [NEEDS CLARIFICATION] 신청자를 명부(`STUDY_PARTICIPANT`)에 넣는 시점 — 반 지정 때인지, 모집 마감 때 일괄인지
- [NEEDS CLARIFICATION] 반 일정을 바꿀 때 지워지는 회차에 걸린 휴가 신청 처리
- [NEEDS CLARIFICATION] 명단 열람을 그 스터디의 네비게이터에게도 열지 (PRD 는 허용) — 연다면 사용자 사이트 경로를 따로 두고 이메일을 빼야 한다
