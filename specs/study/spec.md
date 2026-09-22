# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_RECRUITMENT](../../docs/erd/STUDY_RECRUITMENT.md)
> 생성일: 2026-09-08 (GET) · 2026-09-11 (POST 절 추가)
> 갱신: 2026-09-19 — 신청 폼·제출·결과 API 는 [study-application/spec.md](../study-application/spec.md) 로 분리
> 갱신: 2026-09-20 — STUDY_COHORT 테이블 폐기. 코호트 필드는 STUDY 로 통합, 모집 마감은 STUDY_RECRUITMENT 로 분리. 응답·요청 구조 반영
> 갱신: 2026-09-21 — PATCH/DELETE 스펙 추가
> 갱신: 2026-09-22 — 목록 카드가 `startAt` 을 표시하도록 playground 변경. 목록 응답 필드 스펙(미작성)에 `startAt` 포함 필요 — 아래 미확정 참고

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 |
| GET | /api/studies/{studyId} | 스터디 상세 조회 | X | 스펙확정 |
| POST | /api/studies | 스터디 등록 | O (ADMIN) | 스펙확정 |
| PATCH | /api/studies/{studyId} | 스터디 수정 | O (캡틴·네비게이터) | 스펙확정 |
| DELETE | /api/studies/{studyId} | 스터디 삭제 | O (캡틴) | 스펙확정 |

신청 폼 설계 · 신청 제출 · 신청 결과 · 디스코드 연동은 [study-application/spec.md](../study-application/spec.md). 옛 경로 `PATCH /api/studies/{studyId}/cohorts/{cohortId}/application-form` 은 폐기.

> **STUDY_COHORT 폐기**: 이 스펙은 초기에 `STUDY_COHORT` 테이블을 별도로 두었으나, 실제 도메인 모델은 코호트 필드를 `STUDY` 에 통합했다. 모집 마감·정원은 `STUDY_RECRUITMENT` 가 담당한다.

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

> 목록·상세 응답의 `recruitStatus`(모집중/모집마감 파생 판정)와 `currentApplicants`
> 의 집계 기준은 [study-recruit-status/spec.md](../study-recruit-status/spec.md) 가 정본이다.

---

## 스터디 목록 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies`
- **인증**: 불필요 (공개)
- **설명**: 공개된 스터디 목록을 조회한다

### 상태

구현완료 — DB 기반으로 동작 중 (카테고리·상태·키워드·마감일 필터 포함). 필드 단위 응답 스펙은 미작성.

> **FE 사용처 갱신(2026-09-22)**: 사용자 사이트 목록·상세 카드가 시작일(`startAt`)을 항상 표시한다.
> 필드 단위 응답 스펙을 쓸 때 `startAt` 을 반드시 포함할 것 — 상세 조회 응답과 같은 소스(`STUDY.START_AT`)다.
> 모집 마감일은 카드에 따로 텍스트로 두지 않고, 상단 상태 배지(`모집중 (D-N)`·`상시 모집`·`진행중`·`모집 마감`)로만 표현한다 —
> `recruitDeadline`·`recruitStatus` 로 계산한다. D-N 산정은 `recruitDeadline` 하나면 된다.
> 목록에서는 정렬·신청하기·찜을 더 이상 제공하지 않는다(둘러보기 전용으로 축소). 상세는 신청하기를 그대로 유지한다.
> playground 근거: [crew-browse-studies PRD](../../planning/stories/crew-browse-studies/PRD.md)

---

## 스터디 상세 조회

### 기본 정보

- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 불필요 (공개)
- **설명**: 스터디 ID 로 스터디 정보를 조회한다

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
  "programId": 1,
  "slug": "algorithm-study",
  "title": "알고리즘 스터디",
  "oneLineSummary": "매주 알고리즘 문제를 풀고 코드 리뷰합니다.",
  "description": "매주 알고리즘 문제를 풀고 코드 리뷰하는 스터디",
  "category": "BACKEND",
  "studyKind": "STUDY",
  "thumbnailUrl": "https://example.com/thumb.jpg",
  "deliveryFormat": "ONLINE",
  "status": "OPEN",
  "recruitStatus": "RECRUITING",
  "curriculum": "[{\"week\":1,\"topic\":\"배열\"}]",
  "capacity": 20,
  "recruitDeadline": "2026-10-01T00:00:00Z",
  "publishAt": null,
  "schedule": "매주 목 20:00 · 8주 과정",
  "startAt": "2026-10-15T00:00:00Z",
  "endAt": "2026-12-15T00:00:00Z"
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | 스터디 ID | STUDY.ID |
| programId | Long | N | 스터디 프로그램 ID | STUDY.PROGRAM_ID |
| slug | String | N | URL 식별자 | STUDY.SLUG |
| title | String | N | 스터디 제목 | STUDY.TITLE |
| oneLineSummary | String | N | 한 줄 소개 | STUDY.ONE_LINE_SUMMARY |
| description | String | Y | 상세 소개 | STUDY.DESCRIPTION |
| category | String | N | 분야 (enum). 유효값은 아래 표 참조 | STUDY.CATEGORY |
| studyKind | String | N | STUDY / CLUB | STUDY.STUDY_KIND |
| thumbnailUrl | String | Y | 썸네일 | STUDY.THUMBNAIL_URL |
| deliveryFormat | String | N | 진행 방식 (enum) | STUDY.STUDY_DELIVERY_FORMAT |
| status | String | N | 라이프사이클 (enum) — 사람이 정한다. DRAFT / OPEN / CLOSED | STUDY.STATUS |
| recruitStatus | String | Y | 모집 상태 (enum). `status != OPEN` 이면 null | 계산: STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT 경과 또는 정원 도달 → [상세](../study-recruit-status/spec.md#판정-규칙) |
| curriculum | String | Y | 커리큘럼 JSON | STUDY.CURRICULUM |
| capacity | Integer | Y | 전체 정원 | STUDY.CAPACITY |
| recruitDeadline | String | Y | 모집 마감 (ISO 8601 UTC). null = 상시 모집 | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT — id 최대인 회차 1건 |
| publishAt | String | Y | 공개 예정 일시 (ISO 8601 UTC). null = 즉시 공개 | STUDY.PUBLISH_AT |
| schedule | String | Y | 진행 일정 (자유 텍스트) | STUDY.SCHEDULE |
| startAt | String | Y | 시작일 (ISO 8601 UTC) | STUDY.START_AT |
| endAt | String | Y | 종료일 (ISO 8601 UTC) | STUDY.END_AT |

> **소스**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}`

#### category 유효값 (StudyCategory enum)

| 코드 | 라벨 |
|------|------|
| `AI_ML` | AI · ML |
| `CS` | CS · 알고리즘 |
| `DATA` | 데이터 |
| `BACKEND` | 백엔드 |
| `FRONTEND` | 프론트엔드 |
| `MOBILE` | 모바일 |
| `PLANNING` | 기획 |
| `PM` | PM |
| `DESIGN` | 디자인 |
| `CAREER` | 커리어 |
| `LANGUAGE` | 어학 |
| `LIFESTYLE` | 라이프스타일 |
| `BUSINESS` | 비즈니스 |
| `OTHER` | 기타 |

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |
| 404 | NOT_FOUND | 스터디가 숨김 상태 (isHidden=true) |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/studies/[id]/page.tsx` — 상세 페이지
- `frontend/apps/core-front/src/lib/content.ts` — `getStudy(id)` mock 함수

### 미확정

- [NEEDS CLARIFICATION] CLUB 에서 같은 STUDY_PROGRAM 아래 여러 STUDY 가 있을 때 어떤 기수를 기본으로 보여줄지 (현재는 studyId 직접 지정)
- [NEEDS CLARIFICATION] isHidden=true 스터디를 404 로 처리할지, 응답에 포함하되 FE 에서 걸러낼지
- [NEEDS CLARIFICATION] `startAt`/`endAt` 입력 경로 — 등록(POST)·수정(PATCH) 요청 본문에 없다. 응답에는 있지만 누가·언제 채우는지 미정. FE 는 이 값이 비어 있을 걸 가정하고 다른 필드(대표 날짜·킥오프 문구·모집 마감일)로 추정해 표시 중 — [crew-browse-studies PRD](../../planning/stories/crew-browse-studies/PRD.md) 참고

