# Project Structure

## Table of Contents

- [Overview](#overview)
- [Turbo 모노레포](#turbo-모노레포)
- [앱 구성](#앱-구성)
- [디렉토리 구조](#디렉토리-구조)
- [Mock 데이터](#mock-데이터)
- [실행](#실행)

## Overview

Next.js App Router 기반. Turborepo 로 두 개 앱 + 공유 패키지를 관리.

```
frontend/
├── apps/
│   ├── core-front/           # 사용자향 (studyclub-plusplus.com)
│   └── back-office-front/    # 운영자향 (back-office.studyclub-plusplus.com)
├── packages/
│   └── mock/                 # 공유 mock 데이터 + 타입
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
| 포트 | 3000 |
| 주요 기능 | 랜딩, 스터디 목록, 이벤트, 마이페이지, 구글 로그인 |
| i18n | `[locale]` 동적 라우트 (ko/en) |

### back-office-front (운영자향)

| 항목 | 값 |
|------|-----|
| 도메인 | back-office.studyclub-plusplus.com |
| 포트 | 3001 |
| 주요 기능 | 스터디 관리, 이벤트 관리, 회원 관리, 구글 로그인 |

## 디렉토리 구조

각 앱의 `src/` 구조:

```
src/
├── app/              # Next.js App Router 라우트
│   ├── [locale]/     # (core-front) i18n 라우트
│   ├── api/          # Route Handlers (BFF)
│   └── layout.tsx
├── components/       # 앱 전용 컴포넌트
├── lib/              # 유틸 (auth, i18n, content)
├── models/           # (core-front) 타입 정의
└── middleware.ts      # Next.js 미들웨어 (인증 리다이렉트)
```

### 파일 배치 규칙

- **컴포넌트**: `src/components/` — 파일명 PascalCase (`StudyCard.tsx`)
- **라우트**: `src/app/` — Next.js 규약 (`page.tsx`, `layout.tsx`)
- **API Route**: `src/app/api/` — BFF 용도 (백엔드 프록시, 인증 콜백)
- **유틸/헬퍼**: `src/lib/` — 파일명 camelCase (`auth.ts`)
- **타입/모델**: `src/models/` — PascalCase (`Study.ts`)

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
npm run dev --workspace=core-front
npm run dev --workspace=back-office-front
```
