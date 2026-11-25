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

클럽(`STUDY_PROGRAM.STUDY_KIND = CLUB`)의 기수는 **달 하나**다. 다음 달 기수는 스케줄러가 초안 날(기본 15일)에 만들고 공개 날(기본 20일)에 공개한다. 캡틴은 기존 공개 API 로 먼저 열 수 있다.
기수 상태는 날짜로 바뀐다. 기수 종료와 이어서 참여는 서로 다른 처리다. 출석은 기존 출석 API · 출석률 산식을 그대로 쓰되 클럽 기수는 날마다 회차 하나다.
시각은 따로 적지 않으면 한국 시간(KST)이다. 신청에 승인 단계는 없다 — 신청하면 참여자다.

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/admin/clubs | 클럽 목록 — 프로그램 · 이번 기수 · 다음 기수 요약 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/clubs/{programId} | 클럽 한 곳 — 이번 기수 · 다음 기수 · 자동 초안 설정 | O (ADMIN) | 스펙작성중 |
| GET | /api/admin/clubs/{programId}/cohorts | 지난 기수 — 달마다 시작 · 완주 · 참여 중단 · 이어짐 · 평균 출석률 | O (ADMIN) | 스펙작성중 |
| PATCH | /api/admin/clubs/{programId} | 자동 초안 설정 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/clubs/{programId}/next-cohort | 다음 달 기수 초안 지금 만들기 — **클럽 기수를 만드는 유일한 API** | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/studies | 스터디 등록 — `studyProgramId`(기존 클럽의 새 기수)를 받지 않는다. 새 클럽의 첫 기수만 만든다 | O (ADMIN) | 구현완료 · 변경 예정 ([study](../study/spec.md) AC-7) |
| GET | /api/admin/studies/{nextStudyId}/carry-over | 이어서 참여 명단 | O (ADMIN) | 스펙작성중 |
| PUT | /api/admin/studies/{nextStudyId}/carry-over | 다음 기수에서 뺄 사람 저장 | O (ADMIN) | 스펙작성중 |
| POST | /api/admin/studies/{studyId}/publish | 모집 시작 — 기존 공개 | O (ADMIN) | 구현완료 |
| GET · POST | /api/admin/studies/{studyId}/attendances | 월간 출석부 — 기존 출석 (클럽 차이는 아래) | O (ADMIN) | 구현완료 · `reinstatements[]` 추가 |
| GET · POST | /api/studies/{studyId}/applications/me · /applications | 크루 신청 — 넘어갈 사람은 `carriedOver` · `409` (아래 「크루 신청」) | O (로그인) | 구현완료 · `carriedOver` 추가 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 데이터

| 대상 | 변경 | 비고 |
|---|---|---|
| `STUDY_PROGRAM.AUTO_DRAFT_ENABLED` | BOOLEAN NOT NULL DEFAULT TRUE 추가 | `CLUB` 만 쓴다 |
| `STUDY_PROGRAM.AUTO_DRAFT_DAY` | TINYINT NOT NULL DEFAULT 15 추가 | 1~28 |
| `STUDY_PROGRAM.AUTO_PUBLISH_DAY` | TINYINT NOT NULL DEFAULT 20 추가 | `AUTO_DRAFT_DAY` 보다 크고 28 이하 |
| 신청 폼 질문 `SHOW_IN_ROSTER` | BOOLEAN NOT NULL DEFAULT FALSE 추가 | 켠 질문의 답을 명단 · 출석부 · 이어서 참여 응답의 `rosterAnswer` 로 준다. 초안이 폼과 함께 복사한다 |
| 이어서 참여의 신청 답 | 직전 기수 신청 답을 **스냅샷(질문 문구 · 답 · `SHOW_IN_ROSTER`)** 으로 다음 기수 참여에 복사 | 질문 ID 로 짝짓지 않는다 — 다음 기수 폼이 바뀌어도 답이 남는다 |
| `STUDY.COHORT_MONTH` | DATE NULL 추가 · `UNIQUE(PROGRAM_ID, COHORT_MONTH)` | 클럽 기수의 달(1일). 스터디는 NULL |
| `STUDY_PARTICIPANT.CARRIED_FROM_ID` | BIGINT NULL 추가 | 이어서 참여로 만든 행의 이전 기수 참여 ID |
| `CLUB_CARRY_OVER_EXCLUSION` | 새 테이블 — `ID` · `NEXT_STUDY_ID` · `PARTICIPANT_ID` · `CREATED_AT` · `UNIQUE(NEXT_STUDY_ID, PARTICIPANT_ID)` | 캡틴이 뺀 사람 |
| `STUDY_MEETING` | 클럽 기수는 날마다 1행 · `SCHEDULED_AT` = 그 날 0시(KST) | 회차는 「그 달의 몇째 날」을 가리키는 칸이다. 클럽 시간대는 두지 않는다 — 하루를 세는 기준(예: LeetCode UTC)은 스터디 규칙 글에 적는다 |

