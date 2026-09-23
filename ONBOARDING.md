# 온보딩 — 클론부터 로그인까지

StudyClub++ 를 처음 받은 사람이 **이 문서 하나만 위에서부터 따라가면** 로컬에서 화면을 띄우고 구글 로그인까지 되게 하는 것이 목표다.
막히면 맨 아래 [자주 막히는 곳](#자주-막히는-곳)부터 본다.

> ⚠️ **이 레포는 PUBLIC 이다.** 비밀번호·키·토큰을 커밋·이슈·PR·공개 채널에 절대 붙여넣지 않는다.
> 값이 필요하면 담당자에게 DM 으로 받고, 로컬 `.env`(gitignore)에만 둔다. 규칙 전문은 [AGENT.md](AGENT.md).

---

## 1. 클론하고 `.env` 만들기 — 모두 공통

```bash
git clone https://github.com/StudyClub-PlusPlus/studyclub-engineering.git
cd studyclub-engineering
git switch beta          # 개발 브랜치. PR 도 beta 로 보낸다
cp .env.example .env     # 이 파일 하나로 docker · 로컬 backend · 로컬 frontend 가 전부 돈다
```

`.env.example` 에는 로컬에서 바로 도는 더미값이 이미 들어 있다. **채워야 하는 것은 아래 하나뿐이다.**

### 🔑 담당자에게 받을 값

| 값 | 없으면 | 받는 곳 |
|---|---|---|
| `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` | 화면은 뜨지만 **구글 로그인 버튼이 막힌다** | 담당자 **@titaniper** 에게 DM |
| `MAIL_NOTIFY_*` (선택) | 메일만 안 나간다 | 담당자에게 DM — 메일 기능을 만들 때만 |
| `DISCORD_TOKEN` (선택) | 봇 로그인만 안 된다 | 담당자에게 DM — 봇 작업할 때만 |

받은 값은 `.env` 의 해당 줄 `=` 뒤에 붙여넣는다. `GOOGLE_REDIRECT_URI` 와 프론트 포트(4700/4701)는 **바꾸지 않는다** — 구글에 등록된 콜백 주소라 바꾸면 `redirect_uri_mismatch` 로 로그인이 깨진다.

---

## 2. 실행 방식 고르기

하는 일에 맞춰 **하나만** 고른다. 모르겠으면 **A**.

| | 방식 | 이런 사람 | 필요한 것 |
|---|---|---|---|
| **A** | [전부 Docker](#a-전부-docker-추천) (추천) | 처음이다 · 기획·디자인 · 일단 보고 싶다 | Docker Desktop |
| **B** | [DB·API 는 Docker, 프론트만 로컬](#b-dbapi-는-docker-프론트만-로컬) | 프론트 개발 — 저장하면 바로 반영, 디버거 | Docker Desktop · Node 20+ |
| **C** | [백엔드도 로컬](#c-백엔드도-로컬) | 백엔드 개발 — IDE 에서 실행·디버그 | Docker Desktop · JDK 25 · Node 20+ |
| **D** | [프론트만 띄워 운영 API 에 붙이기](#d-프론트만-운영-api-에-붙이기) | 실제 데이터로 화면만 확인 | Node 20+ |

어느 방식이든 결과 주소는 같다.

| 무엇 | 주소 |
|---|---|
| 사용자 사이트 (core-front) | http://localhost:4700 |
| 운영 콘솔 (back-office-front) | http://localhost:4701 |
| 프로토타입 (playground) | http://localhost:4702 |
| API (A·B) | http://localhost:28080 — 문서 http://localhost:28080/scalar |
| MySQL | `localhost:23310` · DB/계정/비번은 `.env` 의 `MYSQL_*` |

### A. 전부 Docker (추천)

```bash
docker compose up -d --build
```

첫 실행은 이미지 빌드와 `npm install` 때문에 몇 분 걸린다. 진행 상황은 `docker compose logs -f frontend`.
`core-front:dev: ✓ Ready` 가 보이면 http://localhost:4700 을 연다.

```bash
docker compose logs -f api      # 백엔드 로그
docker compose down             # 끄기 (데이터 유지)
docker compose down -v          # 끄고 DB 까지 비우기
```

### B. DB·API 는 Docker, 프론트만 로컬

```bash
docker compose up -d mysql api                 # DB + API 만

# Next 는 앱 폴더의 .env.local 만 읽는다 → 루트 .env 를 가리키는 심링크를 한 번 만든다
ln -sfn ../../../.env frontend/apps/core-front/.env.local
ln -sfn ../../../.env frontend/apps/back-office-front/.env.local

cd frontend
npm install
npm run dev                                    # core 4700 · back-office 4701 · playground 4702
```

- 앱 하나만: `npm run dev --workspace=core-front`
- A 로 띄운 `frontend` 컨테이너가 있으면 포트가 겹친다 → `docker compose stop frontend` 먼저

### C. 백엔드도 로컬

```bash
docker compose up -d mysql                     # DB 만

cd backend
set -a && source ../.env && set +a             # .env 를 환경변수로 올린다 (DB 접속은 MYSQL_* 로 자동)
SERVER_PORT=28080 ./gradlew :api:bootRun       # 28080 으로 띄우면 .env 의 프론트 설정을 안 고쳐도 된다
```

- JDK 25 필요. Gradle 은 wrapper 가 받아오므로 따로 설치하지 않는다
- IntelliJ 에서 돌릴 때는 Run Configuration 의 Environment variables 에 `.env` 를 넣고 `SERVER_PORT=28080` 을 추가한다 (EnvFile 플러그인이 편하다)
- 프론트는 B 의 심링크·`npm run dev` 그대로

### D. 프론트만 운영 API 에 붙이기

`.env` 의 「(선택) 로컬 frontend 를 운영 API 에 붙이기」 블록 주석을 풀고, 바로 위 Frontend 블록의 같은 이름 줄을 지운다. 그다음 B 의 심링크·`npm run dev` 만 한다 (Docker 불필요).

> ⚠️ **운영 데이터다.** 신청·등록 같은 쓰기는 실제로 반영된다. 화면 확인용으로만 쓴다.
> stage API 는 외부 주소가 없다 — stage 로 확인할 일은 담당자에게 문의.

---

## 3. 로그인 확인

1. http://localhost:4700/ko/login → **Google 계정으로 로그인** → 팝업에서 계정 선택
2. 처음 로그인하면 계정이 자동으로 만들어진다 (역할 `STUDENT`)

### 운영 콘솔(4701)에 들어가려면 — ADMIN 이 필요하다

운영 콘솔은 ADMIN 만 로그인되고 **가입이 없다.** 로컬에서는 core-front 로 한 번 로그인해 계정을 만든 뒤 스스로 올린다.

```bash
# 레포 루트에서. 메일 주소만 내 것으로 바꾼다
set -a && source .env && set +a
docker compose exec -T mysql mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" \
  -e "UPDATE ACCOUNT SET SYSTEM_ROLE='ADMIN' WHERE email='내구글메일@gmail.com';"
```

그다음 http://localhost:4701 에서 같은 구글 계정으로 로그인한다.

> 로컬 DB 에서만 한다. 운영·stage 의 권한은 담당자가 준다.

---

## 자주 막히는 곳

| 증상 | 원인 | 해결 |
|---|---|---|
| 로그인 버튼을 누르면 "구글 OAuth 클라이언트가 아직 설정되지 않았습니다" | `.env` 에 `GOOGLE_CLIENT_ID` 가 비어 있다 | 담당자에게 받아 채운 뒤 A 는 `docker compose up -d frontend api`, B·C 는 `npm run dev` 재시작 (NEXT_PUBLIC 값은 시작할 때 굳는다) |
| 구글 팝업에 `redirect_uri_mismatch` · "액세스 차단됨" | 콜백 주소나 포트를 바꿨다 | `GOOGLE_REDIRECT_URI=http://localhost:4700/api/auth/callback`, 프론트 포트 4700 으로 되돌린다 |
| api 가 계속 재시작되고 로그에 `Migration checksum mismatch` | 내 로컬 DB 를 만든 뒤 마이그레이션 파일(`V*.sql`)이 바뀌었다 | 로컬이면 DB 를 비운다: `docker compose down -v && docker compose up -d --build` |
| `npm run dev` 가 `Turbopack ... Read-only file system` 으로 죽는다 | 예전 compose 가 남긴 `.next` 캐시 (컨테이너 경로가 박혀 있다) | `rm -rf frontend/apps/*/.next` 후 다시 실행. 지금 compose 는 `.next` 를 컨테이너 전용 볼륨에 둬서 다시 생기지 않는다 |
| `port is already allocated` · `EADDRINUSE :4700` | A 의 frontend 컨테이너와 로컬 `npm run dev` 를 동시에 띄웠다 | 한쪽만 쓴다 — `docker compose stop frontend` 또는 로컬 dev 종료 |
| 운영 콘솔 로그인이 거절된다 | 계정이 ADMIN 이 아니거나, core-front 로 가입한 적이 없다 | [3. 로그인 확인](#운영-콘솔4701에-들어가려면--admin-이-필요하다) |
| 화면에 스터디가 하나도 없다 | 새 로컬 DB 는 비어 있다 | 운영 콘솔(ADMIN)에서 스터디를 등록하거나 D 로 운영 데이터를 본다 |

그래도 안 되면 증상·실행 방식(A~D)·에러 로그를 담당자에게 보낸다. **로그에 토큰·키가 섞여 있으면 지우고 보낸다.**

---

## 다음에 읽을 것

- [AGENT.md](AGENT.md) — 개발 규약 전체 (PUBLIC 레포 규칙 · BE/FE 가이드 목차 · 작업 룰)
- 백엔드: [DDD 가이드](docs/backend-development-guide/ddd-guide.md) → [스펙 주도 개발](docs/backend-development-guide/spec-driven-development.md)
- 프론트: [프로젝트 구조](docs/frontend-development-guide/project-structure.md) → [인증 흐름](docs/frontend-development-guide/auth-flow.md)
- 푸시 전: 백엔드 `cd backend && ./gradlew check` · 프론트 `cd frontend && npm test`
