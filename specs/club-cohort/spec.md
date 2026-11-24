# club-cohort API Spec

> ERD: [STUDY_PROGRAM](../../docs/erd/STUDY_PROGRAM.md) · [STUDY](../../docs/erd/STUDY.md) · [STUDY_PARTICIPANT](../../docs/erd/STUDY_PARTICIPANT.md) · [STUDY_MEETING](../../docs/erd/STUDY_MEETING.md) — 바뀌는 컬럼 · 새 테이블은 아래 「데이터」
> 정책: [POL-0012 클럽 기수](../../01-planning/_registry/policies/POL-0012-club-cohort.md) · [POL-0001](../../01-planning/_registry/policies/POL-0001-roles.md)
> 생성일: 2026-11-24
> 상태: 스펙작성중
>
> Story PRD:
> - [캡틴은 기존 스터디를 재등록할 수 있다(기수제). (ST-021)](../../01-planning/stories/captain-reregister-cohort/PRD.md)
> - [캡틴은 지난 기수를 끝까지 마친 참여자를 다음 기수로 이어 받을 수 있다. (ST-042)](../../01-planning/stories/captain-carry-over-club-members/PRD.md)
> - [캡틴은 클럽 기수의 월간 출석부를 입력할 수 있다. (ST-043)](../../01-planning/stories/captain-club-monthly-attendance/PRD.md)

클럽(`STUDY_PROGRAM.STUDY_KIND = CLUB`)의 기수는 **달 하나**다. 다음 달 기수 초안은 스케줄러가 만들고, 캡틴이 기존 공개 API 로 모집을 연다.
이번 기수를 끝까지 마친 참여자는 다음 기수 시작일 0시에 다음 기수로 넘어간다. 출석은 기존 출석 API 를 쓰되 클럽 기수는 날마다 회차 하나다.

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/clubs | 클럽 목록 — 프로그램 · 이번 기수 · 다음 기수 요약 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/clubs/{programId} | 클럽 한 곳 — 이번 기수 · 다음 기수 · 자동 초안 설정 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/clubs/{programId} | 자동 초안 설정 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/clubs/{programId}/next-cohort | 다음 달 기수 초안 지금 만들기 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/studies/{nextStudyId}/carry-over | 이어서 참여 명단 | O (ADMIN) | 스펙작성중 |
| PUT | /api/admin/studies/{nextStudyId}/carry-over | 다음 기수에서 뺄 사람 저장 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/studies/{studyId}/publish | 모집 시작 — 기존 공개 | O (ADMIN) | 구현완료 |
| GET · POST | /api/admin/studies/{studyId}/attendances | 월간 출석부 — 기존 출석 (클럽 차이는 아래) | O (ADMIN) | 구현완료 · 클럽 검증 추가 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 데이터

| 대상 | 변경 | 비고 |
|---|---|---|
| `STUDY_PROGRAM.AUTO_DRAFT_ENABLED` | BOOLEAN NOT NULL DEFAULT TRUE 추가 | `CLUB` 만 쓴다 |
| `STUDY_PROGRAM.AUTO_DRAFT_DAY` | TINYINT NOT NULL DEFAULT 15 추가 | 1~28 |
| `STUDY.COHORT_MONTH` | DATE NULL 추가 · `UNIQUE(PROGRAM_ID, COHORT_MONTH)` | 클럽 기수의 달(1일). 스터디는 NULL |
| `STUDY_PARTICIPANT.CARRIED_FROM_ID` | BIGINT NULL 추가 | 이어서 참여로 만든 행의 이전 기수 참여 ID |
| `CLUB_CARRY_OVER_EXCLUSION` | 새 테이블 — `ID` · `NEXT_STUDY_ID` · `PARTICIPANT_ID` · `CREATED_AT` · `UNIQUE(NEXT_STUDY_ID, PARTICIPANT_ID)` | 캡틴이 뺀 사람 |
| `STUDY_MEETING` | 클럽 기수는 날마다 1행 · `SCHEDULED_AT` = 그 날 0시 | Daily LeetCode 는 UTC |

## 스케줄러

### 다음 기수 초안 (매일 0시)

- 대상: `STUDY_KIND = CLUB` · `AUTO_DRAFT_ENABLED` · 오늘(캡틴 시간대) 일자 = `AUTO_DRAFT_DAY`
- 다음 달 `COHORT_MONTH` 기수가 이미 있으면 건너뛴다
- 만드는 것: `STUDY`(`STATUS = DRAFT`, 제목 「{프로그램 제목} {YYYY}년 {M}월」, `START_AT` 다음 달 1일, `END_AT` 말일) · `STUDY_RECRUITMENT`(`RECRUIT_DEADLINE_AT` 이번 달 말일 23:59, `START_AT` NULL) · 기본 반 · 날마다 회차
- 이번 기수(같은 프로그램에서 `COHORT_MONTH` 가 가장 늦은 기수)의 소개 · 상세 설명 · 카테고리 · 시간대 · 디스코드 채널 · 드라이브 · 정원 · 신청 폼을 복사한다

