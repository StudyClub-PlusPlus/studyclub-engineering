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

Next.js 16.4.1 · React 19.2.4 App Router 기반 (2026-10-31 package.json 기준). Turborepo 로 세 개 앱 + 공유 패키지를 관리.

```
frontend/
├── apps/
│   ├── core-front/           # 사용자향 (studyclub.life) :4700
│   ├── back-office-front/    # 운영자향 (back-office.studyclub.life) :4701
│   └── playground/           # 컴포넌트 개발·실험용 :4702
├── packages/
│   ├── design/               # 디자인 시스템 토큰 & 정본 CSS (@studyclub/design)
│   ├── ui/                   # 공유 UI 컴포넌트 라이브러리 + Storybook (@studyclub/ui)
│   ├── mock/                 # mock 데이터 및 MSW (@studyclub/mock)
│   ├── types/                # 공용 도메인·국제화 타입 (@studyclub/types)
│   ├── utils/                # 공용 함수·상수 (@studyclub/utils)
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
| 도메인 | studyclub.life |
| 포트 | 4700 |
| 주요 기능 | 랜딩, 스터디 목록, 이벤트, 마이페이지, 구글 로그인 |
| i18n | `[locale]` 동적 라우트 (ko/en) |

### back-office-front (운영자향)

| 항목 | 값 |
|------|-----|
| 도메인 | back-office.studyclub.life |
| 포트 | 4701 |
| 주요 기능 | 대시보드, 스터디·회원·공지 관리, 알림 템플릿·발송 이력, 구글 로그인 |

## 디렉토리 구조

각 앱의 구조:

```
apps/{app}/
├── src/
│   ├── app/              # Next.js App Router 라우트
│   │   ├── [locale]/     # (core-front 전용) i18n 라우트
│   │   ├── api/          # 인증·가입·닉네임 확인 Route Handlers
│   │   └── layout.tsx
│   ├── features/         # 기능별 묶음 (타입·fetcher·쿼리 훅·전용 컴포넌트)
│   │   └── studies/{types.ts, queries.ts, StudiesTable.tsx}
│   ├── components/       # 두 기능 이상이 쓰는 UI
│   ├── lib/              # 공통 기반 (http, cookies, query-client, i18n)
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

### core-front 기능별 구조

백오피스처럼 기능의 API·규칙·화면·테스트를 `features/<기능>/`에 함께 둔다. 기존 `lib/api.ts`·`lib/content.ts`의 여러 기능을 한데 모은 진입점은 제거했다. 호출부는 담당 기능을 직접 참조한다.

| 기능 폴더 | 책임 |
|---|---|
| `auth` · `onboarding` | 로그인·세션, 가입 입력·동의·API |
| `account` · `profile` | 계정 공통 타입·탈퇴·정리, 프로필·닉네임·Discord 연결 |
| `studies` · `applications` | 공개 스터디 목록·상세, 신청 폼·검증·제출 |
| `my-studies` · `bookmarks` | 내 스터디 조회·카드 변환, 찜 저장·버튼 |
| `schedule` · `attendance` | 회차·발표·규칙·시간대, 출석부·일괄 변경 |
| `study-notices` · `site-notices` | 반 공지 발송, 공개 사이트 공지 조회 |
| `events` · `community` · `legal` | 행사 콘텐츠, 커뮤니티 정보, 약관·처리방침 |

기능 안에서는 필요한 파일만 만든다. 작은 기능에 빈 파일이나 재수출 전용 `index.ts`를 만들지 않는다.

```text
features/<기능>/
  types.ts          요청·응답·화면 타입
  repository.ts     HTTP 요청 (서버용인지 브라우저용인지 명시)
  queries.ts        React Query 키·훅·캐시 무효화
  server.ts         서버 페이지의 조회·오류 처리
  model.ts          화면 계산·도메인 규칙 (복잡한 변환은 mapper.ts)
  schema.ts         Zod 입력 검증 (여러 폼은 form-schema.ts 등)
  response-schema.ts API 응답 런타임 검증
  Component.tsx     기능 전용 화면, 필요하면 components/ 하위
  *.test.ts(x)      검증하는 코드 옆의 테스트
```

`lib`에는 앱 설정에 의존하는 HTTP 전송, 쿠키, QueryClient, 국제화 메시지, SEO, 분석, 업로드 등을 둔다. 브라우저 JSON 저장소·서울 날짜·옛 도메인 리다이렉트는 `@studyclub/utils`에 있으며 앱의 `lib`에 복제하지 않는다. `components`에는 헤더·푸터·내비게이션·시간대 선택기 등 공유 UI를 둔다. 두 앱의 인증 로직은 `features/auth/auth.ts`에 둔다.