---

## 스터디 등록

> 유저스토리: 운영자(ADMIN)가 새 스터디를 등록한다.

### 인수 기준

| ID | 기준 |
|----|------|
| AC-1 | title·oneLineSummary·category 세 필수 항목을 채우면 등록된다 |
| AC-2 | 등록한 스터디는 공개 API(`STATUS=DRAFT`)에 노출되지 않는다. 운영 콘솔 조회에는 포함된다 |
| AC-3 | recruitDeadline 을 지정하면 그날이 지나면 `RECRUIT_CLOSED` 로 판정된다 |
| AC-4 | recruitDeadline 을 비우면 마감 없이 계속 모집한다 |
| AC-5 | category 가 목록 카드 색·아이콘의 기준이다 |

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies`
- **인증**: 필요 — `ACCOUNT.SYSTEM_ROLE=ADMIN` 만 (지금 단계에서는 **캡틴 = 운영자**. 일반 회원에게 셀프서비스로 캡틴 자격을 여는 건 이후 Story)
- **설명**: 캡틴(=ADMIN)이 새 스터디(`STUDY_KIND=STUDY`, `STATUS=DRAFT`)를 등록한다. `STUDY_RECRUITMENT` 행 1개를 항상 함께 생성한다. `recruitDeadline` 미전송/null 이면 `RECRUIT_DEADLINE_AT=null` (상시 모집).

### Request Body

```json
{
  "title": "AI 논문 스터디",
  "oneLineSummary": "AI 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI_ML",
  "thumbnailUrl": null,
  "recruitDeadline": "2026-11-01T00:00:00Z",
  "schedule": "매주 목 20:00 · 8주 과정"
}
```

| 필드 | 타입 | 필수 | 검증 | 소스 |
|------|------|------|------|------|
| studyProgramId | Long | N | null 이면 title 로 StudyProgram 자동 생성. 값이 있으면 해당 프로그램이 존재해야 함 | STUDY.PROGRAM_ID (STUDY_PROGRAM 참조) |
| title | String | Y | 1~60자 (trim 후) | STUDY.TITLE |
| oneLineSummary | String | Y | 비어 있으면 등록 불가 | STUDY.ONE_LINE_SUMMARY |
| description | String | N | — | STUDY.DESCRIPTION |
| category | String | Y | StudyCategory enum 값 중 하나. 유효값은 GET 응답의 enum 표 참조 | STUDY.CATEGORY |
| thumbnailUrl | String | N | — | STUDY.THUMBNAIL_URL |
| recruitDeadline | String | N | null 또는 미전송 = 상시 모집. 값이 있으면 미래여야 함 | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT (nullable). 항상 STUDY_RECRUITMENT 행 1개 함께 생성 |
| schedule | String | N | 자유 텍스트 | STUDY.SCHEDULE |

**서버가 자동으로 채우는 필드 (요청에 포함하지 않음):**

| 필드 | 고정값 | 비고 |
|------|--------|------|
| STUDY.SLUG | `{slug}-{id}` | 서버 자동 생성 — 생성 규칙 미확정 |
| STUDY.STUDY_KIND | `STUDY` | 등록 시 항상 고정. CLUB 전환은 별도 운영 액션 |
| STUDY.IS_HIDDEN | `false` | 등록 시 기본 공개 |
| STUDY.STUDY_DELIVERY_FORMAT | `ONLINE` | 등록 시 기본값 |
| STUDY.STATUS | `DRAFT` | 등록 후 ADMIN이 직접 OPEN 으로 전환 |
| STUDY.CAPACITY | `null` | 등록 시 미설정 |

### Response — 201 No Content

응답 바디 없음. `Location` 헤더에 생성된 스터디 URI를 담는다.

```
Location: /api/studies/{id}
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | title·oneLineSummary·category 누락, title 60자 초과, category 가 유효하지 않은 enum 값, recruitDeadline 이 과거. 실패한 필드 전부를 `필드명: 사유` 형태로 응답 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `SYSTEM_ROLE` 이 `ADMIN` 아님 |