### 이어서 참여 (다음 기수 시작일 0시)

1. 직전 기수 종료 — `ACTIVE → COMPLETED`
2. 직전 기수 `COMPLETED` 로 바뀐 참여자 중 `CLUB_CARRY_OVER_EXCLUSION` 에 없는 사람마다 다음 기수 `STUDY_PARTICIPANT`(`ACTIVE`, 기본 반, `CARRIED_FROM_ID`) — 신청 값 복사
3. 다음 기수에 이미 참여 행이 있으면(신청) 만들지 않는다
4. 한 클럽씩 한 트랜잭션. 실패는 운영 알림으로 남기고 다음 클럽을 처리한다

---

## 클럽 한 곳

### 기본 정보

- **Method**: GET
- **Path**: `/api/admin/clubs/{programId}`
- **인증**: 필요 (ADMIN)

### Response — 200

```json
{
  "programId": 3,
  "title": "얼리버드",
  "autoDraft": { "enabled": true, "day": 15 },
  "currentCohort": {
    "studyId": 120,
    "title": "얼리버드 2026년 12월",
    "cohortMonth": "2026-12-01",
    "activeCount": 11
  },
  "nextCohort": {
    "studyId": 131,
    "title": "얼리버드 2027년 1월",
    "cohortMonth": "2027-01-01",
    "status": "DRAFT",
    "recruitStartAt": null,
    "recruitDeadlineAt": "2026-12-31T23:59:00+09:00",
    "capacity": 30,
    "applicantCount": 0,
    "carryOverCount": 10
  }
}
```

- `nextCohort` 가 없으면 `null`. 그때 화면은 `autoDraft` 로 예정일을 안내한다
- `status`: `DRAFT`(초안) · `OPEN`(모집중)

### Response — 4xx

| 상태 | code | 언제 |
|---|---|---|
| 404 | NOT_FOUND | 프로그램이 없거나 `CLUB` 이 아님 |

---

## 자동 초안 설정

- **Method**: PATCH · **Path**: `/api/admin/clubs/{programId}`

### Request Body

| 필드 | 타입 | 필수 | 검증 | 매핑 |
|---|---|---|---|---|
| autoDraftEnabled | Boolean | N | | STUDY_PROGRAM.AUTO_DRAFT_ENABLED |
| autoDraftDay | Integer | N | 1~28 | STUDY_PROGRAM.AUTO_DRAFT_DAY |

### Response

- 200 — 「클럽 한 곳」과 같은 본문
- 400 INVALID_INPUT — `autoDraftDay` 범위 밖

---

## 다음 기수 초안 지금 만들기

- **Method**: POST · **Path**: `/api/admin/clubs/{programId}/next-cohort`
- 스케줄러와 같은 처리를 즉시 한다

### Response

- 201 — `{ "studyId": 131 }`
- 409 CONFLICT — 다음 달 기수가 이미 있다

---

## 이어서 참여 명단

- **Method**: GET · **Path**: `/api/admin/studies/{nextStudyId}/carry-over`

### Response — 200

```json
{
  "fromStudyId": 120,
  "toStudyId": 131,
  "carryAt": "2027-01-01T00:00:00+09:00",
  "locked": false,
  "members": [
    {
      "participantId": 901,
      "discordNickname": "새벽세시",
      "clubAnswer": "05:30",
      "attendanceRate": 75,
      "status": "ACTIVE",
      "leftAt": null,
      "excluded": false
    }
  ]
}
```

- `clubAnswer`: 얼리버드 기상 목표 시각 · Daily LeetCode 아이디. 없으면 `null`
- `attendanceRate`: 월간 출석부와 같은 식. 기록이 없으면 `null`
- `locked`: `carryAt` 이 지났으면 `true`

## 다음 기수에서 뺄 사람 저장

- **Method**: PUT · **Path**: `/api/admin/studies/{nextStudyId}/carry-over`

### Request Body

```json
{ "excludedParticipantIds": [905] }
```

- 뺀 사람 목록 전체를 바꾼다

### Response

- 200 — 명단과 같은 본문
- 400 INVALID_INPUT — 직전 기수 `ACTIVE` 참여자가 아닌 ID
- 409 CONFLICT — `carryAt` 이 지났다

---

## 월간 출석부 — 기존 출석 API 의 클럽 차이

- 클럽 기수의 회차는 날마다 하나라 출석부의 열이 곧 날짜다. 응답에 회차 `date` 를 함께 준다
- 허용 값: 얼리버드 `PRESENT` · `LATE` · `ABSENT` · `EXCUSED`, WEEKLY X · Daily LeetCode `PRESENT` · `ABSENT` · `EXCUSED`. 그 밖이면 400
- 오늘 뒤의 회차 · 참여 중단 뒤의 회차면 400
- 클럽 회차는 회차 상태 판정(`MISSED`)과 회차 시작 전 알림에서 뺀다

---

## 퍼널·계측

- 퍼널 단계: 재방문 — 클럽 재참여율(`CARRIED_FROM_ID` 가 있는 참여 ÷ 직전 기수 참여)
- 추가 이벤트 없음