공개 목록의 SSR 캐시와 브라우저 조회를 섞지 않는다. core-front의 `studies/repository.ts`는 서버 조회에 기존 ISR을 유지하고, 공지 repository는 `no-store`를 유지한다. 이동 과정에서 React Query 키를 바꾸지 않아 일정 저장 후 출석·내 스터디 갱신 경로가 유지된다.

### 파일 배치 규칙 — 기능 옆에 둔다

**판정 한 문장** — *"이 기능이 없어지면 같이 지워지는가."* 그렇다면 `features/<기능>/` 안이다.

| 무엇 | 어디 | 예 |
|---|---|---|
| 한 기능에서만 쓰는 타입·fetcher·쿼리 훅·컴포넌트 | `src/features/<기능>/` | `features/studies/{types,queries}.ts`, `features/studies/StudiesTable.tsx` |
| **두 기능 이상**이 쓰는 UI | `src/components/` | `ui.tsx`, `AppShell.tsx` |
| 앱 설정에 의존하는 공통 코드 | `src/lib/` | `http.ts`, `cookies.ts`, `query-client.ts` |
| 앱 간 공용 타입 | `packages/types/src/` | `Locale`, `L10n`, `Study` |
| 앱에 의존하지 않는 공용 함수·상수 | `packages/utils/src/` | `readJSON`, `seoulDate`, `CATEGORY_DISPLAY` |
| 라우트 | `src/app/` | `page.tsx` — 화면 조립. 서버 조회는 `features/<기능>/server.ts`에 위임한다 |
| 인증 Route Handler | `src/app/api/auth/` | `social/login/route.ts`, `logout/route.ts` |

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

### 3. `@studyclub/types` — 공용 타입

`src/i18n.ts`의 `Locale`·`L10n`과 `study.ts`·`crew.ts`·`community.ts`의 모델 타입을 제공한다. 실행 코드나 앱·mock에 의존하지 않는다. 한 기능에서만 쓰는 요청·응답·폼 타입은 해당 기능의 `types.ts`·`schema.ts`에 둔다.

### 4. `@studyclub/utils` — 공용 함수·상수

| 파일 (`packages/utils/src/`) | 책임 |
|---|---|
| `browser-storage.ts` | localStorage JSON 읽기·쓰기, 저장 실패 시 기본 처리 |
| `study.ts` · `seoul-date.ts` | 날짜 변환, 스터디 표시 상태, 서울 날짜 계산 |
| `crew.ts` | 출석 점수·출석률 계산 |
| `constants.ts` | 카테고리 표시명·목록, 지역·시간대 상수 |
| `legacy-domain.ts` | 옛 도메인의 리다이렉트 주소 계산 |

`utils`는 공용 타입과 Zod를 참조한다. 인증 상태, 앱 환경 변수, Next 라우트, React 훅에 의존하는 코드는 이 패키지에 넣지 않는다. `readJSON(key, schema, fallback)`은 JSON 파싱과 Zod 구조 검증을 모두 수행한다. 값이 없거나 파싱·검증·저장소 접근에 실패하면 기본값을 반환한다. 도메인 스키마는 호출 기능이 소유한다.

### 공용 코드의 소유권

- `@studyclub/types`: `Locale`, `L10n`, 스터디·참여자·커뮤니티 모델 타입. 실행 코드나 mock 데이터에 의존하지 않는다.
- `@studyclub/utils`: 날짜 변환, 스터디 표시 상태, 출석 계산, 카테고리·지역 상수, 브라우저 JSON 저장소, 옛 도메인 리다이렉트. 공용 타입과 Zod를 참조한다.
- `@studyclub/mock`: 예시 데이터·신청 폼·사이트 설정과 MSW 핸들러. 공용 타입·함수를 재수출하지 않는다. MSW 응답 DTO·변환 코드는 현재 `mock/msw`에 유지한다.
- 인증, HTTP, 쿠키 정책, React 훅 등 앱 동작에 의존하는 코드는 각 앱에 둔다.

```ts
import type { Locale, L10n, Study } from '@studyclub/types';
import { readJSON, toISODate, CATEGORY_DISPLAY } from '@studyclub/utils';
import { studies } from '@studyclub/mock';
```

의존성 방향은 `앱 → types/utils/mock`, `mock → types/utils`, `utils → types`다. 공용 패키지가 앱을 참조하거나 mock 데이터가 공용 타입·유틸리티로 역유입되지 않도록 한다.

소비하는 앱·패키지의 `package.json`에 `workspace:*` 의존성을 선언한다. 세 Next 앱은 `transpilePackages`에 새 패키지를 등록한다. 추가·이동 후 `pnpm-lock.yaml`을 함께 갱신하고 타입 검사·관련 테스트를 실행한다.

