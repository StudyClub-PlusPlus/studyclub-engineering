# 명부 · 출석 API Spec

> ERD: [STUDY_ATTENDANCE](../../docs/erd/STUDY_ATTENDANCE.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md)
> 생성일: 2026-09-15
> 상태: 스펙확정

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies/{studyId}/attendances | 출석 명부 조회 | O | 스펙확정 |
| POST | /api/studies/{studyId}/attendances | 출석 생성/수정 (upsert) | O (캡틴) | 스펙확정 |

> 이번 스코프는 명부 화면을 띄우는 데 필요한 **조회 1개 + 생성 1개** API만 다룬다. 세션 취소, 휴가 신청·승인, 정정 이력 조회 등 나머지 CRUD는 별도 스펙.
> `[OPEN]` = 캡틴 확정 전 제안 기본값 / 팀 확인 필요.

**GET과 POST는 같은 경로를 쓴다** — `/api/studies/{studyId}/attendances`. 같은 리소스(스터디의 출석 컬렉션)를 메서드로만 구분: GET은 읽고, POST는 upsert한다. 별도의 "미팅 목록" 엔드포인트는 없다 — 미팅 목록도 GET 응답 안의 `meetings[]`로 함께 내려간다.

### 관련 데이터 모델

> 전체 스키마는 [`docs/erd/`](../../docs/erd/README.md).

```
STUDY {
  id: long, program_id: long, title
}

STUDY_GROUP {
  id: long, study_id: long
  // STUDY_MEETING / STUDY_PARTICIPANT 모두 study가 아닌 group에 귀속.
  // study 단위 조회는 이 테이블을 경유해서 JOIN한다.
}

STUDY_MEETING {
  id: long, study_group_id: long, scheduled_at, start_at, end_at
}

STUDY_PARTICIPANT {
  id: long, account_id: long, study_group_id: long, study_id: long (비정규화),
  joined_at, status: 'ACTIVE' | 'PAUSED' | 'WITHDRAWN' | 'COMPLETED'
}

STUDY_ATTENDANCE {
  id: long, study_meeting_id: long, account_id: long (FK → ACCOUNT),
  study_id: long (비정규화), study_group_id: long (비정규화),
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
}
```

- `UNIQUE(study_meeting_id, account_id)`.
- `status='EXCUSED'`는 이 스코프에서는 POST 호출로 직접 세팅된다 (LeaveRequest 연동 없음).

---

## 출석 명부 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}/attendances`
- **인증**: 필요 (Bearer)
- **설명**: 지정한 그룹의 명부(모든 회차 × 해당 그룹 참가자)를 기본으로 반환. `meetingId` 쿼리 파라미터로 특정 회차 하나만 필터링 가능 — 응답 구조는 동일, 내용만 좁아짐

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| studyGroupId | Long | **Y** | 조회할 그룹 ID. 존재하지 않으면 404. studyId 소속이 아니면 400 |
| meetingId | Long | N | 특정 회차 하나만 필터링. 해당 그룹 소속이 아니거나 존재하지 않으면 404 |

### Request Body

없음

### 조회 로직 — 그룹 스코프 스티칭

단일 SQL JOIN으로 안 풀리는 이유: 출석률 계산에 "참가자 합류일 이전 미팅 제외" 같은 조건부 로직이 들어가서 애플리케이션 레이어에서 한 번 더 필터링이 필요하다. 각 테이블을 따로 조회하고, 합치는 것과 산식 계산은 서비스 레이어에서 한다.

