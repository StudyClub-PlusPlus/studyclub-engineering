---
name: stage-deploy
description: "기능 브랜치를 develop 에 합쳐 push 해서 stage 에 반영한다. 마이그레이션 번호 확인 → 로컬 merge → 테스트 → push → 배포 워크플로 감시 → stage 확인까지. 「stage 에 올려」「stage 반영」「develop 에 합쳐」"
---

# /stage-deploy — 기능 브랜치를 stage 에

**stage = develop 브랜치.** develop 에 push 되면 바뀐 경로의 `*-develop-CI` 워크플로가 이미지를 빌드해 stage 서버에 올린다.
평소 릴리스는 `beta → develop` PR 로 묶어서 가지만, **기능 하나를 먼저 stage 에서 확인할 때** 이 절차를 쓴다.

## 사용법

```
/stage-deploy                    # 지금 브랜치
/stage-deploy feat/profile-image # 브랜치 지정
```

## 어디가 배포되나

| 바뀐 경로 | 워크플로 | 확인 주소 |
|---|---|---|
| `backend/**` | `backend-develop-CI` (+ `backend-migration-check`) | `https://api-stage.studyclub.life/api/health` |
| `frontend/apps/core-front/**` · `frontend/packages/**` | `core-front-develop-CI` | `https://stage.studyclub.life` |
| `frontend/apps/back-office-front/**` · `frontend/packages/**` | `back-office-front-develop-CI` | `https://back-office-stage.studyclub.life` |
| `frontend/packages/ui/**` | `storybook-develop-CI` 도 | — |

빌드 결과는 슬랙 `#build-status` 에 뜬다.

## 절차

### 1. 대상과 마이그레이션 번호

```bash
git fetch origin develop <브랜치>
# develop 의 마지막 번호 vs 브랜치가 새로 넣는 번호 — 겹치면 멈춘다
git ls-tree --name-only origin/develop backend/domain/src/main/resources/db/migration/ | sed 's/.*\/V\([0-9]*\)__.*/\1/' | sort -n | tail -1
git diff --name-only --diff-filter=A origin/develop...origin/<브랜치> -- backend/domain/src/main/resources/db/migration/
```

- **새 마이그레이션은 stage DB 에 바로 실행되고 되돌리지 않는다.** 번호가 develop 마지막+1 이 아니면 멈추고 사람에게 묻는다
- 이 브랜치가 stage 의 무엇을 바꾸는지(새 env 가 필요한가 등) PR 본문의 「머지 전 확인」을 읽는다. stage 서버 env 는 인프라 레포 소관이다 — 없으면 사람에게 알린다

### 2. 로컬에서 합친다

작업 트리가 깨끗한지 먼저 본다 (`git status --short`). 남의 변경이 있으면 stash 하지 말고 묻는다.

```bash
git checkout -B develop origin/develop
git merge --no-ff --no-commit <브랜치>
```

- **충돌이 나면 멈춘다.** `git merge --abort` 하고 사람에게 어느 파일이 충돌하는지 알린다. 임의로 해소하지 않는다

### 3. 합친 결과로 테스트

바뀐 쪽만 돌린다. 하나라도 깨지면 `git merge --abort` 하고 push 하지 않는다.

```bash
(cd backend && ./gradlew spotlessCheck check)
(cd frontend/apps/core-front && npx vitest run)
(cd frontend/apps/back-office-front && npx vitest run)
# 프론트가 바뀌었으면 빌드도 — vitest·tsc 는 서버 컴포넌트 경계('use client' 누락)를 못 잡는다
(cd frontend && pnpm install --frozen-lockfile && pnpm --filter core-front run build && pnpm --filter back-office-front run build)
```

> 2026-10-16: `@studyclub/ui` 에 새 훅을 넣으면서 `'use client'` 를 빠뜨렸다. vitest·tsc 는 통과했고
> stage 이미지 빌드(`next build`)에서만 터졌다. **ui 패키지에 훅·상태를 쓰는 파일을 추가하면 맨 위에 `'use client'`.**

로컬에 패키지가 덜 깔려 실패하는 것(`Cannot find module 'msw'` 등)은 이번 변경과 무관하다 — 같은 파일이 develop 에서도 실패하는지로 가린다. 무관하면 보고에 그렇다고 적는다.

### 4. 커밋 · push

```bash
git commit -m "chore(release): <브랜치> → develop — <무엇> stage 반영 (#<PR>)"
git push origin develop
```

- **force push 하지 않는다.** develop 은 보호가 없어 막히지 않는다 — 그래서 더 조심한다
- push 가 거절되면(그 사이 develop 이 움직임) 1단계부터 다시

### 5. 배포 감시

```bash
gh run list --branch develop --limit 10 --json databaseId,workflowName,status,conclusion,headSha \
  -q '.[] | select(.headSha|startswith("<merge SHA 7자리>"))'
gh run watch <databaseId> --exit-status
```

실패하면 `gh run view <id> --log-failed` 로 원인을 보고하고 멈춘다. develop 을 되돌리지 않는다 — 사람이 정한다.

### 6. stage 확인

- `curl -s https://api-stage.studyclub.life/api/health` — 새 이미지가 떴는지
- 기능 확인은 `prober` 로 케이스를 만들어 돌린다 (`/prober:extract` → `/prober:smoke`)
- 테스트 발송(메일·디스코드)은 테스트 수신함으로만

### 7. 원래 브랜치로

```bash
git checkout <브랜치>
```

## 보고

| 무엇 | 값 |
|---|---|
| 합친 커밋 | `[무엇(SHA)](커밋 URL)` |
| 워크플로 | 이름 / 결과 / 걸린 시간 |
| 마이그레이션 | 새로 실행된 번호, 없으면 없음 |
| stage 확인 | 무엇을 눌러 봤나 · 결과 |
| 남은 것 | env 누락 · 실패한 워크플로 등 |

## 알려진 함정

- **새 env 가 필요한 기능은 stage 서버 env 부터.** 배포 스크립트는 원격 서버(`deployment/studyclub/api-stage.sh`)에 있고 이 레포 밖이다.
  2026-10-16 이미지 업로드를 올렸을 때 S3 env 가 없어 503 이었다 — push 전에 PR 「머지 전 확인」의 env 를 인프라 담당자에게 먼저 요청한다
- **stage 백오피스는 ADMIN 계정이어야 한다.** MEMBER 로 로그인돼 있으면 `/studies` 가 403 으로 통째로 죽는다(React #441) — 배포 문제로 착각하지 않는다
