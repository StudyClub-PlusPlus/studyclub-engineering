// BO 전 페이지 로그인 게이트 — access 쿠키(bo_access_token) 없으면 /login 으로.
import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'bo_access_token';

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

  // 2) 정상 인증 모드
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) {
    if (pathname === '/login') {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname === '/login') {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // api, _next 정적 자원, 그리고 확장자가 있는 모든 정적 파일(mockServiceWorker.js, favicon.ico 등)만 게이트 제외
  matcher: ['/((?!api|_next/|.*\\..*).*)'],
};
