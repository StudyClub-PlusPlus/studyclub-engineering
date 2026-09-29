# 회차(미팅) API Spec

> ERD: [STUDY_GROUP](../../docs/erd/STUDY_GROUP.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · MEETING_SERIES (신규 — ERD 미작성)
> 생성일: 2026-09-28
> 상태: 스펙작성중
>
> 흐름·규칙 정본: [회차 흐름](../../docs/flows/meeting.md) · 화면: [회차 설정 UI](../../docs/flows/meeting-ui.md) · 와이어프레임: [wireframes/](./wireframes/index.html)
> 출석 쪽 변경은 [attendance spec](../attendance/spec.md) 과 [출석 흐름](../../docs/flows/attendance.md) — 이 스펙은 **회차가 생기고 바뀌는 것**만 다룬다.

## 엔드포인트 목록

경로는 **스터디 범위** 기준으로 적는다. 백오피스(캡틴)용은 같은 경로를 `/api/admin` 아래 하나 더 둔다 — [관객이 둘이면 엔드포인트도 둘이다](../../docs/backend-development-guide/api/endpoint-convention.md#관객이-둘이면-엔드포인트도-둘이다).

| # | Method | Path | 설명 | 인증 | 상태 |
|---|--------|------|------|------|------|
| 1 | GET | /api/studies/{studyId}/groups/{groupId}/meetings | 달력 조회 (회차 + 반복 일정) | O | 스펙작성중 |
| 2 | POST | /api/studies/{studyId}/groups/{groupId}/meeting-series | 반복 일정 만들기 + 펼치기 | O (운영) | 스펙작성중 |
| 3 | PATCH | /api/studies/{studyId}/meeting-series/{seriesId} | 반복 일정 수정 (이후 · 모두) | O (운영) | 스펙작성중 |
| 4 | DELETE | /api/studies/{studyId}/meeting-series/{seriesId} | 반복 일정 끝내기·삭제 (이후 · 모두) | O (운영) | 스펙작성중 |
| 5 | POST | /api/studies/{studyId}/groups/{groupId}/meetings | 회차 추가 (단건) | O (운영) | 스펙작성중 |
| 6 | PATCH | /api/studies/{studyId}/meetings/{meetingId} | 회차 하나 날짜·시각 변경 | O (운영) | 스펙작성중 |
| 7 | PATCH | /api/studies/{studyId}/groups/{groupId}/meetings | 여러 회차 한꺼번에 — 휴강 · 되돌리기 · 시각 변경 | O (운영) | 스펙작성중 |
| 8 | POST | /api/studies/{studyId}/groups/{groupId}/meeting-deferrals | 미루기 | O (운영) | 스펙작성중 |
| 9 | DELETE | /api/studies/{studyId}/groups/{groupId}/meetings | 여러 회차 삭제 (기록 없는 것만) | O (운영) | 스펙작성중 |

- **O (운영)** = 그 스터디의 네비게이터 또는 캡틴. `/api/admin/...` 쪽은 캡틴만.
- 여러 행을 바꾸는 2·3·4·7·8 은 **`?dryRun=true`** 를 받는다 — 저장하지 않고 [영향 요약](#영향-요약-impact--dryrun-공통)만 돌려준다. 화면은 이 결과를 그대로 그린다 (펼치기 로직을 화면에 두지 않는다).
- 한 요청은 **한 트랜잭션** — 일부만 바뀌지 않는다.
- 동사를 URL 에 두지 않는다. 휴강·되돌리기·시각 변경은 회차 컬렉션의 부분 수정(PATCH), 미루기는 "미루기" 리소스 생성(POST)이다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

### 관련 데이터 모델

```
STUDY_GROUP {
  id, study_id, name, timezone (IANA)          // 기존. START_AT 은 반복 일정으로 옮기고 삭제
}

MEETING_SERIES {                                // 신규
  id, study_group_id,
  weekdays: 'MON,THU', interval_weeks: 1|2,
  start_date: DATE, count: INT?, until: DATE?,  // count 와 until 중 하나만
  start_time: TIME, window_min: INT
}

STUDY_MEETING {
  id, study_group_id, series_id?,               // series_id 추가 — 단건 회차는 NULL
  scheduled_at, closes_at,                      // closes_at 추가
  original_at?, canceled_at?, change_note?,     // 추가
  start_at?, end_at?                            // 기존 — 디스코드 실제 시작·종료
}
```

회차 상태·번호는 저장하지 않고 계산한다 → [회차 §1-3](../../docs/flows/meeting.md#1-3-회차-상태-저장하지-않고-계산).

---

## 1. 달력 조회

- **Method**: GET · **Path**: `/api/studies/{studyId}/groups/{groupId}/meetings`
- **인증**: 필요. 그 반의 크루도 조회 가능 (크루 화면의 회차 목록)

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| from | String (date) | N | 반 시간대 기준 날짜. 없으면 전체 |
| to | String (date) | N | 〃 |

### Response — 200

```json
{
  "group": { "id": 3, "name": "목요일반", "timezone": "Asia/Seoul" },
  "series": [
    {
      "id": 11, "weekdays": ["THU"], "intervalWeeks": 1,
      "startDate": "2026-10-01", "count": 8, "until": null,
      "startTime": "20:00", "windowMin": 120
    }
  ],
  "meetings": [
    {
      "id": 101, "seriesId": 11, "no": 4,
      "scheduledAt": "2026-10-29T11:00:00Z", "closesAt": "2026-10-29T13:00:00Z",
      "originalAt": "2026-10-22T11:00:00Z", "canceled": false, "note": "강사 사정",
      "state": "SCHEDULED", "attendanceCount": 0, "leaveCount": 0
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| group.timezone | String | N | 달력을 그리는 기준 시간대 | STUDY_GROUP.TIMEZONE |
| series[].weekdays | String[] | N | `MON`~`SUN` | MEETING_SERIES.WEEKDAYS |
| series[].intervalWeeks | Int | N | 1 매주 · 2 격주 | MEETING_SERIES.INTERVAL_WEEKS |
| series[].count / until | Int / String | Y | 둘 중 하나만 값이 있다 | MEETING_SERIES.COUNT · UNTIL |
| series[].startTime | String | N | `HH:mm`, 반 시간대 | MEETING_SERIES.START_TIME |
| meetings[].seriesId | Long | Y | 단건 회차는 null | STUDY_MEETING.SERIES_ID |
| meetings[].no | Int | Y | 회차 번호. 휴강이면 null | 계산: 휴강 아닌 회차의 날짜순 |
| meetings[].scheduledAt / closesAt | String | N | UTC ISO 8601 | STUDY_MEETING |
| meetings[].originalAt | String | Y | 옮긴 적 있으면 원래 시각 — 화면의 `변경` 배지 | STUDY_MEETING.ORIGINAL_AT |
| meetings[].canceled | Boolean | N | 휴강 | 계산: CANCELED_AT IS NOT NULL |
| meetings[].state | String | N | `SCHEDULED \| OPEN \| CLOSED \| CANCELED` | 계산: 시각 |
| meetings[].attendanceCount | Int | N | 출석 기록 수 — 삭제·미루기 가능 판정에 쓴다 | 계산: STUDY_ATTENDANCE (EXCUSED 제외) |
| meetings[].leaveCount | Int | N | 휴가 수 — 팝오버 "휴가 1건" | 계산: STUDY_ATTENDANCE (EXCUSED) |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 403 | FORBIDDEN | 그 반의 크루도 운영자도 아님 |
| 404 | NOT_FOUND | studyId · groupId 없음 |
| 400 | INVALID_INPUT | groupId 가 studyId 소속이 아님 · from > to |

---

## 2. 반복 일정 만들기

- **Method**: POST · **Path**: `/api/studies/{studyId}/groups/{groupId}/meeting-series` `?dryRun`

### Request Body

```json
{ "weekdays": ["THU"], "intervalWeeks": 1, "startDate": "2026-10-01",
  "count": 8, "until": null, "startTime": "20:00", "windowMin": 120 }
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| weekdays | String[] | Y | 1개 이상, 중복 없음 |
| intervalWeeks | Int | Y | 1 또는 2 |
| startDate | String (date) | Y | |
| count · until | Int · String | 하나만 Y | 둘 다 있거나 둘 다 없으면 400. count 1~100, until ≥ startDate |
| startTime | String | Y | `HH:mm` |
| windowMin | Int | Y | 1~1440 |

### Response

- `dryRun=true` → **200** 영향 요약 (`created[]` 에 펼쳐질 회차)
- 저장 → **201** `Location: .../meeting-series/{id}` + 영향 요약

### 서버 동작

펼치기 알고리즘 → [회차 §3-3](../../docs/flows/meeting.md#3-3-펼치기-공통). 날짜마다 반 시간대 → UTC 변환 (서머타임).

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 위 검증 실패 · 펼친 결과가 0회 |
| 403 | FORBIDDEN | 운영자 아님 |
| 404 | NOT_FOUND | studyId · groupId 없음 |

---

## 3. 반복 일정 수정

- **Method**: PATCH · **Path**: `/api/studies/{studyId}/meeting-series/{seriesId}` `?dryRun`

### Request Body

```json
{ "scope": "FOLLOWING", "fromMeetingId": 105,
  "weekdays": ["FRI"], "startTime": "20:00" }
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| scope | String | Y | `FOLLOWING`(이 회차 및 이후) · `ALL`(모든 회차 — 지난 회차 제외). "이 회차만" 은 이 API 가 아니라 [6](#6-회차-하나-날짜시각-변경) |
| fromMeetingId | Long | FOLLOWING 이면 Y | 이 반복 일정의 예정 회차 |
| weekdays · intervalWeeks · count · until · startTime · windowMin | | N | 보낸 것만 바꾼다. 검증은 [2](#2-반복-일정-만들기) 와 같다 |

### 서버 동작

- `FOLLOWING` → 기존 반복 일정의 `until` = fromMeeting 전날, 새 반복 일정 생성 (count 면 남은 회수). 응답에 새 `seriesId`.
- `ALL` → 규칙을 바꾸고 미래 회차만 다시 펼친다.
- **건드리지 않는 회차**: 열림·닫힘 · 예외(`original_at`) · 휴강 · 출석 기록 있는 회차 → 응답 `kept[]`. [회차 §4-7](../../docs/flows/meeting.md#4-7-추가--반복-일정-수정삭제--범위를-고른다)

### Response — 200

영향 요약. 저장 시 날짜가 바뀐 회차가 있으면 크루 알림 1건.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | scope 없음 · FOLLOWING 인데 fromMeetingId 없음 · fromMeeting 이 이 반복 일정 소속이 아니거나 예정이 아님 |
| 403 | FORBIDDEN | 운영자 아님 |
| 404 | NOT_FOUND | seriesId 없음 |

---

## 4. 반복 일정 끝내기·삭제

- **Method**: DELETE · **Path**: `/api/studies/{studyId}/meeting-series/{seriesId}` `?scope&fromMeetingId&dryRun`

| scope | 동작 |
|---|---|
| `FOLLOWING` | 반복 일정을 fromMeeting 전날에 끝낸다. 이후 회차는 기록 없으면 삭제, 있으면 휴강 |
| `ALL` | 미래 회차를 같은 규칙으로 삭제·휴강. 지난 회차가 없으면 반복 일정 행도 지운다 |

Response — 200 영향 요약. Error 는 [3](#3-반복-일정-수정) 과 같다.

---

## 5. 회차 추가 (단건)

- **Method**: POST · **Path**: `/api/studies/{studyId}/groups/{groupId}/meetings`

```json
{ "date": "2026-11-28", "startTime": "14:00", "windowMin": 120, "note": "특강" }
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| date · startTime | String | Y | 반 시간대 기준 |
| windowMin | Int | N | 없으면 이 반 첫 반복 일정의 값, 그것도 없으면 120 |
| note | String | N | 100자 |

Response — **201** `Location`. `series_id = NULL`. 크루 알림 1건.

---

## 6. 회차 하나 날짜·시각 변경

- **Method**: PATCH · **Path**: `/api/studies/{studyId}/meetings/{meetingId}` `?dryRun`
- 화면: 팝오버 「일정 변경」(범위 "이 회차만"), 달력 드래그, 「늦게 시작」

```json
{ "date": "2026-10-24", "startTime": "20:00", "note": "강사 일정" }
```

| 필드 | 필수 | 설명 |
|------|------|------|
| date | N | 반 시간대. 바꾸면 **예정 회차만** 가능 |
| startTime | N | 열린 회차도 가능 — 같은 날 안에서 늦출 때만 (늦게 시작) |
| note | N | |

### 서버 동작

- `original_at` 이 비어 있으면 현재 `scheduled_at` 을 넣는다 (처음 옮길 때만). `closes_at` = 새 시작 + 창 길이.
- 날짜가 바뀌면 본인 휴가(`EXCUSED`, `SOURCE=SELF`) 삭제 + 해당 크루 알림. 같은 날 시각만 바뀌면 체크인 칸 재판정 → [출석 §6](../../docs/flows/attendance.md#6-회차가-바뀌면-출석은).
- 원래 일정으로 되돌리기는 `{"restoreOriginal": true}` — `scheduled_at = original_at`, `original_at = NULL`.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 열린 회차의 날짜 변경 · 열린 회차를 앞당김 · 닫힌·휴강 회차 변경 · 출석 기록이 있는 회차의 날짜 변경 |
| 403 | FORBIDDEN | 운영자 아님 |
| 404 | NOT_FOUND | meetingId 없음 |

---

## 7. 여러 회차 한꺼번에 — 휴강 · 되돌리기 · 시각 변경

- **Method**: PATCH · **Path**: `/api/studies/{studyId}/groups/{groupId}/meetings` `?dryRun`

```json
{ "meetingIds": [101, 102], "canceled": true, "note": "추석 연휴" }
{ "meetingIds": [101], "canceled": false }
{ "meetingIds": [105, 106, 107, 108], "startTime": "21:00" }
```

| 필드 | 필수 | 설명 |
|------|------|------|
| meetingIds | Y | 1개 이상, 모두 이 반 소속 |
| canceled | 셋 중 하나 | `true` 휴강 · `false` 휴강 되돌리기 (열리기 전만) |
| startTime | 셋 중 하나 | 시각만 변경 — 모두 예정 회차 |
| note | N | |

`canceled` 와 `startTime` 을 같이 보내면 400. 휴강은 닫힌 회차에도 된다(사후 휴강).

Response — 200 영향 요약. 크루 알림은 요청당 1건으로 묶는다.

---

## 8. 미루기

- **Method**: POST · **Path**: `/api/studies/{studyId}/groups/{groupId}/meeting-deferrals` `?dryRun`

```json
{ "meetingIds": [101], "note": "강사 사정", "extendStudyEnd": true }
```

| 필드 | 필수 | 검증 |
|------|------|------|
| meetingIds | Y | 1개 이상, 모두 **예정**이고 **같은 반복 일정** 소속 |
| note | N | |
| extendStudyEnd | N | 끝이 늘어날 때 `STUDY.END_AT` 도 늘릴지. 기본 false |

### 서버 동작

[회차 §4-5](../../docs/flows/meeting.md#4-5-미루기--여러-날을-비우고-뒤로) 알고리즘. 움직인 회차는 `original_at` 기록. `until` 반복 일정이면 기수 밖으로 나간 회차를 지우고 `removed[]` 로 알린다.

Response — **201** (저장) / 200 (dryRun) 영향 요약.

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 예정이 아닌 회차 포함 · 단건 회차 포함 · 반복 일정이 둘 이상 섞임 |
| 403 | FORBIDDEN | 운영자 아님 |

---

## 9. 여러 회차 삭제

- **Method**: DELETE · **Path**: `/api/studies/{studyId}/groups/{groupId}/meetings?ids=101,102`

잘못 만든 회차용. 행을 지우고 크루 알림을 보내지 않는다.

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 204 | — | 성공 |
| 409 | CONFLICT | 출석·휴가 기록이 있는 회차 포함 — 휴강을 쓴다 |
| 403 · 404 | | 위와 같다 |

---

## 영향 요약 (impact) — dryRun 공통

2·3·4·6·7·8 의 응답. 화면의 [확정 전 영향 요약](../../docs/flows/meeting-ui.md#7-확정-전--영향-요약) 이 이것을 그대로 그린다.

```json
{
  "created":  [{ "date": "2026-11-26", "startTime": "20:00" }],
  "moved":    [{ "meetingId": 101, "from": "2026-10-22T11:00:00Z", "to": "2026-10-29T11:00:00Z" }],
  "canceled": [],
  "removed":  [],
  "kept":     [{ "meetingId": 104, "reason": "HAS_ATTENDANCE" }],
  "leavesReleased": [{ "meetingId": 101, "participantId": 10, "displayName": "수아" }],
  "checkedInOnCanceled": 0,
  "end": { "from": "2026-11-19", "to": "2026-11-26" },
  "notifyCount": 7
}
```

| 필드 | 설명 |
|------|------|
| created · moved · canceled · removed | 바뀌는 회차 |
| kept[].reason | `PAST` · `EXCEPTION` · `CANCELED` · `HAS_ATTENDANCE` — 건드리지 않은 이유 |
| leavesReleased | 날짜가 바뀌어 풀리는 본인 휴가 |
| checkedInOnCanceled | 열린 회차를 휴강할 때 이미 체크인한 사람 수 |
| end | 마지막 회차 날짜 변화. 없으면 null |
| notifyCount | 알림 받을 크루 수 |

---

## 프론트엔드 사용처

- 백오피스 스터디 상세 「회차」 탭 (신규) — [와이어프레임](./wireframes/index.html)
- 백오피스 출석 탭 열 머리 팝오버 — `frontend/apps/back-office-front/src/components/AttendanceTab.tsx` (지금 「회차 등록」 버튼 `disabled`)
- core-front 내 스터디 회차 목록 — `frontend/apps/core-front/src/lib/attendance.ts` (지금 mock `getStudyCrew().meetings`)

## 미확정

- **네비게이터 화면 자리** — playground 프로토(#142)가 크루 쪽 앱 「내 스터디 › 관리 › 일정」 으로 잡았다. 그 화면이 `/api/studies/...` 를, 백오피스가 `/api/admin/...` 을 부른다. 프로토의 `TODO(api)` 초안은 이 스펙이 대체한다 ([관계 R5](../../docs/flows/README.md#먼저-머지된-것과의-관계--맞춰야-할-곳))
- [NEEDS CLARIFICATION] **회차 제목(`TITLE`)** — 프로토에 있고 이 스펙엔 없다. 추가 여부
- [NEEDS CLARIFICATION] **진행 중 판정** — [디스코드 출석](../discord-attendance/spec.md) 은 `START_AT`/`END_AT`, 이 스펙은 `CLOSES_AT` 창. 합치는 안은 [관계 R2](../../docs/flows/README.md#먼저-머지된-것과의-관계--맞춰야-할-곳)
- [NEEDS CLARIFICATION] 드래그로 옮길 때 범위를 묻지 않고 "이 회차만" 으로 처리 — [결정 9](../../docs/flows/README.md#사람이-정해야-할-것)
- [NEEDS CLARIFICATION] 날짜가 바뀌면 본인 휴가를 풀지 — [결정 5](../../docs/flows/README.md#사람이-정해야-할-것)
- [NEEDS CLARIFICATION] 알림 이벤트 `MEETING_CHANGED` · `MEETING_CANCELED` — [notification spec](../notification/spec.md) 에 추가 필요
- [NEEDS CLARIFICATION] **여러 반 공동 휴강** — 분반 두 반을 한 트랜잭션으로 휴강하려면 스터디 범위 일괄 수정 `PATCH /api/studies/{studyId}/meetings` 가 필요하다 ([조합표](../../docs/journeys/combinations.md#조합에서-나온-것--스펙결정) · [와이어프레임 11](./wireframes/11-two-groups.html))
- [NEEDS CLARIFICATION] **여러 스터디 한꺼번에 방학** (캡틴) — 이 스펙 범위 밖. [와이어프레임 14](./wireframes/14-range-break.html) 는 한 스터디 안의 기간 쉬기만
- `MEETING_SERIES` ERD 문서 작성 · STUDY_MEETING ERD 컬럼 추가 — 스펙 확정 후
