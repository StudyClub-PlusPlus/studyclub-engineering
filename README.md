# studyclub-engineering

StudyClub++ 코드 모노레포 (**public**). 미국·캐나다·한국의 개발자 스터디 클럽 서비스.

- 사용자 사이트: https://studyclub-plusplus.com
- 운영 콘솔: https://back-office.studyclub-plusplus.com
- API: https://api.studyclub-plusplus.com

> ⚠️ **PUBLIC 레포** — `.env`·토큰·키·개인정보 등 민감정보 커밋 금지. 자세한 규칙은 [`CLAUDE.md`](./CLAUDE.md).

## 구조

```
frontend/                # Node 워크스페이스 (npm + turbo)
  apps/
    core-front/          # 사용자향 (Next.js 16, ko/en) — 랜딩·스터디·행사·가이드·공지·소개
    back-office-front/   # 운영자향 (Next.js 16) — 스터디/행사/멤버/캡틴 관리 콘솔
  packages/
    mock/                # 하드코딩 mock 데이터 + 공유 타입 (@studyclub/mock)
backend/                 # Spring Boot 3 멀티모듈 (Gradle Kotlin DSL, Java 17)
  api/                   # 실행 모듈 — REST API (:8080)
  domain/                # 도메인 모델
  common/                # 공통 (ApiResponse 등)
```

현재 프론트는 `@studyclub/mock` 하드코딩 데이터로 동작하고, 백엔드는 기본 스캐폴드 단계입니다.
실 API 연동 지점은 코드에 `// TODO(api)` 로 표시돼 있습니다.

## 실행

### Frontend

```bash
cd frontend
npm install
npm run dev                              # turbo — 모든 앱 동시
# 개별 실행
npm run dev --workspace=core-front       # http://localhost:4700
npm run dev --workspace=back-office-front # http://localhost:4701
# 빌드
npm run build
```

- Node 20+ 필요.
- 데이터 수정: `frontend/packages/mock/src/index.ts` (스터디/행사/멤버/캡틴/공지).

### Backend

```bash
cd backend
gradle :api:bootRun                      # http://localhost:8080
# gradle 미설치 시 wrapper 생성 후 사용
gradle wrapper && ./gradlew :api:bootRun
# 빌드 (실행 jar)
gradle :api:bootJar                      # → api/build/libs/app.jar
```

주요 엔드포인트:

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/` | `StudyClub++ API` |
| GET | `/api/health` | `{ "status": "UP" }` |
| GET | `/api/studies` | 스터디 목록 (현재 더미) |

Docker:

```bash
docker build -f backend/Dockerfile -t studyclub-api backend
docker run -p 8080:8080 studyclub-api
```

## 배포 (CI/CD)

`main` push → 프로덕션, `develop` push → 스테이지. GitHub Actions 가 도커 이미지 빌드·푸시 후 K8s 롤아웃.

| 워크플로 | 대상 | 이미지 |
|---|---|---|
| `core-front-{main,develop}` | core-front | `hyperrealitycorp/studyclub-core-front-{production,stage}` |
| `back-office-front-{main,develop}` | back-office-front | `…-back-office-front-{production,stage}` |
| `backend-{main,develop}` | api | `…-studyclub-api-{production,stage}` |

- 프론트 워크플로 docker context = `frontend/`, 백엔드 = `backend/`.
- 시크릿(도커·SSH·슬랙)은 레포 GitHub Actions Secret 으로 주입 (코드에 평문 금지).

## 도메인

| 도메인 | 서비스 |
|---|---|
| studyclub-plusplus.com | core-front (prod) |
| stage.studyclub-plusplus.com | core-front (stage) |
| back-office.studyclub-plusplus.com | back-office-front (prod) |
| back-office-stage.studyclub-plusplus.com | back-office-front (stage) |
| api.studyclub-plusplus.com | api (prod) |

## 기여

- PR 은 CODEOWNERS(**@titaniper**) 승인 후에만 `main` 에 머지됩니다 (외부 기여자 포함).
- 외부 라이브러리 추가는 합의 필수.
