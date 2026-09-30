// QueryClient 생성 — 서버는 요청마다 새로, 브라우저는 모듈 싱글턴 하나.
// 서버에서 하나를 공유하면 사용자 A 의 캐시가 B 에게 보인다 (TanStack Advanced SSR 가이드).
import { QueryCache, QueryClient } from '@tanstack/react-query';

import { clearSession } from '@/lib/auth';
import { ApiError } from '@/lib/http';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      // 401 은 세션이 끊긴 것 — 화면마다 처리하지 않는다. 사용자 사이트는 로그인으로 밀지 않고
      // 세션만 비운다(공개 화면이 대부분이라, 보던 목록에서 튕기는 게 더 나쁘다).
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) clearSession();
      },
    }),
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 0, refetchOnWindowFocus: false },
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
