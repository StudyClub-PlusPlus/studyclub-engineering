# E2E 테스트 가이드

## Table of Contents

- [개요](#개요)
- [테스트 종류](#테스트-종류)
- [실행](#실행)
- [Screen Catalog 아키텍처](#screen-catalog-아키텍처)
- [화면 상태 추가하기](#화면-상태-추가하기)
- [스냅샷 관리](#스냅샷-관리)
- [back-office 인증 우회](#back-office-인증-우회)

---

## 개요

각 앱은 Playwright 기반 E2E 테스트를 가진다. 테스트는 두 레이어로 구분된다.

| 레이어 | 위치 | 목적 |
|--------|------|------|
| **smoke** | `e2e/specs/` | 핵심 페이지 접근 가능 여부 확인 |
| **screen-catalog** | `e2e/screen-catalog/specs/` | 화면 상태별 비주얼 회귀 감지 |

---

## 테스트 종류

### Smoke 테스트

빠른 상태 확인. 페이지가 로드되고 `main` 이 보이는지만 검증한다.

### Screen Catalog 테스트

`screen-catalog/` 에 선언된 화면 상태를 순서대로 실행하며 스크린샷을 찍는다.
이전 스냅샷과 픽셀 단위로 비교해 의도치 않은 UI 변경을 감지한다.

---

## 실행

```bash
# smoke 테스트
npm run test:e2e

# 비주얼 회귀 — 스냅샷 비교
npm run test:e2e:catalog

# 비주얼 회귀 — 스냅샷 갱신 (UI 변경을 의도적으로 반영할 때)
npm run test:e2e:catalog:update

# Playwright UI 모드 (디버깅)
npm run test:e2e:ui
```

> `test:e2e:catalog` 는 `--workers=1` 로 강제 직렬 실행된다.
> 뷰포트 전환이 전역 상태이므로 병렬 실행하면 스냅샷이 오염된다.

---

## Screen Catalog 아키텍처

```
screen-catalog/              ← 선언 레이어 (화면 상태 정의)
  types.ts                   ← ScreenStateDef, Recipe, PageDef 타입
  viewports.ts               ← desktop(1280×900) / mobile(390×844)
  catalog.ts                 ← getRunnableScreenStates() 진입점
  pages/index.ts             ← 페이지 목록
  features/
    {flow}/
      {feature}.feature      ← Gherkin 시나리오 (인간용 명세)
      {feature}.meta.ts      ← ScreenStateDef 배열 (기계용 명세)

e2e/screen-catalog/          ← 실행 레이어 (Playwright 러너)
  runScreenState.ts          ← 뷰포트 → navigate → steps → assert → screenshot
  waitForPageStable.ts       ← 페이지 안정화 대기
  adapters/
    screenStep.ts            ← click / fill / wait 스텝 실행
    browserStorage.ts        ← localStorage seed (core-front)
  specs/
    screen-states.spec.ts    ← catalog 루프 → runScreenState 호출
    __screenshots__/         ← golden 스냅샷 (git 커밋 대상)
```

### ScreenStateDef 구조

```ts
{
  id: 'study-list--default',          // 스냅샷 파일명 기반 (고유해야 함)
  label: '스터디 목록 — 기본',
  pageId: 'study-list',
  rationale: '스터디 카드 그리드가 올바르게 렌더되는지 확인한다.',
  recipe: {
    storage: [                         // (선택) localStorage seed
      { key: 'sc_bookmarks', value: ['ai-paper-study'] },
    ],
    steps: [                           // (선택) 페이지 이동 후 추가 액션
      { action: 'click', selector: '[data-testid="filter-btn"]' },
    ],
    render: { url: '/ko/studies' },    // 최종 이동할 URL
  },
  viewports: ['desktop', 'mobile'],   // 생략 시 desktop 만
  assertions: {
    visible: ['main'],                 // 보여야 할 셀렉터
  },
  screenshot: { fullPage: true },
  tags: ['excluded'],                  // excluded → 실행 제외
}
```

### 실행 흐름

```
getRunnableScreenStates()
  → (excluded / deprecation 필터)
  → 각 state × viewport 조합
      → setViewportSize
      → seedBrowserStorage (storage 있을 때)
      → page.goto(render.url)
      → executeSteps
      → waitForPageStable
      → assertions
      → toHaveScreenshot → __screenshots__/{id}--{viewport}.png
```

---

## 화면 상태 추가하기

1. `screen-catalog/features/{flow}/` 에 `.feature` + `.meta.ts` 파일을 만든다.

```ts
// screen-catalog/features/events/eventList.meta.ts
import type { ScreenStateDef } from '../../types';

export const eventScreenStates: ScreenStateDef[] = [
  {
    id: 'event-list--default',
    label: '이벤트 목록 — 기본',
    pageId: 'event-list',
    rationale: '이벤트 카드 목록이 올바르게 렌더되는지 확인한다.',
    recipe: {
      render: { url: '/ko/events' },
    },
    viewports: ['desktop', 'mobile'],
    assertions: { visible: ['main'] },
    screenshot: { fullPage: true },
  },
];
```

2. `screen-catalog/catalog.ts` 에 import 해서 배열에 추가한다.

```ts
import { eventScreenStates } from './features/events/eventList.meta';

const screenStates = [
  ...homeScreenStates,
  ...studyScreenStates,
  ...authScreenStates,
  ...eventScreenStates, // ← 추가
];
```

3. 초기 스냅샷을 생성한다.

```bash
npm run test:e2e:catalog:update
```

---

## 스냅샷 관리

- `__screenshots__/` 는 **git 커밋 대상**이다. 리뷰어가 UI 변경을 이미지로 확인할 수 있다.
- UI를 **의도적으로 바꿨을 때**만 `test:e2e:catalog:update` 로 스냅샷을 갱신하고 커밋한다.
- CI에서 스냅샷이 다르면 실패한다 — 의도치 않은 회귀를 잡는 것이 목적이다.

---

## back-office 인증 우회

back-office는 `bo_access_token` 쿠키가 없으면 `/login` 으로 리다이렉트된다.
E2E 테스트에서는 `BO_DEV_BYPASS_AUTH=1` 환경변수로 미들웨어를 우회한다.

playwright.config.ts 의 `webServer.env` 에 이미 설정되어 있으므로 별도 조치 없이 작동한다.

```ts
// e2e/playwright.config.ts (back-office-front)
webServer: {
  env: { BO_DEV_BYPASS_AUTH: '1' },
  ...
}
```

> `BO_DEV_BYPASS_AUTH` 는 `NODE_ENV=development` 일 때만 동작한다.
> production 빌드에서는 절대 우회되지 않는다.
