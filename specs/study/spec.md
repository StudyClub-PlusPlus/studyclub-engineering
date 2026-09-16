# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md)
> 생성일: 2026-09-08 (GET) · 2026-09-11 (POST 절 추가 · STUDY/STUDY_COHORT 스키마 변경)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 (fixture) |
| GET | /api/studies/{studyId} | 스터디 상세 조회 | X | 스펙확정 |
| POST | /api/studies | 스터디 등록 | O (ADMIN) | 스펙확정 |
| PATCH | /api/studies/{studyId}/cohorts/{cohortId}/application-form | 신청 폼 설계 | O (캡틴) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

---

## 스터디 목록 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies`
- **인증**: 불필요 (공개)
- **설명**: 공개된 스터디 목록을 조회한다

### 상태

구현완료 (fixture) — 하드코딩된 fixture 데이터를 반환하는 상태이며, 필드 단위 스펙은 아직 작성되지 않았다. 실제 테이블 연결 및 필드 스펙 작성은 별도로 필요하다.

---

## 스터디 상세 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 불필요 (공개)
- **설명**: 스터디 ID 로 스터디 정체성 + 최신 코호트 정보를 조회한다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Query Parameters

없음

### Request Body

없음

### Response — 200

```json
{
  "id": 1,
  "slug": "algorithm-study",
  "title": "알고리즘 스터디",
  "oneLineSummary": "매주 알고리즘 문제를 풀고 코드 리뷰합니다.",
  "description": "매주 알고리즘 문제를 풀고 코드 리뷰하는 스터디",
  "category": "BACKEND",
  "studyKind": "STUDY",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "cohort": {
    "id": 1,
    "deliveryFormat": "ONLINE",
    "status": "OPEN",
    "curriculum": "[{\"week\":1,\"topic\":\"배열\"}]",
    "capacity": 20,
    "recruitDeadline": "2026-10-01T00:00:00Z",
    "publishDate": null,
    "schedule": "매주 목 20:00 · 8주 과정",
    "startDate": "2026-10-15T00:00:00Z",
    "endDate": "2026-12-15T00:00:00Z"
  }
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 스터디 ID | STUDY.ID |
| slug | String | N | URL 식별자 | STUDY.SLUG |
| title | String | N | 스터디 제목 | STUDY.TITLE |
| oneLineSummary | String | N | 한 줄 소개 | STUDY.ONE_LINE_SUMMARY (신규) |
| description | String | Y | 상세 소개 | STUDY.DESCRIPTION |
| category | String | N | 분야 (enum) | STUDY.CATEGORY |
| studyKind | String | N | STUDY / CLUB | STUDY.STUDY_KIND |
| thumbnailUrl | String | Y | 썸네일 | STUDY.THUMBNAIL_URL |
| cohort | Object | Y | 최신 코호트. 코호트가 없으면 null | — |
| cohort.id | Long | N | 코호트 ID | STUDY_COHORT.ID |
| cohort.deliveryFormat | String | N | 진행 방식 (enum) | STUDY_COHORT.STUDY_DELIVERY_FORMAT |
| cohort.status | String | N | 코호트 상태 (enum) | STUDY_COHORT.STATUS |
| cohort.curriculum | String | Y | 커리큘럼 JSON | STUDY_COHORT.CURRICULUM |
| cohort.capacity | Integer | Y | 정원 | STUDY_COHORT.CAPACITY |
| cohort.recruitDeadline | String | Y | 모집 마감 (ISO 8601 UTC). null = 상시 모집 | STUDY_COHORT.RECRUIT_DEADLINE (변경: NULL 허용) |
| cohort.publishDate | String | Y | 공개일 (ISO 8601 UTC). null = 즉시 공개 | STUDY_COHORT.PUBLISH_DATE (신규) |
| cohort.schedule | String | Y | 진행 일정 (자유 텍스트) | STUDY_COHORT.SCHEDULE (신규) |
| cohort.startDate | String | Y | 시작일 (ISO 8601 UTC) | STUDY_COHORT.START_DATE |
| cohort.endDate | String | Y | 종료일 (ISO 8601 UTC) | STUDY_COHORT.END_DATE |

> **소스**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}`

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |
| 404 | NOT_FOUND | 스터디가 숨김 상태 (isHidden=true) |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/studies/[id]/page.tsx` — 상세 페이지
- `frontend/apps/core-front/src/lib/content.ts` — `getStudy(id)` mock 함수

### 미확정

- [NEEDS CLARIFICATION] cohort 선택 전략: 현재는 studyId 기준 최신(ID 역순) 1개. CLUB 에서 여러 OPEN 코호트가 있을 때 어떤 걸 보여줄지
- [NEEDS CLARIFICATION] isHidden=true 스터디를 404 로 처리할지, 응답에 포함하되 FE 에서 걸러낼지

---

## 스터디 등록

> 유저스토리: 운영자(ADMIN)가 새 스터디와 최초 코호트를 함께 등록한다.

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies`
- **인증**: 필요 — `ACCOUNT.SYSTEM_ROLE=ADMIN` 만 (지금 단계에서는 **캡틴 = 운영자**. 일반 회원에게 셀프서비스로 캡틴 자격을 여는 건 이후 Story)
- **설명**: 캡틴(=ADMIN)이 새 스터디(`STUDY_KIND=STUDY`)와 그 최초 코호트(`STUDY_COHORT`, `STATUS=DRAFT`)를 함께 만든다. ERD 상 "코호트 없는 STUDY"는 없으므로 항상 같이 생성한다.

