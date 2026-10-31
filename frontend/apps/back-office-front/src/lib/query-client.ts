import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { logout } from '@/features/auth/auth';
import { ApiError } from '@/lib/http';

// QueryClient 생성 — 서버는 요청마다 새로, 브라우저는 모듈 싱글턴 하나.
//
// 서버에서 하나를 공유하면 **사용자 A 의 캐시가 B 에게 보인다.** 반대로 브라우저에서 매 렌더
// 새로 만들면 캐시가 매번 날아간다. 그래서 환경에 따라 다르게 만든다 (TanStack Advanced SSR 가이드).
// `useState` 로 만들지 않는 것도 같은 가이드의 권고다 — suspense 경계가 없으면 첫 렌더에서 버려진다.

// 여러 조회가 동시에 401이어도 쿠키 정리와 이동은 한 번만 한다. 새 문서가 열리면 초기화된다.
let redirectingToLogin = false;

/** 인증 실패(401)의 공통 처리 — 서버에서 httpOnly 쿠키까지 정리한 뒤 로그인 화면으로 보낸다. */
export async function handleUnauthorized(error: Error) {
  if (!(error instanceof ApiError) || error.status !== 401 || typeof window === 'undefined') return;
  if (redirectingToLogin || window.location.pathname === '/login') return;
  redirectingToLogin = true;
  const next = window.location.pathname + window.location.search;
  try {
    await logout();
  } catch {
    // 정리에 실패해도 로그인은 열 수 있다. 미들웨어가 남은 쿠키만 보고 되돌려 보내지 않는다.
  } finally {
    window.location.replace(`/login?next=${encodeURIComponent(next)}`);
  }
}

function makeQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleUnauthorized }),
    mutationCache: new MutationCache({ onError: handleUnauthorized }),
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
