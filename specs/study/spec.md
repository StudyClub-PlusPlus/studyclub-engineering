# 스터디 API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md) · [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md)
> 생성일: 2026-09-08
> 상태: 스펙확정

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 (fixture) |
| GET | /api/studies/{studyId} | 스터디 상세 조회 | X | 스펙확정 |
| POST | /api/studies | 캡틴 스터디 개설 | O | 스펙작성중 |
| PATCH | /api/studies/{studyId}/cohorts/{cohortId}/application-form | 신청 폼 설계 | O (캡틴) | 스펙작성중 |

상태: `스펙작성중` → `스펙확정` → `구현중` → `구현완료`

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
| cohort.recruitDeadline | String | N | 모집 마감 (ISO 8601 UTC) | STUDY_COHORT.RECRUIT_DEADLINE |
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

## 캡틴 스터디 개설

> 유저스토리: "캡틴은 스터디 폼을 작성할 수 있다" 1단계 — 스터디 자체를 만드는 부분.
> back-office 의 「운영자로서, 스터디를 등록할 수 있다」(`frontend/apps/playground/src/proto/specs/study-create.ts`) Story 와 **호출자가 사실상 같다** — 캡틴이 곧 운영자(ADMIN)로 결정됐기 때문. 다만 UI 컨텍스트(core-front 셀프서비스 vs back-office 관리 콘솔)는 다를 수 있어, 폼/엔드포인트를 하나로 합칠지는 plan.md 에서 결정한다.

### 기본 정보

- **Method**: POST
- **Path**: `/api/studies`
- **인증**: 필요 — `ACCOUNT.SYSTEM_ROLE=ADMIN` 만 (지금 단계에서는 **캡틴 = 운영자**. 일반 회원에게 셀프서비스로 캡틴 자격을 여는 건 이후 Story)
- **설명**: 캡틴(=ADMIN)이 새 스터디(`STUDY_KIND=STUDY`)와 그 최초 코호트(`STUDY_COHORT`, `STATUS=DRAFT`)를 함께 만든다. ERD 상 "코호트 없는 STUDY"는 없으므로 항상 같이 생성한다.

### Request Body

```json
{
  "title": "AI 논문 스터디",
  "summary": "AI 논문을 함께 읽고 토론합니다.",
  "description": "매주 목요일 논문 하나씩 읽고 토론합니다.",
  "category": "AI",
  "thumbnailUrl": null,
  "cohort": {
    "deliveryFormat": "ONLINE",
    "recruitDeadline": "2026-11-01T00:00:00Z",
    "startDate": "2026-11-15",
    "endDate": "2027-01-15",
    "capacity": 20
  }
}
```

| 필드 | 타입 | 필수 | 설명 | 소스 |
|------|------|------|------|------|
| title | String | Y | 60자 상한 | STUDY.TITLE |
| summary | String | Y | 한 줄 소개, 25자 권장 상한 (경고만) | [NEEDS CLARIFICATION] — ERD STUDY 에 SUMMARY 컬럼 없음. DESCRIPTION 과 별도로 필요한지, 아니면 DESCRIPTION 첫 줄로 대체할지 |
| description | String | N | 상세 소개 | STUDY.DESCRIPTION |
| category | String | Y | enum, 드롭다운 11종 (proto 참고) | STUDY.CATEGORY |
| thumbnailUrl | String | N | | STUDY.THUMBNAIL_URL |
| cohort.deliveryFormat | String | Y | ONLINE/OFFLINE/HYBRID | STUDY_COHORT.STUDY_DELIVERY_FORMAT |
| cohort.recruitDeadline | String | N | 미설정 = 상시 모집 | STUDY_COHORT.RECRUIT_DEADLINE — ERD 는 NOT NULL 인데 "상시 모집" 요구사항과 충돌. [NEEDS CLARIFICATION] |
| cohort.startDate | String | N | | STUDY_COHORT.START_DATE |
| cohort.endDate | String | N | | STUDY_COHORT.END_DATE |
| cohort.capacity | Integer | N | | STUDY_COHORT.CAPACITY |

> `slug` 는 응답에만 있다 — 서버가 title 로부터 생성 (충돌 시 처리 방식 [NEEDS CLARIFICATION])
> `studyKind` 는 개설 시 항상 `STUDY` 로 고정. `CLUB` 전환은 별도 운영 액션(범위 밖)

### Response — 201