### Request Body

```json
{
  "title": "AI 논문 스터디",
  "oneLineSummary": "AI 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI_ML",
  "thumbnailUrl": null,
  "cohort": {
    "recruitDeadline": "2026-11-01T00:00:00Z",
    "publishDate": null,
    "schedule": "매주 목 20:00 · 8주 과정"
  }
}
```

| 필드 | 타입 | 필수 | 검증 | 소스 |
|------|------|------|------|------|
| title | String | Y | 1~60자 (trim 후) | STUDY.TITLE |
| oneLineSummary | String | Y | 비어 있으면 등록 불가 | STUDY.ONE_LINE_SUMMARY |
| description | String | N | — | STUDY.DESCRIPTION |
| category | String | Y | 유효한 enum 값 중 하나 | STUDY.CATEGORY |
| thumbnailUrl | String | N | — | STUDY.THUMBNAIL_URL |
| cohort | Object | Y | — | — |
| cohort.recruitDeadline | String | N | null = 상시 모집. 값이 있으면 미래여야 함. cohort.publishDate 보다 같거나 늦어야 함 | STUDY_COHORT.RECRUIT_DEADLINE |
| cohort.publishDate | String | N | null = 즉시 공개. 값이 있으면 ≤ cohort.recruitDeadline. recruitDeadline이 null(상시 모집)인 경우 publishDate 값 제약 없음 | STUDY_COHORT.PUBLISH_DATE |
| cohort.schedule | String | N | 자유 텍스트 | STUDY_COHORT.SCHEDULE |

**서버가 자동으로 채우는 필드 (요청에 포함하지 않음):**

| 필드 | 고정값 | 비고 |
|------|--------|------|
| STUDY.SLUG | `{slug}-{id}` | 서버 자동 생성 — 생성 규칙 미확정 |
| STUDY.STUDY_KIND | `STUDY` | 등록 시 항상 고정. CLUB 전환은 별도 운영 액션 |
| STUDY.IS_HIDDEN | `false` | 등록 시 기본 공개 |
| STUDY_COHORT.STUDY_DELIVERY_FORMAT | `ONLINE` | 등록 시 기본값 |
| STUDY_COHORT.STATUS | `DRAFT` | 등록 후 ADMIN이 직접 OPEN 으로 전환 |
| STUDY_COHORT.CAPACITY | `null` | 등록 시 미설정 |

### Response — 201 No Content

응답 바디 없음. `Location` 헤더에 생성된 스터디 URI를 담는다.

