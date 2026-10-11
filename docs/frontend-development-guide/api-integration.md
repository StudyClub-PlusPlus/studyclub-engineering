# API 연동 가이드

## Table of Contents

- [세 줄 요약](#세-줄-요약)
- [인증 — 쿠키를 실어 보낸다](#인증--쿠키를-실어-보낸다)
- [어디에 두나 — 기능 옆에](#어디에-두나--기능-옆에)
- [서버 상태는 TanStack Query 로](#서버-상태는-tanstack-query-로)
- [쿼리 키](#쿼리-키)
- [필터·검색·페이지는 URL 에](#필터검색페이지는-url-에)
- [변경(mutation)과 무효화](#변경mutation과-무효화)
- [에러와 401](#에러와-401)
- [서버 컴포넌트로 충분한 경우](#서버-컴포넌트로-충분한-경우)
- [응답 형태 주의](#응답-형태-주의)
- [판정을 다시 하지 않는다](#판정을-다시-하지-않는다)

## 세 줄 요약

1. 브라우저가 **백엔드를 직접 부른다.** 중계(BFF) 라우트를 만들지 않는다 — 인증은 **쿠키**로 간다
2. 조회는 `useEffect + fetch` 가 아니라 **`useQuery`** 로 한다
3. fetcher·쿼리 키·훅은 **그 기능 폴더 안에** 둔다 (`src/features/<기능>/queries.ts`)
4. 목록의 **필터·검색·페이지·탭은 URL 쿼리**에 둔다 (`useSearchParams`). `useState` 로 들고 있지 않는다
4. 모집 중인지·정원이 찼는지·출석률 같은 **판정은 응답 필드를 그린다.** 날짜·숫자로 다시 계산하지 않는다

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

> 백오피스 화면이 부르는 백엔드 경로는 `/api/admin/...` 이다 — [엔드포인트 규약](../backend-development-guide/api/endpoint-convention.md).

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

## 필터·검색·페이지는 URL 에

목록 화면의 **탭·필터·검색어·페이지·정렬**은 URL 쿼리(`?role=CAPTAIN&q=kim&page=2`)가 정본이다.
`useState` 로 들고 있지 않는다. 크루 사이트(core-front)·백오피스 둘 다 같다.

**왜** — `useState` 면 새로고침하거나 상세에 들어갔다 **뒤로 오면 첫 화면으로 돌아간다.** 운영자는
같은 조건으로 여러 건을 차례로 처리하고, 크루는 걸러 둔 목록에서 스터디를 하나씩 열어 본다 — 매번
다시 거는 게 가장 흔한 불편이다. URL 에 있으면 뒤로 가기·새로고침이 그대로 되고, 링크로 그 화면을 그대로 넘길 수 있다.

앱마다 `src/lib/use-url-state.ts` 의 `useUrlState` 하나로 한다. 화면마다 URL 을 읽고 쓰는 코드를 새로 짜지 않는다.

```tsx
// 모듈 상수로 둔다 — 렌더마다 새 객체면 set 이 매번 바뀐다
const URL_DEFAULTS = { q: '', status: 'all', page: '1' };
const URL_ALLOWED = { status: STATUS_OPTIONS.map((o) => o.value) };   // 모르는 값은 기본값으로

const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
const page = pageOf(filters.page);

// 조건을 바꾸면 페이지는 1로 — 같은 set 에서 함께 바꾼다
<Select value={filters.status} onChange={(v) => setFilters({ status: v, page: '1' })} />

// 검색 입력칸 글자는 화면 state, 멈추면 URL 에
const [query, setQuery] = useState(filters.q);
const debounced = useDebouncedValue(query, 300);
useEffect(() => {
  if (debounced !== filters.q) setFilters({ q: debounced, page: '1' });
}, [debounced, filters.q, setFilters]);
```

적용 예: core-front `StudyBrowser`·`EventBrowser`·마이 › 참여 스터디, 백오피스 `features/studies/StudiesTable`·`features/events/EventsTable`.

- **라이브러리 없이** `useSearchParams` · `useRouter` · `usePathname` 으로 한다 (`useUrlState` 가 감싼다)
- **기본값은 URL 에 싣지 않는다** — 첫 화면 주소가 깨끗하고, 같은 상태가 주소 둘로 갈리지 않는다
- **`router.replace`** 를 쓴다. 타이핑·탭 전환마다 `push` 하면 뒤로 가기가 한 글자씩 되돌아간다
- 검색 **입력칸의 글자**는 `useState` 로 두고, 디바운스한 값만 URL 에 쓴다
- URL 값은 **믿지 않는다** — 모르는 탭 값·음수 페이지는 기본값으로 되돌린다. 서버 검증과 같은 범위로
- 그대로 쿼리 키에 들어간다 (`userKeys.list(filter)`) — URL 이 바뀌면 캐시도 자연히 갈린다
- 정적 프리렌더되는 페이지에서 `useSearchParams()` 를 쓰면 **`<Suspense>` 로 감싼다.** 안 감싸면 경계가 없어 **페이지 전체**(레이아웃·제목 포함)가 브라우저 렌더로 넘어간다 — 빌드는 통과하니 눈치채기 어렵다 (`my/joined/page.tsx` 참고)
- **공개 목록 페이지**(SEO 대상)는 페이지에서 `await searchParams` 로 요청마다 렌더하게 한다 — 조건이 걸린 목록까지 HTML 에 들어간다 (`[locale]/studies/page.tsx` 참고)
- 서버 컴포넌트 페이지(공개 목록 등)는 훅 대신 `searchParams` prop 으로 같은 값을 읽는다

**URL 에 두지 않는 것** — 모달 열림·메뉴 펼침 같은 잠깐의 UI 상태, 그리고 **개인정보**(「보기」로 받은
이메일 원본 등). URL 은 브라우저 기록·서버 접근 로그·공유 링크로 남는다.

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
([엔드포인트 규약 §응답 포맷](../backend-development-guide/api/endpoint-convention.md#응답-포맷))

## 판정을 다시 하지 않는다

**"지금 어떤 상태인가" 는 서버가 응답 필드로 준다. 화면은 그 값을 그린다.**
정본: [엔드포인트 규약 §판정은 서버가 내려준다](../backend-development-guide/api/endpoint-convention.md#판정은-서버가-내려준다)

```ts
// ❌ 재료로 다시 판정한다 — 서버와 기준이 갈린다 (UTC 날짜 비교, 다른 인원 수)
const open = deadline.slice(0, 10) >= todayISO() && applicants < capacity;

// ✅ 서버 판정을 옮긴다
const open = api.recruitStatus === 'RECRUITING';
```

- **필드가 없으면 만들지 않는다.** 스펙에 필드를 추가해 백엔드에 요청하고 `// TODO(api): recruitStatus 필요` 를 남긴다
- **mock 데이터에도 판정 필드를 넣는다.** 화면 코드가 mock 과 실제 API 를 같은 경로로 읽어야 교체할 때 판정 로직이 따라오지 않는다
- `packages/mock` 의 `recruitState()` 같은 공유 함수에 판정 축(시작일·정원·인원)을 더하지 않는다 — 크루 사이트·백오피스·playground 가 같이 흔들린다
- 해도 되는 것: 날짜·숫자 표시 형식, 받은 값으로 정렬·필터, 입력 중 검증(최종은 서버), 낙관적 업데이트