```
1. STUDY                     WHERE id = studyId
                             → 404 if not found. 헤더 정보(title) 제공

2. STUDY_GROUP               WHERE id = studyGroupId
                             → 404 if not found. group.study_id ≠ studyId → 400

3. STUDY_PARTICIPANT         WHERE study_group_id = studyGroupId
                             → 해당 그룹 참가자 목록. joined_at / status 포함

4. STUDY_MEETING             WHERE study_group_id = studyGroupId ORDER BY scheduled_at
                             → 해당 그룹 미팅 목록

5. meetingId 파라미터가 있으면 4의 목록에 속하는지 확인 → 없으면 404

6. STUDY_ATTENDANCE          WHERE study_meeting_id IN (4의 id 목록)
                             → 출석 값. (study_meeting_id, account_id)로 매핑

7. 서비스 레이어:
   - 3 × 4 매트릭스 생성, 6의 값으로 셀 채움 (없으면 status=null)
   - 참가자별 attendanceRate 계산 (출석률 산식 절 참고) — meetingId 필터 여부와 무관하게 항상 그룹 전체 기준
   - 그룹 평균(가중평균) 계산 — 역시 그룹 전체 기준

8. meetingId 쿼리 파라미터가 있으면, 7까지 다 계산한 뒤 마지막에
   meetings[]와 각 참가자의 attendances[]를 그 미팅 하나로 필터링한다.
   필터는 응답을 "잘라내는" 것이지, 계산 자체를 줄이지 않는다.
```

### Response — 200

응답 구조는 `meetingId` 필터 유무와 무관하게 항상 동일하다 — 필터가 있으면 `meetings`와 각 참가자의 `attendances`가 원소 1개짜리 배열이 될 뿐, 필드 자체가 없어지거나 형태가 바뀌지 않는다.

```json
{
  "study": {
    "id": 1,
    "title": "System Design Interview Study",
    "participantCount": 7,
    "totalMeetings": 6,
    "avgAttendanceRate": 0.82
  },
  "meetings": [
    { "id": 1, "scheduledAt": "2026-09-21T20:00:00+09:00" }
  ],
  "participants": [
    {
      "participantId": 10,
      "displayName": "수아",
      "attendances": [
        { "meetingId": 1, "status": "PRESENT" },
        { "meetingId": 2, "status": "LATE" }
      ],
      "attendanceRate": 0.75
    }
  ]
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| study.id | Long | N | 스터디 ID | STUDY.ID |
| study.title | String | N | 스터디 제목 | STUDY.TITLE |
| study.participantCount | Int | N | 해당 그룹 참가자 수 | 계산: STUDY_PARTICIPANT count (그룹 스코프) |
| study.totalMeetings | Int | N | 해당 그룹 회차 수 | 계산: STUDY_MEETING count (그룹 스코프) |
| study.avgAttendanceRate | Double | Y | 그룹 가중평균. 분모 0이면 null | 계산: 출석률 산식 참고 |
| meetings[].id | Long | N | 미팅 ID | STUDY_MEETING.ID |
| meetings[].scheduledAt | String | N | 예정 시각 (ISO 8601) | STUDY_MEETING.SCHEDULED_AT |
| participants[].participantId | Long | N | | STUDY_PARTICIPANT.ID |
| participants[].displayName | String | N | | ACCOUNT.NICKNAME |
| participants[].attendances[].meetingId | Long | N | | STUDY_MEETING.ID |
| participants[].attendances[].status | String | Y | `PRESENT \| LATE \| ABSENT \| EXCUSED \| null`. null = 미입력 | STUDY_ATTENDANCE.STATUS |
| participants[].attendanceRate | Double | Y | 개인 누적 출석률. 분모 0이면 null → 화면은 "–" 표시 | 계산: 출석률 산식 참고 |

- 모든 status 값은 대문자로 내려간다. 서버 파싱은 대소문자 무관하게 처리한다.

### 출석률 산식

```
개인 출석률(participant) =
  분모 = 0이면 null ("–")
  else Σ(가중치) / countable_meetings

가중치: PRESENT=1.0, LATE=0.5, ABSENT=0
countable_meetings = 스터디의 미팅 중
  scheduled_at <= now()
  AND scheduled_at >= participant.joined_at
  AND participant.status IN ('ACTIVE', 'PAUSED', 'COMPLETED')
  AND 해당 미팅의 STUDY_ATTENDANCE.status != 'EXCUSED'   // 분모에서도 제외