```
Location: /api/studies/{id}
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | title·oneLineSummary·category 누락, title 60자 초과, category 가 유효하지 않은 값, cohort.publishDate > cohort.recruitDeadline. 실패한 필드 전부를 `필드명: 사유` 형태로 응답 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `SYSTEM_ROLE` 이 `ADMIN` 아님 |

500(저장 실패)은 별도 errorCode 없이 처리.

### 프론트엔드 사용처

미확인 — 콘솔 프론트의 등록 모달 경로 확인 필요

### 미확정

- ~~권한 범위~~ → **결정**: `SYSTEM_ROLE=ADMIN` 만 개설 가능 ("캡틴 = 운영자", 지금 단계). 일반 회원에게 캡틴 자격을 부여하는 신청/승인 플로우는 범위 밖 — 필요해지면 별도 Story
- ~~캡틴 ↔ STUDY_PARTICIPANT 연결~~ → **결정**: 개설과 동시에 기본 반(`STUDY_CLASS`) 1개를 생성하고, 개설자를 그 반의 `STUDY_PARTICIPANT`(`PARTICIPANT_ROLE=LEADER`, `STATUS=ACTIVE`)로 편입한다
- ~~DRAFT → OPEN 전환 주체~~ → **결정**: 개설자(=ADMIN)가 직접 전환한다. 별도 승인 단계 없음 — ERD 상태 다이어그램의 "운영자 공개"를 개설자 본인이 수행하는 것으로 해석
- ~~상시 모집~~ → **결정**: `STUDY_COHORT.RECRUIT_DEADLINE` 을 NULL 허용으로 변경 (V8 마이그레이션). null = 상시 모집

---

## 신청 폼 설계

> 유저스토리: "캡틴은 스터디 폼을 작성할 수 있다" 2단계 — 개설한 코호트의 신청서 질문을 캡틴이 직접 구성.
> > `STUDY_COHORT.APPLICATION_FORM` (JSON) 을 채우는 엔드포인트. ERD 는 이 컬럼의 구조(JSON 자유형 vs `STUDY_QUESTION`+`STUDY_APPLICATION_ANSWER` 정규화 테이블)를 팀 회의 미확정으로 남겨뒀는데, 이 스펙에서는 **일단 JSON 유지로 결정** — 정규화는 필요해지면 재검토(ERD README 의 해당 미확정 항목 자체는 팀 확정 전까지 그대로 둔다).

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/studies/{studyId}/cohorts/{cohortId}/application-form`
- **인증**: 필요 — `SYSTEM_ROLE=ADMIN` **이면서** 이 코호트의 `STUDY_PARTICIPANT(LEADER)` 본인 (다른 캡틴의 스터디 폼은 못 건드림)
- **설명**: 코호트의 신청 폼 질문 목록을 통째로 교체한다. **모집 시작 전일 때만** 수정할 수 있다

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| cohortId | Long | 코호트 ID |

### Request Body

```json
{
  "questions": [
    { "id": "q1", "label": "지원 동기를 알려주세요", "type": "TEXTAREA", "required": true },
    { "id": "q2", "label": "가능한 요일", "type": "CHECKBOX", "required": true, "options": ["월", "화", "수"] }
  ]
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| questions[].id | String | Y | 질문 식별자 — `STUDY_APPLICATION.FORM_ANSWER` 에서 이 id 로 답을 매핑 |
| questions[].label | String | Y | |
| questions[].type | String | Y | enum — `TEXT`(단답형) / `TEXTAREA`(장문형) / `RADIO`(객관식) / `CHECKBOX`(체크박스) / `SELECT`(드롭다운) |
| questions[].required | Boolean | Y | |
| questions[].options | String[] | type=RADIO·CHECKBOX·SELECT 일 때 Y | |
| questions[].allowOther | Boolean | N | type=RADIO·CHECKBOX 일 때 「기타」 자유 입력 |
| questions[].placeholder | String | N | type=TEXT·TEXTAREA 안내 예시 |

### Response — 200

`STUDY_COHORT.APPLICATION_FORM` 저장 후 요청 바디와 동일한 shape 반환.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `SYSTEM_ROLE` 이 `ADMIN` 아님, 또는 이 코호트의 캡틴(LEADER)이 아님 |
| 404 | NOT_FOUND | studyId/cohortId 불일치 또는 없음 |
| 409 | CONFLICT | 모집이 이미 시작된 뒤 신청 폼을 수정하려 할 때 |

### 미확정

- [NEEDS CLARIFICATION] 계정 필드(이름·이메일·디스코드 별명) 처리 방식 — 신청 폼에 포함할지, 계정에서 자동으로 읽을지

---

## 명부 · 출석 — 스코프

> 이번 스코프는 명부 화면을 띄우는 데 필요한 **조회 1개 + 생성 1개** API만 다룬다. 세션 취소, 휴가 신청·승인, 정정 이력 조회 등 나머지 CRUD는 별도 스펙.
> `[OPEN]` = 캡틴 확정 전 제안 기본값 / 팀 확인 필요.

**GET과 POST는 같은 경로를 쓴다** — `/api/studies/{studyId}/cohorts/{cohortId}/attendances`. 같은 리소스(코호트의 출석 컬렉션)를 메서드로만 구분: GET은 읽고, POST는 upsert한다. 별도의 "미팅 목록" 엔드포인트는 없다 — 미팅 목록도 GET 응답 안의 `meetings[]`로 함께 내려간다.

### 관련 데이터 모델

> 전체 스키마는 [`docs/erd/`](../../docs/erd/README.md).

```
STUDY {
  id: long, title   // cohort.name 출처 — STUDY_COHORT에 name 컬럼 없음
}

