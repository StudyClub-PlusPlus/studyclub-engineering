# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md)
> 생성일: 2026-09-08 (GET) · 2026-09-11 (POST 절 추가 · STUDY/STUDY_COHORT 스키마 변경)
> 갱신: 2026-09-19 — 신청 폼·제출·결과 API 는 [study-application/spec.md](../study-application/spec.md) 로 분리

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 (fixture) |
| GET | /api/studies/{studyId} | 스터디 상세 조회 | X | 스펙확정 |
| POST | /api/studies | 스터디 등록 | O (ADMIN) | 스펙확정 |

신청 폼 설계 · 신청 제출 · 신청 결과 · 디스코드 연동은 [study-application/spec.md](../study-application/spec.md). 옛 경로 `PATCH /api/studies/{studyId}/cohorts/{cohortId}/application-form` 은 폐기.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

> 목록·상세 응답의 `cohort.recruitStatus`(모집중/모집마감 파생 판정)와 `cohort.currentApplicants`
> 의 집계 기준은 [study-recruit-status/spec.md](../study-recruit-status/spec.md) 가 정본이다.

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
    "recruitStatus": "RECRUITING",
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
| cohort.status | String | N | 코호트 라이프사이클 (enum) — 사람이 정한다 | STUDY_COHORT.STATUS |
| cohort.recruitStatus | String | Y | 모집 상태 (enum) `RECRUITING` / `RECRUIT_CLOSED`. `status != OPEN` 이면 null | 계산: 마감 시각 경과 또는 정원 도달 → [상세](../study-recruit-status/spec.md#판정-규칙) |
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

## 신청 폼 · 신청 · 결과

유저스토리 「캡틴은 스터디 신청용 폼을 작성할 수 있다」·「크루는 스터디 신청 폼을 제출할 수 있다」·「캡틴은 스터디 신청서 결과를 모아볼 수 있다」는 [study-application/spec.md](../study-application/spec.md) 가 정본이다.

결정 요약 (상세는 그쪽):

- 저장 위치는 `STUDY.APPLICATION_FORM` (기수). 신청 행은 `STUDY_APPLICATION.RECRUITMENT_ID` (모집 회차)
- 이름·이메일은 폼에 두지 않고 계정에서 읽는다. 디스코드 별명·참여 요일은 플랫폼 기본 문항
- 질문 설명은 여러 줄 마크다운 원문
