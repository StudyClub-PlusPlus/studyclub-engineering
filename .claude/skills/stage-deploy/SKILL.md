---
name: stage-deploy
description: "기능 브랜치를 develop 에 합쳐 push 해서 stage 에 반영한다. 마이그레이션 번호 확인 → 로컬 merge → 테스트 → push → 배포 워크플로 감시 → stage 확인까지. 사용자가 stage 반영을 시킬 때나, 작업을 마치며 「develop 에 병합해서 스테이지에 올릴까요?」에 동의했을 때 쓴다. 「stage 에 올려」「stage 반영」「스테이지에 올려」「develop 에 합쳐」"
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
| `frontend/apps/core-front/**` · `frontend/packages/**` · `frontend/*` | `core-front-develop-CI` | `https://stage.studyclub.life` |
| `frontend/apps/back-office-front/**` · `frontend/packages/**` · `frontend/*` | `back-office-front-develop-CI` | `https://back-office-stage.studyclub.life` |
| `frontend/packages/ui/**` · `frontend/packages/design/**` · `frontend/*` | `storybook-develop-CI` 도 | — |
| `discord/**` | `discord-develop-CI` | — |

프론트 3종(core-front·back-office-front·storybook)은 자기 워크플로 파일이 바뀌어도 돈다. 표와 어긋나면 `.github/workflows/*-develop.yaml` 의 `push.paths` 가 정본이다.

빌드 결과는 슬랙 `#build-status` 에 뜬다.

## 절차

### 1. 대상과 마이그레이션 번호

```bash
git fetch origin develop <브랜치>
# develop 의 마지막 번호 vs 브랜치가 새로 넣는 번호 — 겹치면 멈춘다
# 마이그레이션은 backend/domain 과 backend/notification 두 모듈에 있고 번호를 함께 쓴다
git ls-tree -r --name-only origin/develop backend | grep '/db/migration/V' | sed 's/.*\/V\([0-9]*\)__.*/\1/' | sort -n | tail -1
git diff --name-only --diff-filter=A origin/develop...origin/<브랜치> -- 'backend/*/db/migration/V*.sql'
```

- **stage 는 Flyway off — `V*.sql` 은 stage 에서 실행되지 않는다.** 스키마는 Hibernate(`update`)가 엔티티로 맞추고, 데이터 마이그레이션(INSERT·UPDATE)은 손으로 한 번 넣어야 한다([database-guide §환경별](../../../docs/backend-development-guide/database-guide.md#환경별)). 번호가 develop 마지막+1 이 아니면 prod 에서 충돌하니 멈추고 사람에게 묻는다
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

**ui 패키지에 훅·상태를 쓰는 파일을 추가하면 맨 위에 `'use client'`.** 빠뜨려도 vitest·tsc 는 통과하고 stage 이미지 빌드(`next build`)에서만 터진다.

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
gh run list --commit "$(git rev-parse HEAD)" --json databaseId,workflowName,status,conclusion
gh run watch <databaseId> --exit-status   # 나온 run 마다
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
| 마이그레이션 | 새 번호와 stage 에 손으로 넣어야 할 데이터 마이그레이션, 없으면 없음 |
| stage 확인 | 무엇을 눌러 봤나 · 결과 |
| 남은 것 | env 누락 · 실패한 워크플로 등 |

## 알려진 함정

- **새 env 가 필요한 기능은 stage 서버 env 부터.** 배포 스크립트는 원격 서버(`deployment/studyclub/api-stage.sh`)에 있고 이 레포 밖이다.
  2026-10-16 이미지 업로드를 올렸을 때 S3 env 가 없어 503 이었다 — push 전에 PR 「머지 전 확인」의 env 를 인프라 담당자에게 먼저 요청한다
- **stage 백오피스는 ADMIN 계정이어야 한다.** MEMBER 로 로그인돼 있으면 `/studies` 가 403 으로 통째로 죽는다(React #441) — 배포 문제로 착각하지 않는다
