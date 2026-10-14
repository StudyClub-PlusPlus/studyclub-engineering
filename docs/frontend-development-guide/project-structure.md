# Project Structure

## Table of Contents

- [Overview](#overview)
- [Turbo 모노레포](#turbo-모노레포)
- [앱 구성](#앱-구성)
- [디렉토리 구조](#디렉토리-구조)
- [공유 패키지 (packages/*)](#공유-패키지-packages)
- [Mock 데이터](#mock-데이터)
- [실행](#실행)

## Overview

Next.js App Router 기반. Turborepo 로 세 개 앱 + 공유 패키지를 관리.

```
frontend/
├── apps/
│   ├── core-front/           # 사용자향 (studyclub-plusplus.com) :4700
│   ├── back-office-front/    # 운영자향 (back-office.studyclub-plusplus.com) :4701
│   └── playground/           # 컴포넌트 개발·실험용 :4702
├── packages/
│   ├── design/               # 디자인 시스템 토큰 & 정본 CSS (@studyclub/design)
│   ├── ui/                   # 공유 UI 컴포넌트 라이브러리 + Storybook (@studyclub/ui)
│   ├── mock/                 # 공유 mock 데이터 + 타입 (@studyclub/mock)
│   ├── eslint-config/        # 공유 ESLint 설정
│   └── prettier-config/      # 공유 Prettier 설정
├── turbo.json
├── package.json              # 워크스페이스 루트
└── tsconfig.base.json        # 공유 TS 설정
```

## Turbo 모노레포

`package.json` 의 `workspaces`:

```json
{
  "workspaces": ["apps/*", "packages/*"]
}
```

각 앱/패키지는 자체 `package.json` 을 가짐. 루트에서 `pnpm run dev` 하면 turbo 가 모든 앱을 병렬 실행.

## 앱 구성

### core-front (사용자향)

| 항목 | 값 |
|------|-----|
| 도메인 | studyclub-plusplus.com |
| 포트 | 4700 |
| 주요 기능 | 랜딩, 스터디 목록, 이벤트, 마이페이지, 구글 로그인 |
| i18n | `[locale]` 동적 라우트 (ko/en) |

### back-office-front (운영자향)

| 항목 | 값 |
|------|-----|
| 도메인 | back-office.studyclub-plusplus.com |
| 포트 | 4701 |
| 주요 기능 | 스터디 관리, 이벤트 관리, 회원 관리, 구글 로그인 |

## 디렉토리 구조

각 앱의 구조:

```
apps/{app}/
├── src/
│   ├── app/              # Next.js App Router 라우트
│   │   ├── [locale]/     # (core-front 전용) i18n 라우트
│   │   ├── api/          # Route Handlers (BFF)
│   │   └── layout.tsx
│   ├── features/         # 기능별 묶음 (타입·fetcher·쿼리 훅·전용 컴포넌트)
│   │   └── studies/{types.ts, queries.ts, StudiesTable.tsx}
│   ├── components/       # 두 기능 이상이 쓰는 UI
│   ├── lib/              # 순수 유틸 (http, auth, query-client, i18n)
│   └── middleware.ts     # Next.js 미들웨어 (인증 리다이렉트)
├── screen-catalog/       # 화면 상태 선언 (비주얼 회귀 카탈로그)
│   ├── catalog.ts
│   ├── types.ts
│   ├── viewports.ts
│   ├── pages/
│   └── features/{flow}/{feature}.feature + .meta.ts
├── e2e/
│   ├── playwright.config.ts
│   ├── specs/            # smoke 테스트
│   └── screen-catalog/   # 비주얼 회귀 러너
│       ├── runScreenState.ts
│       ├── waitForPageStable.ts
│       ├── adapters/
│       └── specs/__screenshots__/   # golden 스냅샷 (커밋 대상)
└── .gitignore
```

### 파일 배치 규칙 — 기능 옆에 둔다

**판정 한 문장** — *"이 기능이 없어지면 같이 지워지는가."* 그렇다면 `features/<기능>/` 안이다.

| 무엇 | 어디 | 예 |
|---|---|---|
| 한 기능에서만 쓰는 타입·fetcher·쿼리 훅·컴포넌트 | `src/features/<기능>/` | `features/studies/{types,queries}.ts`, `features/studies/StudiesTable.tsx` |
| **두 기능 이상**이 쓰는 UI | `src/components/` | `ui.tsx`, `AppShell.tsx` |
| 순수 유틸 (기능 지식이 없는 것) | `src/lib/` | `http.ts`, `auth.ts`, `query-client.ts` |
| 라우트 | `src/app/` | `page.tsx` — **조립만** 한다, fetch 를 직접 쓰지 않는다 |
| BFF Route Handler | `src/app/api/` | `api/studies/route.ts` |

- **이름 규칙** — 컴포넌트 파일만 PascalCase, 그 밖의 파일·폴더는 전부 **kebab-case**

  | 무엇 | 규칙 | 예 |
  |---|---|---|
  | 컴포넌트 (`.tsx`, 컴포넌트 하나를 export) | PascalCase = 컴포넌트명 | `UsersTable.tsx` · `RoleBadgeSelect.tsx` |
  | 훅 | kebab-case, `use-` 로 시작 | `use-debounced-value.ts` · `use-revealed-emails.ts` (함수명은 `useDebouncedValue`) |
  | 유틸·타입·라벨·쿼리 | kebab-case (한 단어면 소문자) | `query-client.ts` · `login-errors.ts` · `queries.ts` · `labels.ts` |
  | 폴더 | kebab-case | `features/notification-templates/` |
  | Next 특수 파일 | 프레임워크 규칙 그대로 | `page.tsx` · `layout.tsx` · `not-found.tsx` · `opengraph-image.tsx` |

  - **camelCase 파일명(`useXxx.ts`)을 쓰지 않는다.** 파일명은 kebab, 그 안의 함수·변수명은 camelCase 다
  - **왜 kebab 인가** — macOS 파일시스템은 대소문자를 구분하지 않아 `useUser.ts` → `UseUser.ts` 같은 변경을 git 이 못 알아채고, Linux CI 에서만 import 가 깨진다. 소문자만 쓰면 그 사고가 없다. Next 라우트·특수 파일도 소문자·하이픈이라 한 규칙으로 맞는다
  - **컴포넌트를 PascalCase 로 두는 이유** — React 생태계에서 가장 흔하고, 이미 150개가 넘는다. 바꾸는 비용이 얻는 것보다 크다
  - 실측 (2026-10-10, 테스트·라우트 제외): PascalCase 153 · 소문자 한 단어 128 · kebab 22 · camelCase 1 → 이 규칙은 이미 쓰던 방식을 적은 것이다
- **`lib/api/` 처럼 타입별 서랍을 만들지 않는다.** 기능 하나를 고치는 데 서랍 네 개를 열게 된다
- 처음부터 폴더를 쪼개지 않는다 — 파일 하나로 시작해서 커지면 나눈다. 빈 `index.ts` 를 두지 않는다
- **`src/models/` 은 쓰지 않는다**(레거시). 타입은 그 기능의 `types.ts` 로 간다

상세: [API 연동 가이드](api-integration.md) · [관심사 분리](separation-of-concerns.md)

## 공유 패키지 (packages/*)

### 1. `@studyclub/design` — 디자인 시스템 & 정본 CSS
- **토큰 SSOT**: `tokens.css` (OKLCH 기반 1계층 Primitive + 2계층 Semantic 토큰 원천)
- **정본 CSS 진입점**:
  - `base.css`: 공통 토큰 + 기본 엘리먼트 reset + `.card` 등 공통 셸
  - `core.css`: 사용자 서비스 전용 스타일 (`core-front`, `playground proto/core`)
  - `console.css`: 운영자 콘솔 전용 고밀도 스타일 (`back-office-front`, `playground proto/console`)
- 각 앱의 `globals.css`는 위 정본 CSS 중 하나를 `@import`하여 사용합니다.
- 상세: [`frontend/packages/design/docs/design-system.md`](../../frontend/packages/design/docs/design-system.md)

### 2. `@studyclub/ui` — 공용 UI 컴포넌트 & Storybook
- `design-system.md` §9 스펙을 구현한 공용 리액트 컴포넌트 라이브러리
- 제공 컴포넌트: `Button`, `Badge`, `Card`, `Field`(`Input`/`Select`/`Textarea`), `FilterChip`, `Avatar`, `StatCard`, `CapacityBar`, `Checkbox`, `Modal`, `EmptyState`, `Toast`(`Toaster`), `StudyCard`, `AttendanceTable`, `Tabs`, `Nav`, `Segmented`, `Pagination`
- **Storybook 9 (react-vite)** 환경 탑재 (`pnpm --prefix frontend storybook` 실행)
- 상세: [Component Guide](component-guide.md) · [Storybook Guide](storybook-guide.md)

### 3. `@studyclub/mock` — Mock 데이터 & MSW

현재 프론트는 **mock 데이터로 동작**. 백엔드 API 완성 시 교체 예정.

### packages/mock 구조

```
frontend/packages/mock/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     # 패키지 최상위 진입점 (types, data re-export)
    ├── types.ts                     # 하위 호환성을 위한 types, constants, utils 통합 export
    │
    ├── constants/                   # 상수 정의
    │   ├── study.ts                 # 카테고리 표시명, 신청 폼 템플릿 등
    │   ├── community.ts
    │   └── index.ts
    │
    ├── types/                       # 도메인 모델 인터페이스/타입 정의
    │   ├── study.ts                 # Study, StudyProgram, Recruitment 등
    │   ├── crew.ts
    │   ├── community.ts
    │   └── index.ts
    │
    ├── utils/                       # 날짜/텍스트 포맷팅 등 유틸 함수
    │   ├── study.ts
    │   ├── crew.ts
    │   └── index.ts
    │
    ├── data/                        # 순수 Mock 데이터 소스
    │   ├── index.ts                 # studies, crew, community re-export
    │   ├── crew.ts
    │   ├── community.ts
    │   └── studies/                 # 스터디 도메인 원본 데이터
    │       ├── helpers.ts           # StudyDraft 타입 및 데이터 빌더 헬퍼
    │       ├── recruiting.ts        # 모집 중 데이터
    │       ├── ongoing.ts           # 진행 중 데이터
    │       ├── closed-2026.ts       # 2026년 마감 데이터
    │       ├── closed-2025.ts       # 2025년 마감 데이터
    │       ├── closed-2024.ts       # 2024년 마감 데이터
    │       └── index.ts             # 시드 병합 및 Study[] export
    │
    └── msw/                         # MSW (Mock Service Worker) 계층
        ├── index.ts                 # MSW 초기화 및 통합 진입점
        ├── context.ts               # 핸들러 프리셋/오버라이드 컨텍스트
        ├── utils.ts                 # mockClient 및 핸들러 그룹 생성기
        ├── provider.tsx             # React용 MSW Provider
        ├── devtool.tsx              # MSW 시나리오 변경 DevTool UI
        ├── data.ts                  # 도메인 모델(Study) -> 백엔드 API DTO(ApiStudy) 변환 매퍼
        └── handlers/                # API 엔드포인트별 핸들러
            ├── index.ts             # 전체 핸들러 취합
            ├── accounts.ts          # 계정 관련 엔드포인트 (/api/accounts/*)
            ├── notification-templates.ts
            └── studies.ts           # 스터디 관련 엔드포인트 (/api/studies/*)
```

**데이터 수정**:
- 스터디: `src/data/studies/` (`recruiting.ts`, `ongoing.ts`, `closed-*.ts`)
- 크루: `src/data/crew.ts`
- 커뮤니티·행사·공지: `src/data/community.ts`  
**타입·상수 수정**: `src/types/`, `src/constants/`  
**MSW 핸들러·변환 수정**: `src/msw/handlers/`, `src/msw/data.ts`

### 사용

```typescript
// mock 데이터
import { studies, events } from '@studyclub/mock';

// MSW 유틸리티 (개발 서버에서 API 인터셉트)
import { mockHandlerGroups, MSWProvider } from '@studyclub/mock/msw';
```

API 교체 지점은 `// TODO(api)` 주석으로 표시되어 있음.

교체 시:
1. `// TODO(api)` 검색
2. mock import 를 fetch/API 호출로 교체
3. `packages/mock` 은 테스트/스토리북용으로 유지 가능

## 실행

```bash
# 프로젝트 루트에서 바로 실행할 때
pnpm --prefix frontend storybook              # Storybook (:6006)
pnpm --prefix frontend run dev                # 전체 앱 동시 실행

# frontend/ 디렉토리에서 실행할 때
cd frontend && pnpm install
pnpm run dev                                  # turbo — 모든 앱 동시 실행
# 개별 앱
pnpm run dev:core-front                       # :4700
pnpm run dev:back-office-front                # :4701
pnpm run dev:playground                       # :4702
pnpm run storybook                            # :6006
```
