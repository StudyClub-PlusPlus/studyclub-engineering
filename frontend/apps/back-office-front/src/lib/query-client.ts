// QueryClient 생성 — 서버는 요청마다 새로, 브라우저는 모듈 싱글턴 하나.
//
// 서버에서 하나를 공유하면 **사용자 A 의 캐시가 B 에게 보인다.** 반대로 브라우저에서 매 렌더
// 새로 만들면 캐시가 매번 날아간다. 그래서 환경에 따라 다르게 만든다 (TanStack Advanced SSR 가이드).
// `useState` 로 만들지 않는 것도 같은 가이드의 권고다 — suspense 경계가 없으면 첫 렌더에서 버려진다.
import { QueryCache, QueryClient } from '@tanstack/react-query';

import { clearSession } from '@/lib/auth';
import { ApiError } from '@/lib/http';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // 401 은 화면마다 처리하지 않는다 — 세션이 끊긴 것이라 할 일이 로그인 한 가지뿐이다.
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          clearSession();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      },
    }),
    defaultOptions: {
      queries: {
        // 0(기본값)이면 하이드레이션 직후 곧바로 다시 부른다. 운영 화면의 데이터는 1분 정도 묵어도 된다.
        staleTime: 60 * 1000,
        // BFF 가 이미 상태 코드를 그대로 넘긴다. 401·403 을 세 번 더 시도해 봐야 결과가 같다.
        retry: 0,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