STUDY_COHORT {
  id: long, study_id: long
}

STUDY_CLASS {
  id: long, study_cohort_id: long
  // STUDY_MEETING / STUDY_PARTICIPANT 모두 cohort가 아닌 class에 귀속.
  // cohort 단위 조회는 이 테이블을 경유해서 JOIN한다.
}

STUDY_MEETING {
  id: long, study_class_id: long, scheduled_at,
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'DONE' | 'MISSED' | 'CANCELLED'
  // ⚠️ STATUS 컬럼 신규 추가 필요 — 현재 ERD 미존재, 마이그레이션 필요.
  // CANCELLED는 운영자가 명시적으로 세팅하는 저장값.
  // 나머지는 scheduled_at / starts_at / ends_at 으로 계산.
}

STUDY_PARTICIPANT {
  id: long, account_id: long, study_class_id: long, study_cohort_id: long (비정규화),
  joined_at, status: 'ACTIVE' | 'PAUSED' | 'WITHDRAWN' | 'COMPLETED'
}

STUDY_ATTENDANCE {
  id: long, study_meeting_id: long (FK → STUDY_MEETING), account_id: long (FK → ACCOUNT),
  study_cohort_id: long (비정규화), study_class_id: long (비정규화),
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED'
}
```

- `UNIQUE(study_meeting_id, account_id)`.
- `status='EXCUSED'`는 이 스코프에서는 POST 호출로 직접 세팅되는 경로만 다룬다.
- 정정 이력 테이블(AttendanceEditLog)은 현재 ERD에 없음 — 구현 시 스키마 추가 필요. 이 스펙의 계약: "이 API 호출은 반드시 이력을 남긴다".

---

## 출석 명부 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}/cohorts/{cohortId}/attendances`
- **인증**: 필요 — 담당 캡틴
- **설명**: 코호트의 전체 명부(모든 회차 × 모든 참가자)를 기본으로 반환. `meetingId` 쿼리 파라미터로 특정 회차 하나만 필터링 가능 — 응답 구조는 동일, 내용만 좁아짐

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| cohortId | Long | 코호트 ID |

### Query Parameters

| 이름 | 타입 | 필수 | 설명 |
|------|------|------|------|
| meetingId | Long | N | 특정 회차 하나만 필터링. 이 코호트 소속이 아니거나 존재하지 않으면 422 |

### Request Body

없음

### 조회 로직 — 5개 테이블 스티칭

단일 SQL JOIN으로 안 풀리는 이유: 출석률 계산에 "참가자 합류일 이전 미팅 제외" 같은 조건부 로직이 들어가서 애플리케이션 레이어에서 한 번 더 필터링이 필요하다. 각 테이블을 따로 조회하고, 합치는 것과 산식 계산은 서비스 레이어에서 한다.

