// BO 전 페이지 로그인 게이트 — access 쿠키(bo_access_token) 없으면 /login 으로.
// /login·/api/auth/* 와 정적 자원은 제외. (allowlist 는 백엔드가 강제)
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "bo_access_token";

export function middleware(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (token) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // /login, /api/*, _next 정적, 파비콘 등은 게이트 제외
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
