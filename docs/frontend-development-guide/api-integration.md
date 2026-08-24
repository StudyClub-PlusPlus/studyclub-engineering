# API Integration Guide

## Table of Contents

- [현재 상태](#현재-상태)
- [API 레이어 구조](#api-레이어-구조)
- [Mock → 실 API 교체 전략](#mock--실-api-교체-전략)
- [에러 & 로딩 처리](#에러--로딩-처리)

## 현재 상태

프론트는 `@studyclub/mock` 패키지의 하드코딩 데이터로 동작 중.
백엔드 API 가 완성되면 교체 예정. 교체 지점은 `// TODO(api)` 주석으로 표시.

## API 레이어 구조

API 호출은 `lib/api/` 에 모아둔다. 컴포넌트에서 직접 `fetch` 하지 않는다.

```
src/lib/api/
├── client.ts          # 공용 fetch wrapper (baseURL, 인증 헤더, 에러 처리)
├── studies.ts         # 스터디 관련 API
├── events.ts          # 이벤트 관련 API
└── auth.ts            # 인증 관련 API
```

### fetch wrapper

```typescript
// lib/api/client.ts
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:8080';

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? 'Request failed');
  }

  const json = await res.json();
  return json.data;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
```

### 도메인별 API 함수

```typescript
// lib/api/studies.ts
import { api } from './client';
import type { Study } from '@/models/Study';

export function fetchStudies(): Promise<Study[]> {
  return api('/studies');
}

export function fetchStudy(id: string): Promise<Study> {
  return api(`/studies/${id}`);
}

export function joinStudy(id: string): Promise<void> {
  return api(`/studies/${id}/members`, { method: 'POST' });
}
```

## 인증 & 쿠키

### 쿠키 자동 전송

`sc_access_token` httpOnly 쿠키는 **동일 오리진 요청에 자동으로 포함**된다. `fetch` 에 `credentials: 'include'` 를 추가할 필요 없다. 단, `/api/auth/*` BFF Route Handler 는 쿠키를 읽어 백엔드에 `Authorization: Bearer <token>` 헤더로 전달한다.

클라이언트 코드에서 직접 백엔드를 호출하지 않는다 — 반드시 `/api/*` BFF 를 거쳐야 한다.

### 401 처리 — 토큰 재발급 후 재시도

access token 이 만료되면 백엔드가 401 을 반환한다. 클라이언트는 다음 순서로 처리한다:

```typescript
// lib/api/client.ts — 401 재시도 포함 예시
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (res.status === 401) {
    // refresh 시도
    const refreshed = await fetch('/api/auth/refresh', { method: 'POST' });
    if (!refreshed.ok) {
      // refresh 도 실패 → 로그인 페이지로
      window.location.href = '/login';
      throw new ApiError(401, 'Session expired');
    }
    // 원래 요청 재시도 (1회)
    const retry = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    if (!retry.ok) throw new ApiError(retry.status, 'Request failed after refresh');
    return (await retry.json()).data;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.message ?? 'Request failed');
  }
  return (await res.json()).data;
}
```

Server Component 에서의 401 은 미들웨어가 차단하기 전에 발생하지 않는다. 위 패턴은 Client Component 의 mutation(POST/PUT/DELETE) 에 적용한다.

## Mock → 실 API 교체 전략

### Step 1: `// TODO(api)` 검색

```bash
grep -rn "TODO(api)" frontend/apps/
```

### Step 2: mock import → API 함수 호출로 교체

```tsx
// Before (mock)
import { studies } from '@studyclub/mock';

export default function StudiesPage() {
  return <StudyBrowser studies={studies} />;
}

// After (API)
import { fetchStudies } from '@/lib/api/studies';

export default async function StudiesPage() {
  const studies = await fetchStudies();
  return <StudyBrowser studies={studies} />;
}
```

### Step 3: 기존 API 확인

새 API 함수를 만들기 전에 — 이미 있는 API 로 해결 가능한지 확인 (Common Guide 참고).

## 에러 & 로딩 처리

### Server Component (기본)

Next.js App Router 의 `error.tsx` 와 `loading.tsx` 활용:

```
app/studies/
├── page.tsx          # 데이터 fetch (async)
├── loading.tsx       # fetch 중 자동 표시
└── error.tsx         # fetch 실패 시 자동 표시
```

```tsx
// app/studies/loading.tsx
export default function Loading() {
  return <div className="animate-pulse">로딩 중...</div>;
}

// app/studies/error.tsx
'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <p>오류가 발생했어요: {error.message}</p>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

### Client Component (인터랙션)

`'use client'` 컴포넌트에서 mutation(POST/PUT/DELETE) 할 때:

```tsx
'use client';

import { useState } from 'react';
import { joinStudy } from '@/lib/api/studies';
import { ApiError } from '@/lib/api/client';

export default function JoinButton({ studyId }: { studyId: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleJoin() {
    setStatus('loading');
    try {
      await joinStudy(studyId);
      // 성공 → 페이지 새로고침 또는 라우터 리프레시
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof ApiError ? e.message : '오류가 발생했어요');
    }
  }

  return (
    <>
      <button onClick={handleJoin} disabled={status === 'loading'}>
        {status === 'loading' ? '참여 중...' : '참여하기'}
      </button>
      {status === 'error' && <p className="text-red-500">{errorMsg}</p>}
    </>
  );
}
```

### 원칙

1. **Server Component**: `loading.tsx` + `error.tsx` 로 선언적 처리
2. **Client Component**: `useState` 로 `idle | loading | error` 3상태 관리
3. **사용자 피드백 필수**: 로딩 중임을 알리고, 에러 시 메시지 + 재시도 버튼
4. **에러 메시지는 사용자 친화적으로**: "Failed to fetch" (X) → "스터디 목록을 불러올 수 없어요" (O)