```
1. STUDY_COHORT JOIN STUDY  WHERE STUDY_COHORT.id = cohortId
                                  AND STUDY_COHORT.study_id = studyId
                             → 헤더 정보. cohort.name = STUDY.title

2. STUDY_CLASS               WHERE study_cohort_id = cohortId
                             → 반 목록 (경유 키 역할)

3. STUDY_PARTICIPANT         WHERE study_class_id IN (2의 id 목록)
                             → 참가자 목록. joined_at / status 포함

4. STUDY_MEETING             WHERE study_class_id IN (2의 id 목록) ORDER BY scheduled_at
                             → 미팅 목록 (전체)

5. STUDY_ATTENDANCE          WHERE study_meeting_id IN (4의 id 목록)
                             → 출석 값. (study_meeting_id, account_id)로 매핑

6. 서비스 레이어:
   - 3 × 4 매트릭스 생성, 5의 값으로 셀 채움 (없으면 status=null)
   - editable 계산 (아래 Response 참고)
   - 참가자별 attendanceRate 계산 (출석률 산식 절 참고) — meetingId 필터 여부와 무관하게 항상 코호트 전체 기준
   - 코호트 평균(가중평균) 계산 — 역시 코호트 전체 기준

7. meetingId 쿼리 파라미터가 있으면, 6까지 다 계산한 뒤 마지막에
   meetings[]와 각 참가자의 attendances[]를 그 미팅 하나로 필터링한다.
   필터는 응답을 "잘라내는" 것이지, 계산 자체를 줄이지 않는다.
```

### Response — 200

응답 구조는 `meetingId` 필터 유무와 무관하게 항상 동일하다 — 필터가 있으면 `meetings`와 각 참가자의 `attendances`가 원소 1개짜리 배열이 될 뿐, 필드 자체가 없어지거나 형태가 바뀌지 않는다.

```json
{
  "cohort": {
    "id": 1,
    "name": "System Design Interview Study",
    "participantCount": 7,
    "totalMeetings": 6,
    "avgAttendanceRate": 0.82
  },
  "meetings": [
    { "id": 1, "scheduledAt": "2026-09-21T20:00:00+09:00", "status": "SCHEDULED" }
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

| 필드 | 타입 | NULL | 설명 |
|------|------|------|------|
| cohort.id | Long | N | 코호트 ID |
| cohort.name | String | N | STUDY.TITLE |
| cohort.participantCount | Int | N | 전체 참가자 수 |
| cohort.totalMeetings | Int | N | 전체 회차 수 |
| cohort.avgAttendanceRate | Double | Y | 코호트 가중평균. 분모 0이면 null |
| meetings[].id | Long | N | 미팅 ID |
| meetings[].scheduledAt | String | N | 예정 시각 (ISO 8601) |
| meetings[].status | String | N | `SCHEDULED \| IN_PROGRESS \| DONE \| MISSED \| CANCELLED` |
| participants[].participantId | Long | N | STUDY_PARTICIPANT.ID |
| participants[].displayName | String | N | ACCOUNT.NICKNAME |
| participants[].attendances[].meetingId | Long | N | |
| participants[].attendances[].status | String | Y | `PRESENT \| LATE \| ABSENT \| EXCUSED \| null`. null = 미입력 |
| participants[].attendanceRate | Double | Y | 개인 누적 출석률. 분모 0이면 null → 화면은 "–" 표시 |

- 모든 status 값은 대문자로 내려간다. 서버 파싱은 대소문자 무관하게 처리한다.

### 출석률 산식

```
개인 출석률(participant) =
  분모 = 0이면 null ("–")
  else Σ(가중치) / countable_meetings

가중치: PRESENT=1.0, LATE=W(기본 0.5, [OPEN]), ABSENT=0
countable_meetings = 코호트의 미팅 중
  status != 'CANCELLED'
  AND scheduled_at <= now()
  AND scheduled_at >= participant.joined_at
  AND participant.status IN ('ACTIVE', 'PAUSED')
      [OPEN] PAUSED 참가자를 분모에 포함할지 여부 확정 필요.
      LEFT_AT 없이는 WITHDRAWN/COMPLETED 참가자의 탈퇴 이전 회차를 정확히 필터하기 어려움.
  AND 해당 미팅의 STUDY_ATTENDANCE.status != 'EXCUSED'   // 분모에서도 제외

