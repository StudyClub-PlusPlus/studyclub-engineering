// 수강생 영역(/:locale/my) 로그인 게이팅 — access 쿠키(sc_access_token)가 없으면 /login 으로.
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "sc_access_token";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) return NextResponse.next();

  const { pathname } = req.nextUrl;
  const locale = pathname.split("/")[1] || "ko";
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}/login`;
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // /ko/my, /en/my 등 수강생 영역만 게이트
  matcher: ["/:locale/my/:path*", "/:locale/my"],
};
