# StudyClub++ · AI Agent Context

이 파일은 Claude / Codex / 다른 AI agent 가 이 모노레포에서 작업할 때 따라야 할 컨텍스트와 개발 규약이다.

## ⚠️ 이 레포는 PUBLIC 이다

`StudyClub-PlusPlus/studyclub-engineering` 는 **공개 레포지토리**다. 아래는 **절대 커밋 금지**:

- `.env`, `.env.*`, 어떤 형태의 토큰·API 키·시크릿·비밀번호
- DB 접속 정보, 내부 서버 IP/URL, SSH 키(`*.pem`, `*.key`)
- 개인정보(회원 실명/연락처/이메일), 결제 정보
- 내부 전용 문서, fleet 경로/구조가 드러나는 내용

**시크릿은 fleet/secret/ SSOT 에서만 관리**하고, 배포 시 GitHub Actions Secret 으로 주입한다 (레포에 평문 금지).
민감정보가 필요하면 코드에는 `process.env.XXX` 로 참조만 하고 값은 넣지 않는다.

## 이게 뭐

StudyClub++ 스터디 클럽 서비스. **frontend**(사용자향 core-front + 운영자향 back-office-front) + **backend**(Spring Boot 멀티모듈).
프론트는 현재 **하드코딩/mock 데이터**로 동작 (백엔드 API 붙으면 교체). 백엔드는 기본 스캐폴드 단계.

## 구조 (monorepo)

```
frontend/                # Node 워크스페이스(turbo) — 프론트 루트
  apps/
    core-front/          # 사용자향 (studyclub-plusplus.com) — 랜딩/이벤트/스터디
    back-office-front/   # 운영자향 (back-office.studyclub-plusplus.com) — 운영 콘솔
  packages/mock          # 하드코딩 mock 데이터 + 공유 타입
backend/                 # Spring Boot 3 멀티모듈 (Gradle) — api / domain / common
  api/  domain/  common/
```

## 실행

```bash
# frontend
cd frontend && npm install && npm run dev      # turbo (모든 앱)
#   개별: npm run dev --workspace=core-front

# backend
cd backend && gradle :api:bootRun              # (gradle 미설치면 gradle wrapper 생성 후 ./gradlew)
```

## 작업 룰

- **PUBLIC 레포** — 위 민감정보 금지 규칙 최우선.
- 외부 라이브러리 임의 추가 금지 — 합의 필수.
- 프론트 데이터는 지금 `frontend/packages/mock` 에 하드코딩. 실 API 교체 지점은 `// TODO(api)` 주석.
- PR 은 CODEOWNERS(@titaniper) 승인 후에만 main 머지 (외부 기여자 포함).
- CI: 프론트=`.github/workflows/{core,back-office}-front-*` (context `frontend/`), 백엔드=`backend-*`.
  `backend-migration-check` 는 PR 마다 빈 MySQL 에 마이그레이션을 적용해 본다 — 여기서 깨지면 `V*.sql` 을 고친다.

---

## 개발 가이드

### 공통

- **기존 API 를 먼저 활용한다.** 새 엔드포인트를 만들기 전에 기존 것으로 해결 가능한지 확인.
  → 상세: [`docs/common-guide.md`](docs/common-guide.md)

### Backend (Spring Boot)

코드를 작성·수정할 때 아래 가이드를 상황에 맞게 참고한다.

