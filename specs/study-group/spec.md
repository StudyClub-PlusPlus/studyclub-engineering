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
| GET | /api/admin/studies/{studyId}/participants | 참여 명단 (반 · 담당 · 완주율) | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/participants/{participantId}/role | 네비게이터 지정 · 해제 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/participants/{participantId}/group | 크루의 반 지정 · 이동 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/studies/{studyId}/availability | 신청자 가능 시간 집계 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/studies/{studyId}/groups | 반 만들기 (일정 → 회차 생성) | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/studies/{studyId}/groups/{groupId} | 반 일정 수정 (오늘 이후 회차 다시 생성) | O (ADMIN) | 스펙작성중 |
| DELETE | /api/admin/studies/{studyId}/groups/{groupId} | 반 삭제 (빈 반만) | O (ADMIN) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

모두 `@RequireAdmin`. 반 편성 · 담당 지정은 네비게이터가 하지 못한다 ([POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)).

---

## 참여 명단

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/studies/{studyId}/participants`
- **인증**: 필요 — ADMIN
- **설명**: 그 스터디의 명부 전체. 반 · 담당(네비게이터) · 지난 이력의 완주율을 함께 준다.

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
  "groups": [{ "groupId": 7, "name": "목 20:00 KST" }],
  "participants": [
    {
      "participantId": 41,
      "accountId": 12,
      "nickname": "jamie",
      "email": "jamie@example.com",
      "regionGroup": "KR",
      "groupId": 7,
      "participantRole": "LEADER",
      "status": "ACTIVE",
      "joinedAt": "2026-09-01T00:00:00Z",
      "completionRate": null
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| participantCount | Int | N | `ACTIVE` · `PAUSED` 행 수 | 계산 |
| recruitmentCapacity | Int | Y | 정원. null 이면 제한 없음 | 최신 STUDY_RECRUITMENT.RECRUITMENT_CAPACITY |
| groups[] | Array | N | 그 스터디의 분반 | STUDY_GROUP |
| participants[].participantId | Long | N | | STUDY_PARTICIPANT.ID |
| participants[].nickname · email | String | N | 이메일은 이 백오피스 응답에만 | ACCOUNT |
| participants[].regionGroup | String | Y | `KR` · `NA` · `ETC` | ACCOUNT.REGION_GROUP |
| participants[].groupId | Long | Y | 반 미배정이면 null | STUDY_PARTICIPANT.STUDY_GROUP_ID |
| participants[].participantRole | String | N | `LEADER` = 네비게이터 · `MEMBER` | STUDY_PARTICIPANT.PARTICIPANT_ROLE |
| participants[].status | String | N | `ACTIVE` · `PAUSED` · `WITHDRAWN` | STUDY_PARTICIPANT.STATUS |
| participants[].completionRate | Number | Y | 지난 스터디 완주율(0~1). 이력이 없으면 null — 화면 「첫 참여」 | 계산: 이 스터디 이전에 끝난 명부 행 중 `COMPLETED` 비율 |

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
| participantRole | String | Y | `LEADER` · `MEMBER` (`CO_LEADER` 는 받지 않는다 — [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md) 백엔드 요청 7) |

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

## 신청자 가능 시간 집계

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/studies/{studyId}/availability`
- **인증**: 필요 — ADMIN
- **설명**: 최신 모집 회차의 신청서에서 가능한 요일을 모아 칸별 인원과 사람을 준다. 반 만들기의 출발점.

### Response — 200

