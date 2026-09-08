# Spec-Driven Development

> **코드 전에 스펙을 쓴다.** 스펙이 합의되면 BE·FE 가 동시에 움직인다.
> [spec-kit](https://github.com/github/spec-kit) 의 구조화된 접근을 이 프로젝트에 맞게 적용한다.

## Table of Contents

- [왜 스펙 먼저인가](#왜-스펙-먼저인가)
- [디렉터리 구조](#디렉터리-구조)
- [워크플로우](#워크플로우)
- [파일별 역할과 템플릿](#파일별-역할과-템플릿)
- [상태 관리](#상태-관리)
- [스펙 리뷰 체크리스트](#스펙-리뷰-체크리스트)
- [스펙과 코드의 관계](#스펙과-코드의-관계)
- [기존 가이드와의 관계](#기존-가이드와의-관계)

## 왜 스펙 먼저인가

| 문제 | 스펙 먼저가 막는 것 |
|------|---------------------|
| FE 가 mock 으로 만들고, BE 가 다른 shape 을 내보냄 | 응답 shape 이 합의된 상태에서 양쪽이 시작 |
| "이 필드 nullable 이야?" 를 PR 에서 발견 | 스펙 리뷰에서 잡음 — 코드 전에 |
| 엔드포인트가 늘어나는데 전체 그림이 없음 | 도메인별 스펙이 인덱스 역할 |
| 에러 코드를 FE 가 모르고 BE 가 임의로 추가 | 에러 응답이 스펙에 명시 |
| 구현 끝나면 왜 이렇게 했는지 아무도 모름 | 스펙의 변경 이력이 PR 에 남는다 |

## 디렉터리 구조

```
specs/
├── README.md                        # 스펙 인덱스 — 전체 도메인·기능 목록
├── study/                           # 도메인 단위 폴더
│   ├── spec.md                      # 도메인 전체 API 스펙 (엔드포인트 목록 + 개별 상세)
│   ├── plan.md                      # 구현 계획 — 기술 선택, 순서, 의존성
│   ├── tasks.md                     # 실행 태스크 — plan 에서 도출한 체크리스트
│   └── contracts/                   # 응답 shape 상세 (스펙이 커지면 분리)
│       ├── study-detail.json        # GET /api/studies/{id} 응답 예시
│       └── study-list.json          # GET /api/studies 응답 예시
├── account/
│   ├── spec.md
│   ├── plan.md
│   └── tasks.md
└── _templates/                      # 복사해서 쓰는 템플릿
    ├── spec-template.md
    ├── plan-template.md
    └── tasks-template.md
```

**규칙:**

- **도메인 단위로 폴더 1개.** `study/`, `account/`, `proposal/` 등
- **파일 이름은 고정.** `spec.md`, `plan.md`, `tasks.md` — 어디서든 같은 이름
- **contracts/ 는 선택.** 응답 JSON 예시가 길어지면 분리. 짧으면 spec.md 안에 인라인
- **ERD 와 1:1 이 아니다.** ERD 는 테이블 단위, 스펙은 API 도메인 단위. study/ 스펙이 STUDY + STUDY_COHORT + STUDY_CLASS 를 포함할 수 있다

## 워크플로우

spec-kit 의 specify → plan → tasks → implement → converge 를 이 프로젝트 규모에 맞게 줄였다.

```
1. /spec {도메인}          ← 스펙 초안 생성 (spec.md)
   ↓
2. 스펙 리뷰               ← BE·FE 가 shape·에러·인증 합의
   ↓
3. /spec plan {도메인}     ← 구현 계획 생성 (plan.md)
   ↓
4. /spec tasks {도메인}    ← 태스크 도출 (tasks.md)
   ↓
5. 구현                    ← BE·FE 동시 시작
   ↓
6. /spec review {도메인}   ← 구현 후 스펙 대비 검증 (converge)
```

### 스펙 PR 과 구현 PR

**분리가 기본이다.** 스펙이 먼저 머지되면:
- FE 는 스펙 기준으로 타입과 fetch 함수를 미리 작성할 수 있다
- BE 는 스펙 기준으로 DTO 와 통합 테스트를 먼저 작성할 수 있다
- 리뷰어는 "이 구현이 합의된 스펙과 맞는가"만 보면 된다

**급할 때** — 스펙과 구현을 한 PR 에 넣을 수 있다. 단, 커밋은 분리한다
(`docs: 스터디 상세 API 스펙` → `feat: 스터디 상세 API 구현`).

## 파일별 역할과 템플릿

### spec.md — API 스펙 (정본)

도메인의 모든 엔드포인트를 한 파일에. 이 파일이 **BE·FE 계약의 정본**이다.

```markdown
# {도메인} API Spec

> ERD: [STUDY](../../docs/erd/STUDY.md), [STUDY_COHORT](../../docs/erd/STUDY_COHORT.md)

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | 상태 |
|--------|------|------|------|------|
| GET | /api/studies | 스터디 목록 | X | 구현완료 |
| GET | /api/studies/{studyId} | 스터디 상세 | X | 스펙확정 |

---

## 스터디 상세 조회

### 기본 정보
- **Method**: GET
- **Path**: `/api/studies/{studyId}`
- **인증**: 불필요
- **설명**: 스터디 상세 정보 + 최신 코호트 정보 조회

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
  "slug": "ai-paper-reading",
  "title": "AI 논문 리딩",
  ...
}
```

| 필드 | 타입 | NULL | 설명 | 소스 |
|------|------|------|------|------|
| id | Long | N | | STUDY.ID |
| slug | String | N | URL 식별자 | STUDY.SLUG |
| title | String | N | | STUDY.TITLE |

> **소스 컬럼**: 이 필드가 어느 테이블·컬럼에서 오는지. 계산 필드는 `계산: {로직}` 으로 표기

### Error Responses

| 상태 | errorCode | 조건 |
|------|-----------|------|
| 404 | NOT_FOUND | studyId 에 해당하는 스터디 없음 |
| 404 | NOT_FOUND | isHidden=true 인 스터디 |

### 프론트엔드 사용처

- `frontend/apps/core-front/src/app/[locale]/studies/[id]/page.tsx`
- `frontend/apps/core-front/src/lib/content.ts` → `getStudy(id)`

### 미확정

- [NEEDS CLARIFICATION] 국/영문 이중 제목 지원 여부
```

#### 필수 섹션 (모든 엔드포인트)

1. **기본 정보** — method, path, 인증 여부
2. **파라미터** — path, query, body 중 해당하는 것
3. **성공 응답** — JSON 예시 + 필드 표 (타입, nullable, 설명, **소스**)
4. **에러 응답** — 상태 코드 + errorCode + 발생 조건
5. **프론트엔드 사용처** — 이 API 를 쓰는 FE 파일 경로
6. **미확정** — `[NEEDS CLARIFICATION]` 마커로 명시. 추측하지 않는다

#### 응답 shape 규칙

- **성공 응답에 래퍼 없음** — payload 직접 반환
- **에러는 `{ errorCode, errorMessage }`** — [exception-handling-guide.md](exception-handling-guide.md)
- **날짜는 UTC ISO 8601** — `2026-09-08T11:00:00Z`
- **enum 은 대문자 문자열** — `"ONLINE"`, `"DRAFT"`
- **nullable 필드는 명시** — 표에 `NULL: Y`
- **소스 컬럼 명시** — 이 필드가 ERD 의 어디에서 오는지

### plan.md — 구현 계획

spec 이 **무엇**이면, plan 은 **어떻게**다.

```markdown
# {도메인} 구현 계획

> Spec: [spec.md](./spec.md) | 날짜: 2026-09-08

## 대상 엔드포인트

이번에 구현하는 엔드포인트 목록 (spec.md 의 부분집합)

## 기술 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| 코호트 조회 | 최신 OPEN 코호트 1개 | 상세 페이지에 현재 모집 중인 기수만 노출 |
| 조회수 | 별도 POST 엔드포인트 | GET 멱등성, Next.js prefetch 문제 |

## 애그리거트 매핑

- Study (루트) → StudyRepository
- StudyCohort → Study 와 ID 참조, StudyCohortRepository (별도 애그리거트)

## 구현 순서

1. Repository 인터페이스 (domain)
2. DTO (api)
3. Service (api)
4. Controller 교체 (api)
5. SecurityConfig permitAll 추가
6. 마이그레이션 (필요 시)
7. 테스트

## 의존성

- SecurityConfig 수정 → 인증팀 확인 불필요 (permitAll 추가뿐)
- ERD 변경 → 없음 (기존 테이블 사용)
```

### tasks.md — 실행 태스크

plan 에서 도출한 구체적 체크리스트. 이슈 트래커 역할.

```markdown
# {도메인} Tasks

> Plan: [plan.md](./plan.md) | Spec: [spec.md](./spec.md)

## Phase 1: Infrastructure

- [ ] T001 `StudyRepository` 인터페이스 생성
- [ ] T002 [P] `StudyCohortRepository` 인터페이스 생성

## Phase 2: 스터디 상세 조회 (GET /api/studies/{studyId})

- [ ] T003 `StudyDetailResponse` DTO 생성
- [ ] T004 `StudyService.getStudyDetail()` 구현
- [ ] T005 `StudyController.detail()` 엔드포인트 구현
- [ ] T006 SecurityConfig 에 `/api/studies/{studyId}` permitAll 추가
- [ ] T007 통합 테스트 — 성공 + 404
- [ ] T008 [P] 단위 테스트 — Study 엔티티 isHidden 검증

## Phase 3: FE 연동

- [ ] T009 `lib/content.ts` → API fetch 교체
- [ ] T010 에러/로딩 상태 처리
```

**태스크 규칙:**
- `[P]` = 병렬 실행 가능 (다른 태스크와 파일이 겹치지 않음)
- Phase 는 의존성 기준으로 나눈다. Phase 1 이 끝나야 Phase 2 시작
- 파일 경로를 구체적으로 적는다

### contracts/ — 응답 JSON 예시 (선택)

spec.md 의 JSON 예시가 길어지면 여기로 분리.

```
contracts/
  study-detail.json      # GET /api/studies/{id} 200 응답 full 예시
  study-detail-404.json  # 404 에러 응답 예시
```

## 상태 관리

### 엔드포인트 상태

| 상태 | 뜻 | 다음 |
|------|-----|------|
| `스펙작성중` | 초안. [NEEDS CLARIFICATION] 이 남아 있을 수 있음 | 스펙확정 |
| `스펙확정` | BE·FE 합의 완료. 구현 시작 가능 | 구현중 |
| `구현중` | 코드 작성 진행 중 | 구현완료 |
| `구현완료` | 코드 머지 + 테스트 통과 | — |
| `변경예정` | 기존 스펙 수정 필요. 사유를 미확정에 기록 | 스펙작성중 |

### spec.md 상태 전이

```
스펙작성중 → 스펙확정 : [NEEDS CLARIFICATION] 전부 해소 + 리뷰 통과
스펙확정 → 구현중 : 구현 PR 생성
구현중 → 구현완료 : 구현 PR 머지
구현완료 → 변경예정 : 요구사항 변경
변경예정 → 스펙작성중 : 스펙 수정 시작
```

## 스펙 리뷰 체크리스트

스펙 PR 리뷰 시 확인:

### URL·구조
- [ ] URL 이 endpoint-convention 을 따르는가 — 복수 명사, kebab-case, 동사 금지
- [ ] 기존 API 로 해결 가능한 건 아닌가 — [common-guide.md](../common-guide.md)
- [ ] `[NEEDS CLARIFICATION]` 마커가 남아 있지 않은가

### 응답 shape
- [ ] 성공 응답에 래퍼(`success`, `data`)가 없는가
- [ ] 모든 필드에 타입 + nullable + **소스 컬럼**이 명시되어 있는가
- [ ] 날짜가 UTC ISO 8601 인가
- [ ] enum 이 대문자 문자열이고 ERD 상태 정의와 일치하는가

### ERD 정합성
- [ ] 응답 필드가 ERD 컬럼에서 유도 가능한가
- [ ] ERD 에 없는 필드가 있으면 `계산: {로직}` 으로 표기되어 있는가
- [ ] 관계 방향이 ERD 의 FK 방향과 맞는가

### 프론트엔드 정합성
- [ ] FE 가 사용하는 필드가 응답에 빠짐없는가
- [ ] FE 가 안 쓰는 필드가 불필요하게 포함되지 않았는가
- [ ] FE 타입 정의와 응답 shape 이 호환되는가

### 에러 응답
- [ ] 인증 필요 엔드포인트에 401 이 있는가
- [ ] 리소스 조회에 404 가 있는가
- [ ] 상태 전이에 409(CONFLICT) 가 있는가
- [ ] errorCode 가 FE 에서 분기 가능한 이름인가

### 보안·인증
- [ ] 인증 여부가 SecurityConfig permitAll 과 맞는가
- [ ] PII 가 응답에 포함되면 마스킹 정책이 명시되어 있는가

## 스펙과 코드의 관계

```
specs/{도메인}/spec.md   ← 설계 합의 (정본)
       ↕ 사람이 맞춘다
springdoc OpenAPI        ← 실제 코드가 내보내는 것 (구현 검증)
```

- **스펙과 구현이 다르면 구현을 고친다** (스펙이 정본)
- 스펙이 잘못됐으면 **스펙 수정 PR 을 먼저** 올린다
- 구현 PR 에는 `스펙: specs/study/spec.md#스터디-상세-조회` 링크를 단다

## 기존 가이드와의 관계

| 가이드 | 역할 | 스펙과의 관계 |
|--------|------|-------------|
| [ddd-guide.md](ddd-guide.md) | 애그리거트·엔티티 설계 | plan.md 의 애그리거트 매핑이 여기를 따른다 |
| [endpoint-convention.md](api/endpoint-convention.md) | URL·메서드·응답 포맷 규칙 | spec.md 가 이 규칙을 따라야 함 |
| [common-guide.md](../common-guide.md) | 기존 API 활용 원칙 | 새 엔드포인트 추가 전 기존 것 확인 |
| [ERD](../erd/README.md) | 테이블·컬럼·상태 전이 | spec.md 필드의 소스 컬럼이 ERD 에서 유도 가능해야 함 |
| [testing-guide.md](testing-guide.md) | 테스트 작성 | spec.md 의 에러 응답 = 통합 테스트 실패 케이스 |

## specs/ 시작하기

```bash
# 새 도메인 스펙 시작
mkdir -p specs/{도메인}
cp specs/_templates/spec-template.md specs/{도메인}/spec.md
# spec.md 작성 후 리뷰
# 리뷰 통과 후
cp specs/_templates/plan-template.md specs/{도메인}/plan.md
cp specs/_templates/tasks-template.md specs/{도메인}/tasks.md
```

또는 Claude Code 에서:
```
/spec study          # spec.md 자동 생성
/spec plan study     # plan.md 자동 생성
/spec tasks study    # tasks.md 자동 생성
/spec review study   # 스펙 검증
```
