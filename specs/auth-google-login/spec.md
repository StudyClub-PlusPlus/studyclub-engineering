# 구글 로그인 + 최소 유저 (zapp 패턴 이식)

## WHAT

core-front·back-office-front 의 `/login` 에 **구글 소셜 로그인**을 붙이고, **Spring 백엔드가 User·JWT 의
주인**이 된다. 로그인해야 **수강생 페이지(A8)** 가 뜨고, 백오피스는 **이메일 allowlist** 통과자만 들어온다.
DB 가 0 에서 시작이라 **로컬 MySQL + docker-compose 신설**이 P0 의 첫 작업.

레퍼런스: zapp `specs/back-office-google-login/spec.md` + `apps/core-api/.../auth-service.ts`.
스택 차이: zapp=NestJS/TS, StudyClub=**Spring Boot 3.3 / Java 17** — 플로우·정책은 이식, 코드는 재작성.

## HOW

### 로컬 스택 (docker-compose, 신설)

```
docker compose up
  mysql:8.0     studyclub DB (host :3310 → 3306), utf8mb4, 볼륨 영속
  api           :8080  Spring Boot, JPA→mysql (ddl-auto=update)
  frontend      :4700 core-front / :4701 back-office-front  (node:20, turbo dev 단일 컨테이너)
```

- 시크릿은 **PUBLIC 레포 금지** → `.env`(gitignore) 로 주입, `.env.example`(커밋)에 로컬 더미만.
  `application.yml` 은 `${DB_PASSWORD}` 등 env 참조만, 평문 비밀번호/토큰 0.
- 프론트는 단일 컨테이너에서 `npm run dev`(turbo)로 두 앱 동시 기동 — install race 회피. per-app
  스토리지 prefix 는 **코드 상수**(core=`sc_`, bo=`bo_`)로 두어 공유 env 충돌 회피.

### 인증 플로우 (zapp 이식)

```
core /login ──팝업──▶ Google OAuth ──redirect──▶ Next /api/auth/callback
   ▲  postMessage({code}) ◀───────────────────────────┘
   ▼
Next /api/auth/social/login  (BO 는 여기서 platform=BACK_OFFICE 서버측 강제 주입)
   ▼
Spring POST /auth/social-login { code, provider, platform }
   getGoogleUserInfo(code) → email/name/picture/sub
   platform=BACK_OFFICE 면 assertBackOfficePermitted(email)  ← allowlist(env) 강제
   미가입이면 자동가입(role=STUDENT) → JWT access(7d)/refresh(30d) 발급
```

### 백엔드 (Spring, 신규)

| 표면 | 위치 |
|---|---|
| User 엔티티 | `domain` : `id, email(uniq), name, picture, googleSub, role(STUDENT\|OPERATOR\|ADMIN), createdAt` |
| 인증 서비스 | `api` : Google code→token→userinfo 교환, 자동가입, JWT 발급, `assertBackOfficePermitted` |
| 엔드포인트 | `POST /auth/social-login`, `GET /auth/me`, `POST /auth/refresh` |
| 보안 | SecurityConfig(JWT 필터, `/auth/**`·`/api/health` permitAll, 나머지 인증) |
| allowlist SoT | env `BACK_OFFICE_ALLOWED_EMAILS`(콤마, 소문자 무시), fallback = 운영자 이메일 |

### 프론트 (core + BO)

- `/login` + 구글 버튼 → 팝업 → Next API 라우트 → api `/auth/social-login`.
- **세션키 앱별 격리** (zapp 가 데인 함정: localhost 쿠키 domain 공유 오염 → 백지 데드락): core=`sc_`, bo=`bo_`.
- core `/[locale]/my`(수강생 A8) 신규 — 미로그인 `/login` 바운스, 로그인 시 유저 + 내 스터디(당분간 mock).
- BO 전 페이지 로그인 + allowlist 게이트(미들웨어), `platform=BACK_OFFICE` 는 BO Next 라우트에서 강제.

## 한계 / 후속

- admin 컨트롤러 **롤가드는 후속** (zapp 도 미룸) — 현재 방어선은 allowlist + JWT.
- **prod K8s MySQL 은 terraform 후속** — 이번은 로컬 compose 만.
- 구글 code 오류 시 500 가능(토큰교환 예외 미처리, zapp 과 동일 초기 한계).
- **GCP OAuth 클라이언트 등록은 사람 작업** — 등록 전까지 스캐폴드·엔드포인트·게이팅·부팅까지 완비, 실제 왕복만 이후 검증.

## 변경이력

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-07-18 | 최초 작성 — 구글 로그인 + 최소 User(Spring 중심) + 로컬 MySQL/compose | fleet 이슈 `studyclub-plusplus-google-login` |
