# 테스트 가이드

> [`AGENT.md`](../../AGENT.md) §개발 규칙의 2~4번(로직을 바꾸면 테스트 · 버그는 재현 테스트 먼저 · 빠진 테스트 채우기)을 이 레포에서 어떻게 지키나. 규칙 자체는 거기가 정본이다.
> 백엔드 테스트의 계층 · 이름 · 실패 코어는 [`backend-development-guide/testing-guide.md`](../backend-development-guide/testing-guide.md), 화면 E2E 와 스크린 카탈로그는 [`e2e-guide.md`](e2e-guide.md) 에 있다. 여기서는 겹치지 않는 것만 쓴다.

## 버그 수정 — 재현 테스트 먼저

1. 제보된 증상을 그대로 재현하는 테스트를 쓴다 (입력 · 화면 동작 · 기대 결과)
2. **고치기 전 코드에서 돌려 실패하는 것을 본다.** 처음부터 통과하면 증상을 재현하지 못한 테스트다
3. 고친 뒤 통과를 확인하고 같은 PR 에 낸다. PR 본문에 「고치기 전 실패」 를 한 줄 남긴다

## 화면 규칙은 화면으로 테스트한다

버튼이 막힌다 · 문구가 바뀐다 · 입력한 시각이 그대로 보인다처럼 화면에서 보이는 규칙은 함수 단위 테스트로 끝내지 않는다.
그 컴포넌트를 그려서(vitest + Testing Library) 또는 화면을 띄워서(Playwright, [`e2e-guide.md`](e2e-guide.md)) 확인한다. 함수는 맞는데 화면이 다른 경우를 잡으려는 것이다.

## 이름은 한국어로

테스트 이름은 무엇을 확인하는지 한국어 문장으로 쓴다. 백엔드의 `@DisplayName` 과 같은 규칙이다.
예: `it('제목만 고쳐도 시작 시각이 바뀌지 않는다', …)`

## 이 레포의 칸

| 무엇 | 명령 (위치) | 테스트 위치 |
|---|---|---|
| 프론트 단위 · 컴포넌트 | `pnpm test` (`frontend/`) · 한 앱만 `pnpm --filter <앱> test` | 대상 파일 옆 `*.test.ts(x)` |
| 프론트 화면 E2E | [`e2e-guide.md`](e2e-guide.md) §실행 | `frontend/apps/<앱>/e2e/` |
| 백엔드 | `./gradlew check` (`backend/`) | 모듈의 `src/test/` |
| 턴 끝 타입 검사 (자동) | `.claude/hooks/typecheck-on-stop.sh` — 손댄 앱 · 패키지의 `typecheck`, 백엔드는 `compileJava compileTestJava` | — |

PR 에서 로직 파일만 바뀌고 테스트 파일이 없으면 `pr-dev-rules` 워크플로가 경고를 단다. 실패시키지는 않는다 — 테스트가 정말 필요 없는 변경이면 PR 본문에 이유를 한 줄 쓴다.