## 스케줄러

### 다음 기수 초안 (매일 0시)

- 대상: `STUDY_KIND = CLUB` · `AUTO_DRAFT_ENABLED` · 오늘 일자 = `AUTO_DRAFT_DAY`
- 다음 달 `COHORT_MONTH` 기수가 이미 있으면 건너뛴다
- 만드는 것: `STUDY`(`STATUS = DRAFT`, 제목은 프로그램 제목 그대로 — 운영 화면이 `COHORT_MONTH` 로 달을 붙인다, `START_AT` 다음 달 1일, `END_AT` 말일) · `STUDY_RECRUITMENT`(`RECRUIT_DEADLINE_AT` 이번 달 말일 23:59, `START_AT` NULL) · 기본 반 · 날마다 회차
- 이번 기수(같은 프로그램에서 `COHORT_MONTH` 가 가장 늦은 기수)의 소개 · 상세 설명 · 카테고리 · 시간대 · 디스코드 채널 · 드라이브 · 정원 · 신청 폼을 복사한다

### 다음 기수 자동 공개 (매일 0시)

- 대상: `AUTO_DRAFT_ENABLED` · 오늘 일자 ≥ `AUTO_PUBLISH_DAY` · 다음 달 기수가 `DRAFT`
- 기존 공개 처리와 같다 — `DRAFT → OPEN`, 오늘이 `STUDY_RECRUITMENT.START_AT`
- 공개 조건(POL-0003)을 못 맞추면 그대로 두고 아래 「자동 공개 실패 알림」. 다음 날 다시 대상이 된다

#### 자동 공개 실패 알림

- 받는 곳: **담당 캡틴**(`STUDY.OWNER_CAPTAIN_ID` 의 디스코드 계정 — 알림이 울려야 한다) · **스터디클럽 DEV 서버**의 알림 채널
- 내용: 클럽 이름 · 기수 달 · 못 맞춘 공개 조건 · 클럽 운영 화면 주소. 이름 · 메일은 넣지 않는다 (디스코드 ID 멘션만)
- 실패한 날마다 한 번. 같은 날 같은 기수는 한 번만 보낸다 — `Idempotency-Key` = `club-publish-fail:{studyId}:{날짜}`
- 알림이 실패해도 스케줄러는 멈추지 않는다 — 로그를 남기고 다음 클럽을 처리한다
- [NEEDS CLARIFICATION] 봇 쪽 방법 (봇 담당에게 요청)
  - 지금 [`send-alert-message`](../../docs/discord-development-guide/api/send-alert-message.md) 는 **운영 길드 하나**의 alert 채널에만 보내고, 멘션 알림을 모두 끈다(`AllowedMentions.none()`)
  - DEV 서버는 다른 길드다 — 봇이 DEV 서버 채널에도 보낼 수 있게 할지, 웹후크로 보낼지
  - 담당 캡틴에게 알림이 울리게 하려면 — 그 유저 멘션만 허용하는 옵션을 더할지, DM 을 보낼지

### 기수 상태 (매일 0시)

- 클럽 기수는 날짜로 바뀐다 — 네비게이터 첫 미팅 등록 · 종료 처리를 기다리지 않는다
- `COHORT_MONTH` 1일 0시: `OPEN → ONGOING`
- 클럽 기수에는 `CLOSED` 전이가 없다

### 기수 종료 (말일이 끝날 때 — 다음 달 1일 0시)

- 다음 기수가 있든 없든 한다
- `ACTIVE → COMPLETED` · 기수 `ENDED`

### 이어서 참여 (다음 기수 시작일 0시 — 기수 종료 뒤)

1. 다음 달 기수가 없으면 하지 않는다. `DRAFT` 여도 한다
2. 직전 기수 `COMPLETED` 참여자 중 `CLUB_CARRY_OVER_EXCLUSION` 에 없는 사람마다 다음 기수 `STUDY_PARTICIPANT`(`ACTIVE`, 기본 반, `CARRIED_FROM_ID`) — 신청 답 스냅샷 복사
3. 다음 기수에 이미 참여 행이 있으면 만들지 않는다 — 넘어갈 사람의 신청은 아래 「크루 신청」이 막지만, 막기 전에 들어온 신청이나 뺐다가 다시 넣은 경우를 위해 남긴다
4. 한 클럽씩 한 트랜잭션. 실패는 운영 알림으로 남기고 다음 클럽을 처리한다 — 기수 종료는 되돌리지 않는다

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
  "autoDraft": { "enabled": true, "day": 15, "publishDay": 20 },
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
- 초안이면 화면은 `autoDraft.publishDay` 로 자동 공개 날을 안내한다
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
| autoDraftDay | Integer | N | 1~27 | STUDY_PROGRAM.AUTO_DRAFT_DAY |
| autoPublishDay | Integer | N | autoDraftDay 초과 · 28 이하 | STUDY_PROGRAM.AUTO_PUBLISH_DAY |

