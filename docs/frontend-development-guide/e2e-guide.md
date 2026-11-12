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

페이지 접근뿐 아니라 신청 폼·참여자 관리 등 주요 행동도 검증한다. 실제 검증 범위는 각 앱의 `e2e/specs/`를 확인한다.

### Screen Catalog 테스트

`screen-catalog/` 에 선언된 화면 상태를 순서대로 실행하며 스크린샷을 찍는다.
이전 스냅샷과 픽셀 단위로 비교해 의도치 않은 UI 변경을 감지한다.

---

## 실행

아래 명령은 `frontend/apps/core-front` 또는 `frontend/apps/back-office-front`에서 실행한다.

```bash
# smoke 테스트
pnpm run test:e2e

# 비주얼 회귀 — 스냅샷 비교
pnpm run test:e2e:catalog

# 비주얼 회귀 — 스냅샷 갱신 (UI 변경을 의도적으로 반영할 때)
pnpm run test:e2e:catalog:update

# Playwright UI 모드 (디버깅)
pnpm run test:e2e:ui
```

> `test:e2e:catalog` 는 `--workers=1` 로 강제 직렬 실행된다.
> 각 테스트는 독립 page/context를 쓴다. 직렬 실행은 리소스 사용과 fixture 실행의 안정성을 위한 현재 설정이다.

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