### 5. `@studyclub/mock` — Mock 데이터 & MSW

core-front·back-office-front는 실제 백엔드 API를 사용한다. 개발 환경의 브라우저 요청에는 다음 조건으로 MSW를 적용한다.

| 앱 | MSW 활성 조건 |
|---|---|
| core-front | `NODE_ENV=development` |
| back-office-front | development이고 `NEXT_PUBLIC_API_MOCKING=enabled` |
| playground | 프로토타입의 mock 데이터·MSW 사용 |

브라우저 MSW는 서버 컴포넌트의 fetch를 가로채지 않는다. 백오피스 E2E는 서버 목록용 mock API와 브라우저 응답을 따로 준비한다. 실제 연결 범위는 기능별 PRD §3과 API 스펙으로 확인한다.

### packages/mock 구조

```
frontend/packages/mock/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                     # mock 데이터·설정 진입점
    │
    ├── constants/                   # 상수 정의
    │   ├── study.ts                 # 예시 신청 폼 템플릿
    │   ├── community.ts
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
            ├── accounts.ts          # 관리자 회원 엔드포인트 (/api/admin/users)
            ├── notification-templates.ts
            └── studies.ts           # 스터디 관련 엔드포인트 (/api/studies/*)
```

**데이터 수정**:
- 스터디: `src/data/studies/` (`recruiting.ts`, `ongoing.ts`, `closed-*.ts`)
- 크루: `src/data/crew.ts`
- 커뮤니티·행사·공지: `src/data/community.ts`  
**공용 타입 수정**: `packages/types/src/`

**공용 함수·상수 수정**: `packages/utils/src/`

**MSW 핸들러·변환 수정**: `src/msw/handlers/`, `src/msw/data.ts`

### 사용

```typescript
// mock 데이터
import { studies, events } from '@studyclub/mock';

// MSW 유틸리티 (개발 서버에서 API 인터셉트)
import { mockHandlerGroups, MSWProvider } from '@studyclub/mock/msw';
```

남아 있는 mock 교체 지점은 `// TODO(api)`와 기능별 쿼리·PRD 개발 범위를 함께 확인한다. 주석 유무만으로 전체 API 연동 상태를 판정하지 않는다.

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

## 테스트와 화면 근거

`e2e/specs`는 접근 확인과 행동 테스트, `screen-catalog`는 화면 상태·스크린샷 비교를 담당한다.
`.feature` 파일 자체는 실행되지 않고 `catalog.ts`에 등록된 `.meta.ts`가 실행된다.
자세한 명령과 인증 fixture는 [E2E 가이드](e2e-guide.md), PRD 연결은 [core-front 대응표](core-e2e-prd-map.md)·[관리자 대응표](admin-e2e-prd-map.md)를 참고한다.

백오피스 E2E의 mock API 기본 포트도 **4702**이므로 playground와 동시에 실행하면 충돌한다.
필요하면 `APP_API_MOCK_PORT`를 바꾼다. 앱 서버 포트는 각 앱 package.json의 `dev` 스크립트를 확인한다.

## 두 앱의 구조 정렬과 검증 경계

core-front와 back-office-front는 `features/<기능>/` 아래에 화면·폼 스키마·응답 스키마·repository·queries를 둔다. 서비스가 제공하는 기능이 달라 폴더 이름과 개수가 같을 필요는 없다.

백오피스의 스터디 폼·등록/정보/Discord 연결 화면은 `features/studies`, 행사 폼·대화상자는 `features/events`로 이동했다. `lib/api.ts`의 스터디 서버 조회는 `features/studies/server.ts`, 목록 변환은 `model.ts`가 담당한다. 최상위 `components`에는 앱 공통 셸·사이드바·UI만 둔다.

- `repository.ts`: HTTP 요청과 필수 응답 스키마. `queries.ts`는 repository 호출과 캐시 정책을 담당한다.
- `form-schema.ts`·`schema.ts`: Zod 입력 규칙과 `z.infer` 폼 타입. RHF는 `zodResolver`와 `handleSubmit`으로 연결한다.
- `response-schema.ts`: 외부 API·인증 응답의 실제 데이터 구조를 검증한다.
- 저장소: 공용 JSON 저장소는 `readJSON(key, schema, fallback)`으로 검증한다. 세션·온보딩 초안·일정의 전용 저장소도 각 스키마의 `parse`·`safeParse`를 거친다. 잘못된 값은 해당 기능의 기본값이나 미로그인 상태로 되돌린다.

검색·필터, 출석·반 편성의 일괄 편집은 해당 상태 모델을 유지한다. 모든 UI 상태를 RHF에 넣는 규칙은 아니다.
