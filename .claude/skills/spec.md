---
name: spec
description: "API 스펙을 생성·계획·태스크 도출·검증한다. specs/{도메인}/ 폴더에 구조화된 파일(spec.md, plan.md, tasks.md)을 만든다."
---

# /spec — API 스펙 관리 스킬

spec-kit 스타일의 구조화된 스펙 관리. `specs/{도메인}/` 폴더에 spec.md → plan.md → tasks.md 를 만들고 검증한다.

## 사용법

```
/spec {도메인}                       # spec.md 조회 또는 초안 생성
/spec {도메인} {엔드포인트}           # 특정 엔드포인트 스펙 조회 또는 추가
/spec plan {도메인}                  # plan.md 생성 (구현 계획)
/spec tasks {도메인}                 # tasks.md 생성 (실행 태스크)
/spec review {도메인}                # 전체 스펙 검증 (converge)
/spec review {도메인} {엔드포인트}    # 특정 엔드포인트 검증
```

예시:
```
/spec study                          # 스터디 도메인 spec.md
/spec study 스터디-상세-조회            # 특정 엔드포인트 추가
/spec plan study                     # 구현 계획
/spec tasks study                    # 태스크 도출
/spec review study                   # 검증
```

## 디렉터리 구조

이 스킬이 만드는 파일 구조:

```
specs/
├── README.md                 # 인덱스 (자동 업데이트)
├── {도메인}/
│   ├── spec.md               # API 스펙 (정본)
│   ├── plan.md               # 구현 계획
│   ├── tasks.md              # 실행 태스크
│   └── contracts/            # 응답 JSON 예시 (선택, 스펙이 길 때)
│       └── {endpoint}.json
└── _templates/               # 복사용 템플릿
    ├── spec-template.md
    ├── plan-template.md
    └── tasks-template.md
```

## 실행 절차

### `/spec {도메인}` — 스펙 생성

#### 1단계: 파일 확인

`specs/{도메인}/spec.md` 존재 여부 확인.
- **있으면** → 읽고 내용 표시
- **없으면** → 아래 소스를 읽어서 초안 생성

#### 2단계: 소스 수집 (초안 생성 시)

아래를 **전부** 읽는다:

1. **ERD 문서** — `docs/erd/{관련 테이블}.md` 전부
   - 컬럼·타입·nullable·상태 전이 → spec.md 필드 표의 소스 컬럼
2. **프론트엔드 코드** — 해당 도메인의 페이지·컴포넌트·lib 파일
   - `// TODO(api)` 주석 — 아직 mock 인 곳
   - fetch 호출 또는 API 함수 — 이미 연동된 곳
   - 사용하는 데이터 shape (타입 정의, props)
3. **기존 백엔드 코드** — 컨트롤러·서비스·DTO·도메인 엔티티
4. **mock 데이터** — `frontend/packages/mock/src/` 타입과 샘플
5. **기존 가이드**:
   - `docs/backend-development-guide/api/endpoint-convention.md`
   - `docs/common-guide.md`
   - `docs/backend-development-guide/spec-driven-development.md`

#### 3단계: spec.md 작성

`specs/_templates/spec-template.md` 를 복사하고 아래 규칙으로 채운다:

- **프론트가 사용하는 필드만** 응답에 넣는다. ERD 에 있어도 FE 가 안 쓰면 빼고 `미확정`에 기록
- **nullable** 은 ERD 의 NULL 컬럼을 따른다
- **enum** 값은 백엔드 도메인 엔티티의 enum 정의를 따른다
- **소스 컬럼**을 반드시 표기: `STUDY.TITLE`, `STUDY_COHORT.STATUS`, `계산: now() < deadline`
- **에러 응답**은 인증(401)·권한(403)·없음(404)·충돌(409) 중 해당하는 것
- 불확실한 부분은 **`[NEEDS CLARIFICATION]`** 로 명시. 추측하지 않는다
- 상태는 `스펙작성중` 으로 표기

#### 4단계: README.md 업데이트

`specs/README.md` 의 도메인 목록 표에 해당 도메인 행을 추가/업데이트한다.

#### 출력

```
📋 {도메인} API 스펙 초안 생성

파일: specs/{도메인}/spec.md
엔드포인트: {N}개
소스: ERD {N}개 테이블, FE {N}개 파일, BE {N}개 파일

⚠️ 확인 필요 ([NEEDS CLARIFICATION]):
- {추론이 불확실한 부분}
- {프론트와 ERD 가 다른 부분}
```

---

### `/spec plan {도메인}` — 구현 계획 생성

#### 전제조건
- `specs/{도메인}/spec.md` 가 존재해야 한다