### Response

- 200 — 「클럽 한 곳」과 같은 본문
- 400 INVALID_INPUT — `autoDraftDay` · `autoPublishDay` 범위 밖, 또는 `autoPublishDay ≤ autoDraftDay`

---

## 다음 기수 초안 지금 만들기

- **Method**: POST · **Path**: `/api/admin/clubs/{programId}/next-cohort`
- 스케줄러와 같은 처리를 즉시 한다

### Response

- 201 — `{ "studyId": 131 }`
- 409 CONFLICT — 다음 달 기수가 이미 있다

---

## 지난 기수

- **Method**: GET · **Path**: `/api/admin/clubs/{programId}/cohorts`
- 끝난 기수만, `COHORT_MONTH` 최신 순

### Response — 200

```json
{
  "cohorts": [
    {
      "studyId": 120,
      "title": "얼리버드 2026년 11월",
      "cohortMonth": "2026-11-01",
      "startedCount": 14,
      "completedCount": 12,
      "withdrawnCount": 2,
      "carriedCount": 11,
      "averageAttendanceRate": 81
    }
  ]
}
```

- `startedCount`: 기수 첫날 참여자 · `carriedCount`: 다음 기수에서 `CARRIED_FROM_ID` 가 이 기수 참여인 수
- `averageAttendanceRate`: 참여자 출석률 평균. 기록이 없으면 `null`

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
      "rosterAnswer": "05:30",
      "attendanceRate": 75,
      "status": "ACTIVE",
      "leftAt": null,
      "excluded": false
    }
  ]
}
```

- `rosterAnswer`: 신청 폼에서 `SHOW_IN_ROSTER` 를 켠 질문의 답. 그런 질문이 없으면 `null`
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
- 허용 값 · 출석률은 스터디와 같다 — `PRESENT` · `LATE` · `ABSENT` · `EXCUSED`, [출석률 산식](../attendance/spec.md) 그대로
- 오늘(KST) 뒤의 회차 · 참여 중단 뒤의 회차면 400
- 끝난 기수도 `updates[]` 를 받는다. `withdrawals[]` 는 진행 중 기수만 — 끝난 기수면 409
- **`reinstatements[]` (새로)** — 참여 중단 취소할 명부 행 ID. `WITHDRAWN → ACTIVE` · `LEFT_AT` 비움. 진행 중 기수만(끝난 기수면 409) · 대상이 `WITHDRAWN` 이 아니면 400 · 권한은 `withdrawals[]` 와 같다(담당 캡틴). 클럽 기수 전용으로 시작한다
- 끝난 기수의 출석을 고쳐도 이어서 참여 결과(`CARRIED_FROM_ID`)는 바꾸지 않는다
- 킥오프 회차가 없다 — 출석률 분모에서 빼는 회차는 휴가뿐이다
- 클럽 회차는 회차 상태 판정(`MISSED`)과 회차 시작 전 알림에서 뺀다

---

## 크루 신청 — 넘어갈 사람은 막는다

기존 [study-application](../study-application/spec.md) 신청 API 의 클럽 차이. 같은 사람이 이어서 참여와 신청으로 두 번 들어가지 않게 한다.

- 「넘어갈 사람」: 신청하려는 기수가 클럽 기수이고, 그 직전 달 기수에서 내 `STUDY_PARTICIPANT.STATUS = ACTIVE` 이고, `CLUB_CARRY_OVER_EXCLUSION` 에 없다
- `GET /api/studies/{studyId}/applications/me` — `carriedOver: Boolean` 을 더한다. 참이면 화면은 버튼을 `신청 완료`(비활성)로 보이고 폼을 열지 않는다
- `POST /api/studies/{studyId}/applications` — 넘어갈 사람이면 `409 CONFLICT`, `errorMessage` 「다음 기수로 이어서 참여합니다. 따로 신청하지 않아도 돼요.」 — 이미 신청 검사 다음, 모집 기간 검사 전에 본다
- 직전 기수에서 참여 중단했거나 캡틴이 뺐으면 `carriedOver=false` — 바로 신청할 수 있다

---

## 퍼널·계측

- 퍼널 단계: 재방문 — 클럽 재참여율(`CARRIED_FROM_ID` 가 있는 참여 ÷ 직전 기수 참여)
- 추가 이벤트 없음