코호트 평균 = 분모 0인 참가자는 제외하고 Σ(개인 분자) / Σ(개인 분모)   // 가중평균
```

검증: 수아(출석·지각) = (1+0.5)/2 = 75%, 시우(출석만) = 1/1 = 100%.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 403 | FORBIDDEN | 담당 코호트 아님 |
| 404 | NOT_FOUND | 존재하지 않는 studyId |
| 404 | NOT_FOUND | 존재하지 않는 cohortId |
| 404 | NOT_FOUND | cohortId의 study_id가 경로의 studyId와 다름 |
| 422 | INVALID_INPUT | meetingId가 이 코호트 소속이 아니거나 존재하지 않음 |

미팅이 하나도 없으면 200, `meetings: []`, `participants[].attendances: []`, `avgAttendanceRate: null`.

### 미확정

- `[OPEN]` LATE 가중치 W (기본 0.5) — 운영 정책 확정 필요
- `[OPEN]` PAUSED 참가자 출석률 분모 포함 여부

---

## 출석 생성/수정 (upsert)

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies/{studyId}/cohorts/{cohortId}/attendances`
- **인증**: 필요 — 담당 캡틴
- **설명**: 코호트 안에서 하나 이상의 미팅 × 참가자 조합에 대해 출석 상태를 한 번에 기록. 여러 회차에 걸친 정정 + 신규 입력이 한 요청에 섞여도 됨. row가 없으면 INSERT, 있으면 UPDATE.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |
| cohortId | Long | 코호트 ID |

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
| updates[].meetingId | Long | Y | cohortId에 속한 StudyMeeting.id여야 함 → 아니면 422 |
| updates[].participantId | Long | Y | cohortId에 속한 StudyParticipant.id여야 함 → 아니면 422 |
| updates[].status | String | Y | `PRESENT \| LATE \| ABSENT \| EXCUSED`. 허용값 외 → 422 |
| updates[] 내 (meetingId, participantId) 중복 | — | — | 금지 → 422 |

### Response — 200

```json
[
  { "participantId": 20, "attendanceRate": 0.83 },
  { "participantId": 10, "attendanceRate": 1.0 },
  { "participantId": 30, "attendanceRate": 1.0 }
]
```

- 이번 배치가 건드린 참가자당 한 줄, 모든 변경이 반영된 최종 출석률.
- create/update 여부는 응답에 담지 않는다 — 구분은 AttendanceEditLog.from_status가 담당.

### 서버 동작

각 `updates[]` 항목마다:

1. `participantId`로 `account_id`를 조회한 뒤 `(study_meeting_id, account_id)`로 기존 row 조회.
2. 있으면 update, 없으면 생성. 이전 `status`가 `AttendanceEditLog.from_status` (없으면 null = create).
3. `status='EXCUSED'`는 내부적으로 승인된 LeaveRequest 생성/연결.
4. `AttendanceEditLog`에 `from_status → to_status` 기록 — 빠지면 버그.
5. 배치 전체를 하나의 트랜잭션으로 묶음 (all-or-nothing). `[OPEN]`
6. `(study_meeting_id, account_id)` unique 제약으로 동시 insert race를 409로 전환.
7. 변경된 참가자 집합에 대해서만 rate 재계산 후 응답 배열에 반영.

### 동시성

코호트당 담당 네비게이터 1인이라 동시 충돌 가능성 낮음 — 1차는 last-write-wins, 낙관적 잠금 없음. unique 제약 위반은 409로 매핑. `[OPEN]` — 필요시 버전 체크 추가.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | updates가 빈 배열 |
| 403 | FORBIDDEN | 담당 코호트 아님 |
| 404 | NOT_FOUND | 존재하지 않는 studyId 또는 cohortId |
| 409 | CONFLICT | 대상 미팅 중 status='CANCELLED' 포함 (배치 전체 거부, 원인 meetingId 명시) |
| 409 | CONFLICT | 동시 쓰기로 unique 제약 위반 |
| 422 | INVALID_INPUT | updates[].meetingId가 코호트 소속 아니거나 존재하지 않음 |
| 422 | INVALID_INPUT | updates[].participantId가 코호트 소속 아님 |
| 422 | INVALID_INPUT | updates[].status 허용값 외 |
| 422 | INVALID_INPUT | updates[] 내 (meetingId, participantId) 중복 |

### 미확정

- `[OPEN]` 배치 트랜잭션 범위 — all-or-nothing 확정 필요
- `[OPEN]` 버전 체크(낙관적 잠금) 필요 여부
