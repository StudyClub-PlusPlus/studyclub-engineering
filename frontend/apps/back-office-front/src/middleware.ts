import { NextRequest, NextResponse } from 'next/server';

import { legacyRedirectUrl } from '@studyclub/utils';

import { ACCESS_COOKIE } from '@/lib/cookie-names';

// BO 전 페이지 로그인 게이트 — access 쿠키(bo_access_token) 없으면 /login 으로.

/**
 * 로컬 UI 작업용 게이트 우회.
 *
 * 두 조건이 **동시에** 참일 때 로그인 절차를 완전히 건너뜁니다:
 *   1) next dev (NODE_ENV=development) — 프로덕션 빌드에서는 절대 켜지지 않음
 *   2) BO_DEV_BYPASS_AUTH=1 (.env.local 또는 .env)
 *
 * 우회 모드에서는:
 *   - /login 접근 시에도 메인(/)으로 즉시 리다이렉트
 *   - 더미 access_token 쿠키 자동 주입으로 모든 페이지 무조건 통과
 */
const DEV_BYPASS = process.env.NODE_ENV === 'development' && process.env.BO_DEV_BYPASS_AUTH === '1';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 0) 옛 도메인으로 들어오면 같은 경로의 studyclub.life 로 영구 이동 (@studyclub/utils)
  const legacy = legacyRedirectUrl(
    req.headers.get('x-forwarded-host') ?? req.headers.get('host'),
    pathname + req.nextUrl.search,
  );
  if (legacy) return NextResponse.redirect(legacy, 301);

  // 1) 로컬 개발 우회 모드
  if (DEV_BYPASS) {
    if (pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      const res = NextResponse.redirect(url);
      res.cookies.set(ACCESS_COOKIE, 'dev-bypass-token', { path: '/', maxAge: 86400 });
      return res;
    }
    const res = NextResponse.next();
    if (!req.cookies.get(ACCESS_COOKIE)) {
      res.cookies.set(ACCESS_COOKIE, 'dev-bypass-token', { path: '/', maxAge: 86400 });
    }
    return res;
  }

  // 2) 로그인은 쿠키가 남아 있어도 연다. 쿠키 존재만으로는 서버의 인증 성공을 보장할 수 없다.
  // 401 뒤 쿠키 정리에 실패해도 여기서 대시보드로 돌려보내면 무한 이동이 된다.
  if (pathname === '/login') {
    return NextResponse.next();
  }

  if (req.cookies.get(ACCESS_COOKIE)?.value) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // 쿠키 이름이 런타임 env(AUTH_COOKIE_ENV)를 읽는다 — edge 는 빌드 때 값으로 굳으므로 node 에서 돈다
  runtime: 'nodejs',
  // api, _next 정적 자원, 그리고 확장자가 있는 모든 정적 파일(mockServiceWorker.js, favicon.ico 등)만 게이트 제외
  matcher: ['/((?!api|_next/|.*\\..*).*)'],
};