```json
{
  "id": 42,
  "slug": "ai-paper-study-42",
  "status": "DRAFT",
  "cohort": { "id": 101, "status": "DRAFT" }
}
```

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `SYSTEM_ROLE` 이 `ADMIN` 아님 |
| 400 | VALIDATION | title/summary 글자수 초과, 필수값 누락, recruitDeadline < now |

### 프론트엔드 사용처

- 없음 (신규). 참고 프로토타입: `frontend/apps/playground/src/proto/specs/study-create.ts` (back-office 「운영자로서, 스터디를 등록할 수 있다」 Story — 지금은 캡틴=운영자이므로 사실상 같은 액터. UI 를 core-front 셀프서비스 폼과 back-office 관리자 폼으로 분리할지, 폼/엔드포인트를 공유할지는 plan.md 단계에서 정리)

### 미확정

- ~~권한 범위~~ → **결정**: `SYSTEM_ROLE=ADMIN` 만 개설 가능 ("캡틴 = 운영자", 지금 단계). 일반 회원에게 캡틴 자격을 부여하는 신청/승인 플로우는 범위 밖 — 필요해지면 별도 Story
- ~~캡틴 ↔ STUDY_PARTICIPANT 연결~~ → **결정**: 개설과 동시에 기본 반(`STUDY_CLASS`) 1개를 생성하고, 개설자를 그 반의 `STUDY_PARTICIPANT`(`PARTICIPANT_ROLE=LEADER`, `STATUS=ACTIVE`)로 편입한다
- ~~DRAFT → OPEN 전환 주체~~ → **결정**: 개설자(=ADMIN)가 직접 전환한다. 별도 승인 단계 없음 — ERD 상태 다이어그램의 "운영자 공개"를 개설자 본인이 수행하는 것으로 해석
- [NEEDS CLARIFICATION] **상시 모집** — proto 스펙엔 "미설정 시 마감 없이 계속 모집"이 있는데 ERD `STUDY_COHORT.RECRUIT_DEADLINE` 은 NOT NULL. 둘 중 하나를 고쳐야 한다

---

## 신청 폼 설계

> 유저스토리: "캡틴은 스터디 폼을 작성할 수 있다" 2단계 — 개설한 코호트의 신청서 질문을 캡틴이 직접 구성.
> `STUDY_COHORT.APPLICATION_FORM` (JSON) 을 채우는 엔드포인트. ERD 는 이 컬럼의 구조(JSON 자유형 vs `STUDY_QUESTION`+`STUDY_APPLICATION_ANSWER` 정규화 테이블)를 팀 회의 미확정으로 남겨뒀는데, 이 스펙에서는 **일단 JSON 유지로 결정** — 정규화는 필요해지면 재검토(ERD README 의 해당 미확정 항목 자체는 팀 확정 전까지 그대로 둔다).

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

`STUDY_COHORT.APPLICATION_FORM` 저장 후 그대로 반환 (Request Body와 동일 shape)

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 401 | UNAUTHORIZED | 로그인 필요 |
| 403 | FORBIDDEN | `SYSTEM_ROLE` 이 `ADMIN` 아님, 또는 이 코호트의 캡틴(LEADER)이 아님 |
| 404 | NOT_FOUND | studyId/cohortId 불일치 또는 없음 |
| 409 | CONFLICT | 모집이 이미 시작된 뒤 신청 폼을 수정하려 할 때 |

### 프론트엔드 사용처

- 없음 (신규)

### 미확정

- ~~JSON 자유형 vs 정규화~~ → **결정**: 일단 JSON 유지 (`STUDY_COHORT.APPLICATION_FORM` / `STUDY_APPLICATION.FORM_ANSWER`)
- ~~질문 타입(type) enum~~ → **결정**: `TEXT`/`TEXTAREA`/`RADIO`/`CHECKBOX`/`SELECT`
- **계정 필드**: 이름(`ACCOUNT.NICKNAME`)·이메일(`ACCOUNT.EMAIL`)은 신청 폼에 받지 않고 계정에서 읽는다. 디스코드 서버 별명(`ACCOUNT.DISCORD_NICKNAME`)은 값이 있으면 그대로 쓰고, 없으면 신청 시 `TEXT` 필수로 받아 계정에 저장한다. 캡틴이 지우거나 타입을 바꿀 수 없다. 예시 `홍길동/SWE/산호세/시스템디자인`
- ~~OPEN 상태에서 폼 수정 허용 여부~~ → **결정**: 신청 폼 수정은 **모집 시작 전일 때만** 가능하다. 모집이 시작되면 409 CONFLICT. 이미 들어온 신청서의 FORM_ANSWER 와 질문이 어긋나지 않게 잠근다