스터디 평균 = 분모 0인 참가자는 제외하고 Σ(개인 분자) / Σ(개인 분모)   // 가중평균
```

검증: 수아(출석·지각) = (1+0.5)/2 = 75%, 시우(출석만) = 1/1 = 100%.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | 존재하지 않는 studyId |
| 404 | NOT_FOUND | 존재하지 않는 studyGroupId |
| 400 | INVALID_INPUT | studyGroupId가 해당 studyId 소속이 아님 |
| 404 | NOT_FOUND | meetingId가 해당 그룹 소속이 아니거나 존재하지 않음 |

미팅이 하나도 없으면 200, `meetings: []`, `participants[].attendances: []`, `study.avgAttendanceRate: null`.

---

## 출석 생성/수정 (upsert)

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies/{studyId}/attendances`
- **인증**: 필요 — LEADER 또는 CO_LEADER 역할 보유자
- **설명**: 스터디 안에서 하나 이상의 미팅 × 참가자 조합에 대해 출석 상태를 한 번에 기록. 여러 회차에 걸친 정정 + 신규 입력이 한 요청에 섞여도 됨. row가 없으면 INSERT, 있으면 UPDATE.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

없음

### Request Body

```json
{
  "updates": [
    { "meetingId": 1, "participantId": 20, "status": "PRESENT" },
    { "meetingId": 1, "participantId": 10, "status": "PRESENT" },
    { "meetingId": 2, "participantId": 30, "status": "PRESENT" }
  ]
}
```

| 필드 | 타입 | 필수 | 검증 |
|------|------|------|------|
| updates | array | Y | 1개 이상. 빈 배열 → 400 |
| updates[].meetingId | Long | Y | studyId에 속한 StudyMeeting.id여야 함 → 아니면 400 |
| updates[].participantId | Long | Y | studyId에 속한 StudyParticipant.id여야 함 → 아니면 400 |
| updates[].status | String | Y | `PRESENT \| LATE \| ABSENT \| EXCUSED`. 허용값 외 → 400 |
| updates[] 내 (meetingId, participantId) 중복 | — | — | 금지 → 400 |

### Response — 200

```json
[
  { "participantId": 20, "attendanceRate": 0.83 },
  { "participantId": 10, "attendanceRate": 1.0 },
  { "participantId": 30, "attendanceRate": 1.0 }
]
```

- 이번 배치가 건드린 참가자당 한 줄, 모든 변경이 반영된 최종 출석률.

### 서버 동작

각 `updates[]` 항목마다:

1. `participantId`로 `account_id`를 조회한 뒤 `(study_meeting_id, account_id)`로 기존 row 조회.
2. 있으면 status update, 없으면 생성.
3. 배치 전체를 하나의 트랜잭션으로 묶음 (all-or-nothing).
4. `(study_meeting_id, account_id)` unique 제약으로 동시 insert race를 409로 전환.
5. 변경된 참가자 집합에 대해서만 rate 재계산 후 응답 배열에 반영.

### 동시성

스터디당 담당 네비게이터 1인이라 동시 충돌 가능성 낮음 — 1차는 last-write-wins, 낙관적 잠금 없음. unique 제약 위반은 409로 매핑. `[OPEN]` — 필요시 버전 체크 추가.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | updates가 빈 배열 |
| 403 | FORBIDDEN | LEADER·CO_LEADER 역할 없음 |
| 404 | NOT_FOUND | 존재하지 않는 studyId |
| 409 | CONFLICT | 동시 쓰기로 unique 제약 위반 |
| 400 | INVALID_INPUT | updates[].meetingId가 스터디 소속 아니거나 존재하지 않음 |
| 400 | INVALID_INPUT | updates[].participantId가 스터디 소속 아님 |
| 400 | INVALID_INPUT | updates[].status 허용값 외 |
| 400 | INVALID_INPUT | updates[] 내 (meetingId, participantId) 중복 |

### 미확정

- `[OPEN]` 버전 체크(낙관적 잠금) 필요 여부