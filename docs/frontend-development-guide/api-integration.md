# API 연동 가이드

## Table of Contents

- [세 줄 요약](#세-줄-요약)
- [인증 — 쿠키를 실어 보낸다](#인증--쿠키를-실어-보낸다)
- [어디에 두나 — 기능 옆에](#어디에-두나--기능-옆에)
- [서버 상태는 TanStack Query 로](#서버-상태는-tanstack-query-로)
- [쿼리 키](#쿼리-키)
- [변경(mutation)과 무효화](#변경mutation과-무효화)
- [에러와 401](#에러와-401)
- [서버 컴포넌트로 충분한 경우](#서버-컴포넌트로-충분한-경우)
- [응답 형태 주의](#응답-형태-주의)

## 세 줄 요약

1. 브라우저가 **백엔드를 직접 부른다.** 중계(BFF) 라우트를 만들지 않는다 — 인증은 **쿠키**로 간다
2. 조회는 `useEffect + fetch` 가 아니라 **`useQuery`** 로 한다
3. fetcher·쿼리 키·훅은 **그 기능 폴더 안에** 둔다 (`src/features/<기능>/queries.ts`)

## 인증 — 쿠키를 실어 보낸다

액세스 토큰은 **httpOnly 쿠키**다. 브라우저 JS 가 값을 읽을 수 없으니 `Authorization` 헤더를 만들 수 없다.
대신 **브라우저가 쿠키를 자동으로 싣게** 하고, 백엔드가 쿠키에서 토큰을 꺼낸다.

```ts
// src/lib/http.ts — 모든 호출이 여기를 지난다
const res = await fetch(`${API_BASE}${path}`, {
  credentials: 'include', // ← 빼면 전부 401 이다
  ...init,
});
```

```java
// JwtAuthFilter — 헤더가 먼저, 없으면 쿠키
private String resolveToken(HttpServletRequest request) {
    String header = request.getHeader("Authorization");
    if (header != null && header.startsWith("Bearer ")) return header.substring(7);
    // sc_access_token · bo_access_token
}
```

**토큰을 `localStorage` 로 내리지 않는다.** 그러면 헤더를 직접 만들 수 있지만 XSS 한 번에 털린다.
httpOnly 를 유지한 채 쿠키로 보내는 것이 이 구조의 핵심이다.

### 이 방식이 요구하는 것 — 둘 다 지켜야 한다

| 전제 | 어디서 | 안 지키면 |
|---|---|---|
| CORS 허용 오리진을 **좁게** 유지 | 백엔드 `cors.allowed-origins` | 쿠키 인증이므로 허용된 오리진은 사용자 세션으로 API 를 부를 수 있다 |
| 쿠키가 API 도메인까지 닿을 것 | `AUTH_COOKIE_DOMAIN` (배포에서만) | 배포에서 전부 401. 로컬은 host 가 같아 불필요 |

`AUTH_COOKIE_DOMAIN` 은 **넓힐수록 그 쿠키가 통하는 서브도메인이 늘어난다.** 공통 상위 도메인까지만 넣는다.
쿠키를 **지울 때도 심을 때와 같은 `domain`** 이어야 한다 — 다르면 브라우저가 다른 쿠키로 보고 원본이 남는다.

### 서버에서 부를 때

서버 컴포넌트·route handler 에서 백엔드를 부를 때는 쿠키가 자동으로 안 붙는다.
`cookies()` 로 읽어 `Authorization: Bearer` 로 직접 붙인다(서버끼리는 헤더가 자연스럽다).

`queryFn` 에서 **Server Action 을 부르지 않는다.** 공식 문서가 명시한다 — 클라이언트에서 호출된
Server Action 은 **직렬로 실행**되어 병렬 조회를 전제하는 쿼리 동작과 충돌한다.

> 백오피스 화면이 부르는 백엔드 경로는 `/api/admin/...` 이다 — [엔드포인트 규약](api/endpoint-convention.md).

## 어디에 두나 — 기능 옆에

**`lib/api/` 같은 전역 서랍에 모으지 않는다.**

```
src/features/studies/
├── types.ts          # 응답 타입 + 화면이 쓰는 행 모델 + 변환
├── queries.ts        # 쿼리 키 + fetcher + useXxx 훅
└── StudiesTable.tsx  # 이 기능에서만 쓰는 컴포넌트
```

| 기준 | 어디에 |
|---|---|
| 한 기능에서만 쓴다 | `src/features/<기능>/` — 타입·fetcher·훅·전용 컴포넌트를 **같이** |
| 여러 기능이 쓴다 | `src/components/`(UI) · `src/lib/`(순수 유틸: `http.ts`, `auth.ts`) |
| 라우트 | `src/app/` — 페이지는 **조립만** 한다. fetch 를 직접 쓰지 않는다 |
| 서버 라우트 | `src/app/api/` — **인증(쿠키 심기·지우기)만.** 데이터 중계용으로 만들지 않는다 |

**왜** — 타입별 서랍(`components/`·`lib/api/`·`models/`)으로 나누면 기능 하나를 고칠 때 서랍 네 개를 연다.
반대로 `lib/api/studies.ts` 한 파일에는 서로 무관한 화면 다섯 개의 함수가 쌓인다.
기능이 사라질 때 폴더째 지울 수 있는지가 판정 기준이다.

## 서버 상태는 TanStack Query 로

`useEffect + fetch` 로 직접 상태를 만들지 않는다. 로딩·에러·중복요청·캐시를 매번 다시 짜게 된다.

```tsx
// features/studies/queries.ts
export function useStudies(filter: StudyFilter) {
  return useQuery({
    queryKey: studyKeys.list(filter),
    queryFn: () => http<ApiStudyPage>(`/api/studies${qs({ ...filter, limit: 100 })}`), // http 가 API_BASE 를 붙인다
    select: (page) => ({ rows: page.items.map(toRow), total: page.total }),
    placeholderData: (previous) => previous, // 타이핑 중 목록이 깜빡이지 않게
  });
}

// app/studies/page.tsx — 페이지는 조립만
const { data, error, isPending } = useStudies({ keyword, category, phase });
```

**QueryClient 는 `src/lib/query-client.ts` 한 곳에서 만든다.**

```ts
// 서버는 요청마다 새로, 브라우저는 모듈 싱글턴 하나
let browserQueryClient: QueryClient | undefined;
export function getQueryClient() {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
```

- **서버에서 하나를 공유하면 A 의 캐시가 B 에게 보인다** — 요청마다 새로 만든다
- **컴포넌트 본문에서 `new QueryClient()` 를 하면** 매 렌더 캐시가 날아간다
- `useState` 로 만들지 않는다 — suspense 경계가 없으면 첫 렌더에서 버려진다 (TanStack Advanced SSR 가이드)

기본값:

| 옵션 | 값 | 왜 |
|---|---|---|
| `staleTime` | `60_000` | 기본 0이면 하이드레이션 직후 곧바로 다시 부른다 |
| `retry` | `0` | 401·403 을 세 번 더 시도해도 결과가 같다 |
| `refetchOnWindowFocus` | `false` | 운영 화면은 탭 전환이 잦다 |
| `refetchOnMount` | **건드리지 않는다(기본 true)** | `invalidateQueries` 가 unmount 된 쿼리도 stale 로 찍어, 다음 진입에 자동 갱신된다. 이게 "저장 → 목록 반영"의 전제다 |

Provider 는 `'use client'` 여야 한다. `app/providers.tsx` 로 분리하고 `layout.tsx`(서버)가 끼운다.

## 쿼리 키

**키 딕셔너리를 전역에 만들지 않는다.** 기능 폴더 안에 작은 객체 하나면 된다.

```ts
export const studyKeys = {
  all: ['studies'] as const,
  list: (filter: StudyFilter) => [...studyKeys.all, 'list', filter] as const,
};
```

- **넓은 것 → 좁은 것** 순으로 쌓는다. `studyKeys.all` 을 무효화하면 아래가 전부 딸려 간다
- **필터를 키에 넣는다.** 조건이 바뀌면 자연히 다른 캐시가 된다
- 키 팩토리 **라이브러리는 쓰지 않는다** — 화면 10개 규모에서는 손으로 쓴 객체가 더 싸다

## 변경(mutation)과 무효화

```ts
const { mutate } = useMutation({
  mutationFn: (body) => http('/api/admin/...', { method: 'PUT', body: JSON.stringify(body) }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: studyKeys.all }),
});
```

- 성공하면 **`onSuccess` 에서 무효화**한다. 어디를 무효화할지 헷갈리면 넓게(`all`) 잡는다
- 무효화 대상이 세 곳 넘게 반복되면 그때 `invalidateStudies(queryClient)` 같은 **로컬 헬퍼**로 뽑는다.
  전역 `invalidations.ts` 를 미리 만들지 않는다
- **낙관적 업데이트(`onMutate`)는 토글류에만** — 좋아요·읽음처럼 즉각 반응이 체감에 중요한 것. 관리 화면의
  저장은 그냥 무효화가 낫다(롤백 코드가 버그의 온상이다)

## 에러와 401

- 화면은 `error.message` 를 그대로 보여준다. 메시지 생성은 `lib/http.ts` 한 곳에서 한다
  (백엔드는 `errorMessage`, BFF 자체 오류는 `message`)
- **401 은 화면마다 처리하지 않는다.** 세션이 끊긴 것이라 할 일이 로그인 하나뿐이다 —
  `QueryCache` 의 전역 `onError` 에서 세션을 비우고 `/login` 으로 보낸다

## 서버 컴포넌트로 충분한 경우

**모든 화면에 쿼리를 깔지 않는다.**

| 상황 | 쓰는 것 |
|---|---|
| 읽기 전용 페이지(랜딩·공개 목록), 로그인 불필요 | **서버 컴포넌트에서 직접 fetch.** React Query 불필요 |
| 필터·검색·페이지네이션, 저장 후 갱신, 여러 화면이 같은 데이터 공유 | **`useQuery`** |
| 첫 화면 깜빡임이 실제로 거슬리는 화면 | 그 화면만 `prefetchQuery` + `HydrationBoundary` |

전면 prefetch/hydration 파이프라인은 이 규모에 과하다. 필요한 화면에만 붙인다.

## 응답 형태 주의

백엔드 성공 응답에는 **래퍼가 없다.** payload 가 그대로 온다 —
`res.json().data` 로 벗기면 `undefined` 가 된다. 페이지네이션 목록만 `{ items, total, offset, limit }` 이다.
([엔드포인트 규약 §응답 포맷](api/endpoint-convention.md))