500(저장 실패)은 별도 errorCode 없이 처리.

### 프론트엔드 사용처

미확인 — 콘솔 프론트의 등록 모달 경로 확인 필요

### 미확정

- ~~권한 범위~~ → **결정**: `SYSTEM_ROLE=ADMIN` 만 개설 가능 ("캡틴 = 운영자", 지금 단계). 일반 회원에게 캡틴 자격을 부여하는 신청/승인 플로우는 범위 밖 — 필요해지면 별도 Story

- ~~DRAFT → OPEN 전환 주체~~ → **결정**: 개설자(=ADMIN)가 직접 전환한다. 별도 승인 단계 없음 — ERD 상태 다이어그램의 "운영자 공개"를 개설자 본인이 수행하는 것으로 해석
- ~~상시 모집~~ → **결정**: `recruitDeadline` 미전송/null = 상시 모집. `STUDY_RECRUITMENT` 행은 항상 생성하되 `RECRUIT_DEADLINE_AT` 을 null 로 저장한다. 스키마 변경 필요: `RECRUIT_DEADLINE_AT` NOT NULL → NULL 허용 (마이그레이션 필요)
- **`publishAt` 등록 시 미지원** — `STUDY.PUBLISH_AT` 컬럼은 존재하나 등록 API 입력으로 받지 않는다. 공개 예약은 별도 Story. 등록 후 `STATUS=DRAFT` 로 비공개 상태이며, 운영자가 직접 OPEN 으로 전환한다
- **다중 카테고리 미지원** — 현재는 `category` 단일 값만 지원한다. 1~3개 허용으로 확장할 경우 `STUDY_CATEGORY` junction table 이 필요하다 (별도 Story)

---

## 스터디 수정

> 유저스토리: 캡틴 또는 네비게이터가 등록된 스터디의 내용을 수정한다.

### 인수 기준

| ID | 기준 |
|----|------|
| AC-1 | 등록 때 입력한 모든 항목을 수정할 수 있다 |
| AC-2 | 저장하면 사용자 사이트 목록·상세에 바뀐 내용이 즉시 반영된다 |
| AC-3 | 등록과 같은 검증이 적용되며, 실패하면 저장되지 않고 어떤 필드가 문제인지 응답에 포함된다 |
| AC-4 | recruitDeadline 을 수정하면 모집 상태 판정에 즉시 반영된다 |

### 기본 정보

- **Method**: PATCH
- **Path**: `/api/studies/{studyId}`
- **인증**: 필요 — 캡틴(ADMIN) 또는 네비게이터 (미확정: 네비게이터의 맡은 스터디 범위 정의 필요)
- **설명**: 스터디 정보를 부분 수정한다. 전송한 필드만 반영하며, 누락한 필드는 기존 값을 유지한다. `recruitDeadline` 수정 시 최신 `STUDY_RECRUITMENT` 행의 `RECRUIT_DEADLINE_AT` 을 UPDATE 한다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Request Body

```json
{
  "title": "AI 논문 스터디 시즌 2",
  "oneLineSummary": "AI 최신 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI_ML",
  "recruitDeadline": "2026-12-01T00:00:00Z",
  "schedule": "매주 목 20:00 · 8주 과정"
}
```

| 필드 | 타입 | 필수 | 검증 | 소스 |
|------|------|------|------|------|
| title | String | N | 1~60자 (trim 후) | STUDY.TITLE |
| oneLineSummary | String | N | 비어 있으면 저장 불가 | STUDY.ONE_LINE_SUMMARY |
| description | String | N | — | STUDY.DESCRIPTION |
| category | String | N | StudyCategory enum 값 중 하나. 유효값은 GET 응답의 enum 표 참조 | STUDY.CATEGORY |
| recruitDeadline | String | N | null = 상시 모집. 값이 있으면 미래여야 함 | STUDY_RECRUITMENT.RECRUIT_DEADLINE_AT — 최신 회차 행 UPDATE |
| schedule | String | N | 자유 텍스트 | STUDY.SCHEDULE |

**수정 불가 필드:**

