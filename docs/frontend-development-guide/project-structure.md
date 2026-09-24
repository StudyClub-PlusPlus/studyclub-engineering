# Project Structure

## Table of Contents

- [Overview](#overview)
- [Turbo 모노레포](#turbo-모노레포)
- [앱 구성](#앱-구성)
- [디렉토리 구조](#디렉토리-구조)
- [Mock 데이터](#mock-데이터)
- [실행](#실행)

## Overview

Next.js App Router 기반. Turborepo 로 세 개 앱 + 공유 패키지를 관리.

```
frontend/
├── apps/
│   ├── core-front/           # 사용자향 (studyclub-plusplus.com) :4700
│   ├── back-office-front/    # 운영자향 (back-office.studyclub-plusplus.com) :4701
│   └── playground/           # 컴포넌트 개발·실험용
├── packages/
│   ├── ui/                   # 공유 UI 컴포넌트 라이브러리 (@studyclub/ui)
│   ├── design/               # 디자인 토큰·CSS 변수 (@studyclub/design)
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

각 앱/패키지는 자체 `package.json` 을 가짐. 루트에서 `npm run dev` 하면 turbo 가 모든 앱을 병렬 실행.

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

- 기능 폴더 이름은 kebab-case (`notification-templates`), 컴포넌트 파일은 PascalCase, 나머지는 camelCase
- **`lib/api/` 처럼 타입별 서랍을 만들지 않는다.** 기능 하나를 고치는 데 서랍 네 개를 열게 된다
- 처음부터 폴더를 쪼개지 않는다 — 파일 하나로 시작해서 커지면 나눈다. 빈 `index.ts` 를 두지 않는다
- **`src/models/` 은 쓰지 않는다**(레거시). 타입은 그 기능의 `types.ts` 로 간다

상세: [API 연동 가이드](api-integration.md) · [관심사 분리](separation-of-concerns.md)

## Mock 데이터

현재 프론트는 **mock 데이터로 동작**. 백엔드 API 완성 시 교체 예정.

```typescript
// 사용
import { studies, events } from '@studyclub/mock';
```

API 교체 지점은 `// TODO(api)` 주석으로 표시되어 있음.

교체 시:
1. `// TODO(api)` 검색
2. mock import 를 fetch/API 호출로 교체
3. `packages/mock` 은 테스트/스토리북용으로 유지 가능

## 실행

```bash
# 전체 (turbo)
cd frontend && npm install && npm run dev

# 개별 앱
npm run dev --workspace=core-front        # :4700
npm run dev --workspace=back-office-front # :4701

# Storybook
npm run storybook --workspace=@studyclub/ui  # :6006
```
