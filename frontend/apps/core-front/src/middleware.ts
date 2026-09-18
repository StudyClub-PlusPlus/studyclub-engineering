// 수강생 영역(/:locale/my) · 온보딩 — access 쿠키(sc_access_token)가 없으면 /login 으로.
// 온보딩 완료 여부는 쿠키만으로 알 수 없어, 미완료 분기는 로그인 응답·온보딩 페이지에서 처리한다.
import { NextRequest, NextResponse } from 'next/server';

const ACCESS_COOKIE = 'sc_access_token';

export function middleware(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const locale = pathname.split('/')[1] || 'ko';
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = `?next=${encodeURIComponent(pathname + (req.nextUrl.search || ''))}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/:locale/my/:path*', '/:locale/my', '/:locale/onboarding'],
};
