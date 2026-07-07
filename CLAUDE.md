# StudyClub++ · AI Agent Context

이 파일은 Claude / Codex / 다른 AI agent 가 이 모노레포에서 작업을 시작할 때 처음 읽는 컨텍스트.

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

## 관련

- 승격 원본(도그푸딩): fleet `apps/bakg`, `.bakg/`
- 에픽: fleet `issues/ongoing-1/studyclub-plusplus-service-setup/`
- 도메인: studyclub-plusplus.com / stage / api / back-office / back-office-stage