#### 절차

1. spec.md 를 읽는다
2. `specs/_templates/plan-template.md` 를 복사한다
3. 아래를 채운다:
   - **대상 엔드포인트** — 이번에 구현할 것 (spec.md 에서 `스펙확정` 상태인 것)
   - **기술 결정** — 조회 전략, 캐싱, 인증 방식 등 + 이유
   - **애그리거트 매핑** — `docs/backend-development-guide/ddd-guide.md` 기준
   - **구현 순서** — domain → api → config → test → fe
   - **의존성** — ERD 변경, SecurityConfig, 다른 도메인 스펙
4. `specs/{도메인}/plan.md` 에 저장

#### 출력

```
📐 {도메인} 구현 계획 생성

파일: specs/{도메인}/plan.md
대상: {N}개 엔드포인트
기술 결정: {N}개
의존성: {있음/없음}
```

---

### `/spec tasks {도메인}` — 태스크 도출

#### 전제조건
- `specs/{도메인}/plan.md` 가 존재해야 한다

#### 절차

1. spec.md + plan.md 를 읽는다
2. `specs/_templates/tasks-template.md` 를 복사한다
3. plan.md 의 구현 순서를 Phase 로 나누고 구체적 태스크로 분해한다:
   - 파일 경로를 구체적으로 적는다
   - 병렬 가능한 태스크에 `[P]` 표기
   - 통합 테스트 = spec.md 의 성공 + 에러 응답
   - 단위 테스트 = 도메인 규칙
4. `specs/{도메인}/tasks.md` 에 저장

#### 출력

```
✅ {도메인} 태스크 도출

파일: specs/{도메인}/tasks.md
Phase: {N}개
태스크: {N}개 (병렬 가능: {N}개)
```

---

### `/spec review {도메인}` — 스펙 검증

spec.md 를 아래 6개 축으로 검증한다. 구현 코드가 있으면 코드도 대비 검증한다 (converge).

#### 검증 축

**1. URL·구조**
- [ ] URL 이 복수 명사, kebab-case 를 따르는가
- [ ] 동사가 URL 에 없는가
- [ ] 기존 API 확장으로 해결 가능한 건 아닌가 (common-guide.md)
- [ ] `[NEEDS CLARIFICATION]` 이 남아 있지 않은가

**2. 응답 shape**
- [ ] 래퍼(`success`, `data`) 없는가
- [ ] 모든 필드에 타입 + NULL + 소스 컬럼이 있는가
- [ ] 날짜가 UTC ISO 8601 인가
- [ ] enum 이 대문자 문자열인가

**3. ERD 정합성**
- [ ] 응답 필드가 ERD 컬럼에서 유도 가능한가
- [ ] ERD 에 없는 필드가 `계산: {로직}` 으로 표기되어 있는가
- [ ] enum 값이 ERD 상태 정의와 일치하는가

**4. FE 정합성**
- [ ] FE 가 사용하는 필드가 응답에 빠짐없는가
- [ ] FE 가 안 쓰는 필드가 포함되지 않았는가
- [ ] FE 타입 정의와 응답 shape 이 호환되는가

**5. 에러 응답**
- [ ] 인증 필요 엔드포인트에 401 이 있는가
- [ ] 리소스 조회에 404 가 있는가
- [ ] 상태 전이에 409(CONFLICT) 가 있는가

**6. 보안·인증**
- [ ] 인증 여부가 SecurityConfig permitAll 과 맞는가
- [ ] PII 응답 시 마스킹 정책이 명시되어 있는가

#### Converge (구현 코드 대비 검증)

구현 코드가 있으면 추가로:
- [ ] Controller 의 실제 URL 이 spec.md 와 일치하는가
- [ ] DTO 필드가 spec.md 응답 표와 일치하는가
- [ ] SecurityConfig permitAll 이 spec.md 인증 여부와 일치하는가
- [ ] 통합 테스트가 spec.md 의 에러 응답을 모두 커버하는가

#### 출력

```
🔍 {도메인} 스펙 리뷰

✅ 통과: {N}건
⚠️ 경고: {N}건
❌ 실패: {N}건

--- 상세 ---
❌ [URL] GET /api/getStudies → 동사 포함. GET /api/studies 로 변경
⚠️ [ERD] cohort.curriculum — ERD 는 JSON, 스펙에 String
✅ [인증] permitAll 목록 일치
❌ [Converge] DTO 에 slug 필드 누락 — spec.md 에는 있음
...

{converge 결과가 모두 통과면}
🎯 Converged — 구현이 스펙과 일치합니다.
```