```json
{
  "applicationCount": 24,
  "cells": [
    { "day": "mon", "slot": null, "count": 9, "accountIds": [12, 15] }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| cells[].day | String | N | `mon` ~ `sun` | FORM_ANSWER.availableDays |
| cells[].slot | String | Y | `MORNING` · `AFTERNOON` · `EVENING`. 지금 신청 폼은 요일만 받아 늘 null | — |
| cells[].count | Int | N | 그 칸을 가능하다고 답한 신청 수 | 계산 |
| cells[].accountIds | Long[] | N | 누구인지 — 화면이 이름을 붙인다 | STUDY_APPLICATION.ACCOUNT_ID |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 |

---

## 반 만들기

### 기본 정보

- **Method**: POST
- **Path**: `/api/admin/studies/{studyId}/groups`
- **인증**: 필요 — ADMIN
- **설명**: 일정을 받아 분반을 만들고, 시작일~종료일 사이 고른 요일마다 정규 회차를, 그리고 킥오프 회차 하나를 만든다.

### Request Body

```json
{
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
| startDate · endDate | String (yyyy-MM-dd, 분반 현지) | Y | `startDate ≤ endDate` |
| daysOfWeek | String[] | Y | `mon` ~ `sun`, 1개 이상 |
| startTime | String (HH:mm, 분반 현지) | Y | |
| timezone | String (IANA) | Y | [POL-0006](../../01-planning/_registry/policies/POL-0006-timezone.md) 의 값 |
| kickoffAt | String (ISO-8601 UTC) | Y | 킥오프 회차 시각. 첫 정규 회차보다 앞 |

### 서버 동작

1. 반 이름은 서버가 일정으로 만든다 (`{요일} {HH:mm} {KST|PDT…}`). 따로 받지 않는다
2. 현지 날짜 · 시각을 `timezone` 으로 UTC 로 바꿔 `STUDY_MEETING.SCHEDULED_AT` 에 저장한다. `MEETING_TYPE = REGULAR`, 같은 `SERIES_ID`
3. `kickoffAt` 으로 `MEETING_TYPE = KICKOFF` 회차 하나를 만든다 — [회차 스펙 결정 11](../study-meeting/spec.md#결정-사항)
4. 회차 수 상한은 회차 스펙과 같다

### Response — 201

```json
{ "groupId": 7, "name": "목 20:00 KST", "meetingCount": 8 }
```

`meetingCount` 는 정규 회차 수(킥오프 제외).

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 필드 누락 · 날짜 역전 · 요일 키 밖 · 시간대 밖 · 킥오프가 첫 회차보다 늦음 · 회차 0개 |
| 401 · 403 | UNAUTHORIZED · FORBIDDEN | |
| 404 | NOT_FOUND | 없는 스터디 |

---

## 반 일정 수정

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/admin/studies/{studyId}/groups/{groupId}`
- **인증**: 필요 — ADMIN
- **설명**: 일정을 바꾸면 **오늘 이후 시작 전** 정규 회차를 지우고 새 일정으로 다시 만든다. 지난 회차 · 출석 · 킥오프는 둔다.

### Request Body

반 만들기와 같은 필드에서 `kickoffAt` 을 뺀 것. 보낸 필드만 바꾼다.

### 서버 동작

- 지우는 회차의 출석 행도 함께 지운다 (회차 삭제 규칙과 같다)
- 반 이름을 새 일정으로 다시 만든다

### Response — 200

```json
{ "groupId": 7, "name": "금 20:00 KST", "meetingCount": 8, "regeneratedCount": 5 }
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 반 만들기와 같음 |
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

- `STUDY_GROUP` 에 `START_DATE` · `END_DATE` (DATE) · `DAYS_OF_WEEK` (VARCHAR) 추가 — 일정 수정 화면이 지금 값을 다시 보여 주려면 필요하다
- `ErrorCode` 에 `PARTICIPANT_NOT_ACTIVE(409)` · `GROUP_NOT_EMPTY(409)` 추가

## 프론트엔드 사용처

- back-office-front 스터디 상세 — 신청자 탭(명단 · 담당 · 반 편성) (미구현). 프로토: playground `console/studies/{id}`

## 미확정

- [NEEDS CLARIFICATION] 가능 시간 집계를 요일 × 오전·오후·저녁으로 할지 — 신청 폼(`availableDays`)은 요일만 받는다. 시간대 칸을 쓰려면 신청 폼에 시간대 질문이 먼저 필요하다
- [NEEDS CLARIFICATION] 신청자를 명부(`STUDY_PARTICIPANT`)에 넣는 시점 — 반 지정 때인지, 모집 마감 때 일괄인지
- [NEEDS CLARIFICATION] 완주율의 정의 위치 — 「지난 명부 행 중 `COMPLETED` 비율」로 두었다
- [NEEDS CLARIFICATION] 반 일정을 바꿀 때 지워지는 회차에 걸린 휴가 신청 처리
- [NEEDS CLARIFICATION] 명단 열람을 그 스터디의 네비게이터에게도 열지 (PRD 는 허용) — 연다면 사용자 사이트 경로를 따로 두고 이메일을 빼야 한다