먼저 [core-front PRD 대응표](./core-e2e-prd-map.md) 또는 [관리자 PRD 대응표](./admin-e2e-prd-map.md)에서 Story의 완료 기준과 상태별 화면을 찾는다.
core-front는 `CORE-ST-###-S##`·`V##`, 관리자는 `BO-ST-###-S##`·`V##`를 `prdScenarios`에 연결한다.
`back-office-front/screen-catalog/features/prd/*.feature`에 연결된 `BO-ST-###-S##`(행동)·`V##`(화면 상태)를
실행 정의와 연결한다. `@planned`는 예정 명세이며 현재 러너가 실행하는 테스트가 아니다.
기존 카탈로그의 `@catalog-partial`·`@relates-*`는 일부 화면만 다룬다는 뜻이다.
PRD에 서로 다른 규정이 있는 `@needs-prd-review` 항목은 기대값을 확정한 뒤 구현한다.
`@code-baseline`은 사용자 요청으로 현재 코드 동작을 기준 삼은 항목이며, PRD 원문과의 차이를 주석과 대응표에 남긴다.

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
pnpm run test:e2e:catalog:update
```

---

## 스냅샷 관리

- `__screenshots__/` 는 **git 커밋 대상**이다. 리뷰어가 UI 변경을 이미지로 확인할 수 있다.
- UI를 **의도적으로 바꿨을 때**만 `test:e2e:catalog:update` 로 스냅샷을 갱신하고 커밋한다.
- 일반 비교 실행에서 허용 오차를 넘는 차이가 있으면 실패한다. CI에서도 실행하려면 워크플로에 카탈로그 명령과 브라우저 설치를 명시해야 한다.
- 갱신 후에는 이미지를 열어 상태가 맞는지 확인하고, 업데이트 옵션 없이 다시 실행한다.
- `waitForPageStable`의 대기는 네트워크 완료나 레이아웃 안정성을 보장하지 않는다. `main` 외에 그 상태만의 문구·컨트롤을 assertion으로 지정한다.

---

## back-office 인증 우회

back-office는 `bo_access_token` 쿠키가 없으면 `/login` 으로 리다이렉트된다.
스모크 테스트에서는 `BO_DEV_BYPASS_AUTH=1` 환경변수로 미들웨어를 우회한다.

화면 카탈로그는 로그인 화면도 검증하므로 우회를 끄고, 운영 화면에만 테스트 쿠키를 넣는다.
`test:e2e:catalog` 스크립트는 `APP_API_MOCKING=enabled`로 브라우저 MSW를 켠다.
서버에서 읽는 스터디 목록은 `e2e/mock-api.mjs`의 고정 데이터, 관리자 회차·출석 API는
`e2e/screen-catalog/stubSchedule.ts`의 고정 응답을 사용한다.
일정의 요일·시각만 `bo_schedule_time:1`에 시드하며, 회차는 이전의 `bo_schedule:1` 저장소를 사용하지 않는다.
관리자 E2E는 환경 설정이 다른 서버의 재사용을 막으므로 실행 전 앱 4701·mock API 4702 포트를 비워 둔다. Playground도 4702를 사용하므로 동시에 실행하지 않는다.

`playwright.config.ts`가 실행 모드에 따라 우회 여부·API 주소·MSW 환경을 설정하고 앱과 mock API 서버를 함께 띄운다. 카탈로그에 `BO_DEV_BYPASS_AUTH=1`을 추가하지 않는다.

> `BO_DEV_BYPASS_AUTH` 는 `NODE_ENV=development` 일 때만 동작한다.
> production 빌드에서는 절대 우회되지 않는다.

### 백오피스 신규 PRD 화면 카탈로그

`screen-catalog/features/prd/{studies,operations,dashboard}.meta.ts`의 45개 상태(48장)는
`prdScenarios`로 Gherkin 명세에 연결한다. 대응표에서 스크린샷을 바로 열 수 있다.
`@catalog-partial`은 화면 일부가 연결됐다는 뜻이며, `@planned` 행동 전체를 완료 처리하지 않는다.

이 상태들의 `recipe.api`는 Playwright context에서 정확한 경로·메서드별 고정 응답을 제공한다.
브라우저 MSW 핸들러는 해당 컨텍스트에서 끄고, 정의하지 않은 API 호출은 실패시킨다.
`pending` 응답은 테스트 종료까지 보류하므로 로딩·저장 중 화면을 임의 대기 시간 없이 캡처한다.
API 주소는 카탈로그 서버 환경에서 고정하며 로컬 `.env`의 주소에 의존하지 않는다.

```bash
# 화면 카탈로그 재생성 후 비교 (back-office-front에서)
pnpm run test:e2e:catalog --update-snapshots=all
pnpm run test:e2e:catalog
```

스크린샷 이름은 출처와 관계없이 `{pageId}--{state}--{viewport}.png`로 통일한다. PRD 연결은 `prdScenarios`에 기록한다.

## core-front PRD 카탈로그

[대응표](./core-e2e-prd-map.md)는 PRD 16개의 완료 기준 149개·상태 112개와 실행 근거를 연결한다.
`features/prd/states.meta.ts`에서 편집·회차 추가·발표 설명·영문 약관을 추가하고 기존 메타데이터에도 `prdScenarios`를 붙였다.
기존 50장에서 약관·처리방침 모바일과 신규 상태 8장을 더해 총 60장이다.
브라우저 시각은 `2026-10-31T03:00:00Z`로 고정하며 페이지 진입 URL도 확인한다.

core-front는 기존 개발 MSW와 회원 시드를 사용한다. 서버에서 읽는 공개 데이터 일부는 로컬 API에 의존한다.
특히 공지 빈 목록은 DB에 공지가 없는 조건이 필요하며, 빈 안내 문구를 assertion으로 확인한다.
실제 OAuth·저장·탈퇴·메일/Discord 발송 검증을 기본 화면 캡처로 대신하지 않는다.

`study-apply--modal`·`study-apply--discord-gate`는 각각 `study-detail--application-form`·`study-detail--discord-gate`로 바꿨다.
두 앱 모두 PRD 출처는 파일명 접두어 대신 `prdScenarios`에 기록한다.

### 백오피스 개발 서버와 E2E를 함께 실행할 때

기존 4701 개발 서버를 유지해야 하면 앱·mock API 포트와 Next 빌드 디렉터리를 함께 분리한다. E2E 설정의 `APP_PORT`는 테스트 URL뿐 아니라 실행하는 Next 서버 포트에도 적용된다.

```bash
cd frontend/apps/back-office-front
APP_PORT=4711 APP_API_MOCK_PORT=4712 APP_DIST_DIR=.next/e2e-validation pnpm run test:e2e --workers=1
APP_PORT=4711 APP_API_MOCK_PORT=4712 APP_DIST_DIR=.next/e2e-validation pnpm run test:e2e:catalog
```

`APP_DIST_DIR`를 생략하면 기본 `.next`를 사용한다. 포트만 바꾸고 빌드 디렉터리를 공유하면 같은 앱의 개발 서버 잠금·생성 파일이 충돌할 수 있다.