> **아무 코드나 쓰기 전에 [`docs/backend-development-guide/ddd-guide.md`](docs/backend-development-guide/ddd-guide.md) 를 먼저 읽는다.**
> 애그리거트를 어디에 긋고 로직을 어디에 두는지가 거기 있다. 새 기능은 그 문서의
> [새 기능 추가 절차](docs/backend-development-guide/ddd-guide.md#새-기능-추가-절차) 순서를 따른다.

| 상황 | 참고 문서 |
|------|----------|
| **설계 — 애그리거트·엔티티·값 객체·레이어** | [`docs/backend-development-guide/ddd-guide.md`](docs/backend-development-guide/ddd-guide.md) |
| 모듈 구조·패키지 규약 | [`docs/backend-development-guide/module-structure.md`](docs/backend-development-guide/module-structure.md) |
| API 엔드포인트 추가·수정 | [`docs/backend-development-guide/api/endpoint-convention.md`](docs/backend-development-guide/api/endpoint-convention.md) |
| 인증·JWT·OAuth | [`docs/backend-development-guide/auth-guide.md`](docs/backend-development-guide/auth-guide.md) |
| 보안·개인정보 마스킹 | [`docs/backend-development-guide/security-guide.md`](docs/backend-development-guide/security-guide.md) |
| OOP·캡슐화·DTO 변환 | [`docs/backend-development-guide/oop-guide.md`](docs/backend-development-guide/oop-guide.md) |
| 테스트 코드 작성 | [`docs/backend-development-guide/testing-guide.md`](docs/backend-development-guide/testing-guide.md) |
| 입력 검증 (`@Valid`) | [`docs/backend-development-guide/validation-guide.md`](docs/backend-development-guide/validation-guide.md) |
| 예외 처리 | [`docs/backend-development-guide/exception-handling-guide.md`](docs/backend-development-guide/exception-handling-guide.md) |
| 로깅 | [`docs/backend-development-guide/logging-guide.md`](docs/backend-development-guide/logging-guide.md) |
| JPA·BaseEntity·N+1·트랜잭션 | [`docs/backend-development-guide/jpa-guide.md`](docs/backend-development-guide/jpa-guide.md) |
| 스키마 변경·마이그레이션·테이블 이름·외래키 | [`docs/backend-development-guide/database-guide.md`](docs/backend-development-guide/database-guide.md) |
| 데이터 모델 — 테이블·컬럼·상태값·전이 (ERD) | [`docs/erd/README.md`](docs/erd/README.md) — 테이블당 md 1개, 변경은 PR |

#### BE 핵심 요약

1. **DDD 먼저** — 애그리거트를 정하고 규칙을 엔티티에 둔다. 서비스는 조립만 한다
2. **엔티티는 `BaseEntity` 상속** — `createdAt`/`updatedAt` 을 손으로 채우지 않는다
3. **테이블 이름은 대문자**(`USERS`), 컬럼은 소문자 snake_case
4. **스키마를 만드는 주체는 환경마다 하나** — prod·로컬은 Flyway(`validate`), **stage 는
   Hibernate(`update`, Flyway off)**. 둘 다 켜면 나중에 `Duplicate column` 으로 죽는다.
   엔티티를 바꿨으면 같은 PR 에 `V{n}__*.sql` — 검증은 `backend-migration-check` CI 가 한다
5. **외래키는 애그리거트 안에만** — 애그리거트 사이는 ID 참조 + 인덱스
6. **에러 응답은 `{errorCode, errorMessage}` 하나뿐** — 성공 응답에는 래퍼(`success`)가 없다.
   `BusinessException(ErrorCode.X, "...")` 로 던지면 `GlobalExceptionHandler` 가 변환한다
7. **PII 마스킹** — 응답과 로그에 개인정보 평문 노출 금지
8. **캡슐화** — 엔티티 상태 변경은 의미 있는 메서드로. setter 금지
9. **테스트를 같이 낸다** — 통합은 성공 1건 + 실패 코어(401/400/403/404), 단위는 규칙의 세부까지.
   `@DisplayName` 은 한글로
10. **기존 API 활용** — 새 엔드포인트 전에 기존 것 확장으로 해결 가능한지 먼저 확인

### Frontend (Next.js)

| 상황 | 참고 문서 |
|------|----------|
| 프로젝트 구조·Turbo·Mock | [`docs/frontend-development-guide/project-structure.md`](docs/frontend-development-guide/project-structure.md) |
| 인증 흐름 (OAuth·BFF) | [`docs/frontend-development-guide/auth-flow.md`](docs/frontend-development-guide/auth-flow.md) |
| 컴포넌트 작성 패턴 | [`docs/frontend-development-guide/component-guide.md`](docs/frontend-development-guide/component-guide.md) |
| 관심사 분리 | [`docs/frontend-development-guide/separation-of-concerns.md`](docs/frontend-development-guide/separation-of-concerns.md) |
| API 연동·에러/로딩 처리 | [`docs/frontend-development-guide/api-integration.md`](docs/frontend-development-guide/api-integration.md) |

#### FE 핵심 요약

1. **관심사 분리** — 페이지(데이터 fetch) / 컴포넌트(렌더링) / lib(로직·API) 역할 구분
2. **API 레이어** — `lib/api/` 에 모아두고 컴포넌트에서 직접 fetch 하지 않는다
3. **Server Component 기본** — `'use client'` 는 인터랙션 필요한 말단에만
4. **Mock 교체** — `// TODO(api)` 검색 → mock import 를 API 함수 호출로 교체

---

## 관련

- 승격 원본(도그푸딩): fleet `apps/bakg`, `.bakg/`
- 에픽: fleet `issues/ongoing-1/studyclub-plusplus-service-setup/`
- 도메인: studyclub-plusplus.com / stage / api / back-office / back-office-stage