| 필드 | 이유 |
|------|------|
| studyKind | 등록 시 고정 (STUDY/CLUB 전환은 별도 운영 액션) |
| status | 별도 상태 전환 API 에서만 변경 |
| isHidden | 별도 API |
| programId | 스터디 프로그램 연결은 변경 불가 |

### Response — 204 No Content

응답 바디 없음.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 400 | INVALID_INPUT | 검증 실패 — title 60자 초과, oneLineSummary 빈 값, category 가 유효하지 않은 enum 값, recruitDeadline 이 과거. 실패한 필드를 `필드명: 사유` 형태로 응답 |
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | 권한 없음 (캡틴·네비게이터 아님) |
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |

500(저장 실패)은 별도 errorCode 없이 처리.

### 미확정

- **네비게이터 권한 범위** — 전 항목인가, 일부 항목은 캡틴 전용인가
- **네비게이터의 맡은 스터디 범위** — 담당자–스터디 관계 테이블이 없으면 서버 측 권한 체크 불가. 별도 Story 에서 정의 필요

---

## 스터디 삭제

> 유저스토리: 캡틴이 더 이상 사용하지 않는 스터디를 삭제한다.

### 인수 기준

| ID | 기준 |
|----|------|
| AC-1 | 삭제된 스터디는 사용자 사이트 목록·상세에서 즉시 사라진다 |
| AC-2 | 스터디와 함께 크루 명단(참여 기록)과 출석 기록이 모두 삭제된다 |
| AC-3 | 삭제는 되돌릴 수 없다 |

### 기본 정보

- **Method**: DELETE
- **Path**: `/api/studies/{studyId}`
- **인증**: 필요 — 캡틴(ADMIN) 만. 크루 명단·출석 기록까지 함께 사라지므로 네비게이터는 불가
- **설명**: 스터디와 그에 달린 모든 참여·출석 기록을 영구 삭제한다. 소프트 삭제가 아닌 물리 삭제다.

### Path Parameters

| 이름 | 타입 | 설명 |
|------|------|------|
| studyId | Long | 스터디 ID |

### Request Body

없음.

### Response — 204 No Content

응답 바디 없음.

### 삭제 시 함께 제거되는 데이터

| 테이블 | 조건 | 비고 |
|--------|------|------|
| STUDY | ID = studyId | 대상 스터디 본체 |
| STUDY_RECRUITMENT | STUDY_ID = studyId | 모집 회차 전체 |
| STUDY_APPLICATION | RECRUITMENT_ID in 위 회차 | 신청 기록 |
| STUDY_PARTICIPANT | STUDY_ID = studyId | 크루 명단 |
| ATTENDANCE | STUDY_ID = studyId (또는 연관 FK) | 출석 기록 |

> 위 테이블 목록은 현재 ERD 기준이며, 관련 테이블이 추가되면 함께 갱신한다.

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | 권한 없음 (ADMIN 아님) |
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |

### 미확정

 **삭제 대신 보관(아카이브)** — 종료된 스터디의 출석 기록은 통계의 근거다. 아카이브 전환으로 대체할지 검토 필요                                           
 **진행 중 스터디 삭제 허용 여부** — 참여자가 있는 `STATUS=OPEN` 스터디도 삭제할 수 있게 할지, 혹은 `STATUS=CLOSED` 상태에서만 삭제 가능하게 막을지 미결

---

## 신청 폼 · 신청 · 결과

유저스토리 「캡틴은 스터디 신청용 폼을 작성할 수 있다」·「크루는 스터디 신청 폼을 제출할 수 있다」·「캡틴은 스터디 신청서 결과를 모아볼 수 있다」는 [study-application/spec.md](../study-application/spec.md) 가 정본이다.

결정 요약 (상세는 그쪽):

- 저장 위치는 `STUDY.APPLICATION_FORM` (기수). 신청 행은 `STUDY_APPLICATION.RECRUITMENT_ID` (모집 회차)
- 이름·이메일은 폼에 두지 않고 계정에서 읽는다. 디스코드 별명·참여 요일은 플랫폼 기본 문항
- 질문 설명은 여러 줄 마크다운 원문
