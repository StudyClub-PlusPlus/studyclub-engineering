// 인증 쿠키 옵션 — **서버 라우트 전용**. 심는 곳과 지우는 곳이 반드시 같은 옵션을 써야 한다.
//
// `domain` 이 다르면 브라우저는 **다른 쿠키**로 본다. 심을 때만 도메인을 넣고 지울 때 빼면
// 원본이 남아 로그아웃이 안 된다. 그래서 옵션을 이 파일 하나에서만 만든다.
//
// 화면이 API 를 직접 부르므로 액세스 쿠키는 API 도메인까지 닿아야 한다(`AUTH_COOKIE_DOMAIN`).
// 로컬은 host 가 같아(localhost, 포트는 무관) 비워 둔다.

const domain = process.env.AUTH_COOKIE_DOMAIN;
const secure = process.env.NODE_ENV === 'production';

/** 액세스 토큰 — 전 경로. API 가 쿠키에서 꺼내 쓴다. */
export function accessCookie(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
    secure,
    maxAge,
  };
}

/** 리프레시 토큰 — 이 앱의 refresh 라우트만 쓴다. API 로 보낼 이유가 없어 경로를 좁힌다. */
export function refreshCookie(maxAge: number) {
  return { ...accessCookie(maxAge), path: '/api/auth' };
}

/** 지우기 — 심을 때와 같은 path·domain 이어야 한다. */
export const clearAccess = accessCookie(0);
export const clearRefresh = refreshCookie(0);
