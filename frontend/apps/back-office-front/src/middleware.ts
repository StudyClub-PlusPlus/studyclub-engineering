// BO 전 페이지 로그인 게이트 — access 쿠키(bo_access_token) 없으면 /login 으로.
// /login·/api/auth/* 와 정적 자원은 제외. (allowlist 는 백엔드가 강제)
import { NextRequest, NextResponse } from "next/server";

const ACCESS_COOKIE = "bo_access_token";

/**
 * 로컬 UI 작업용 게이트 우회.
 *
 * 구글 OAuth 클라이언트가 없으면 콘솔 화면을 아예 열 수 없어 디자인/마크업 작업이 막힌다.
 * 두 조건이 **동시에** 참일 때만 열린다:
 *   1) next dev (NODE_ENV=development) — 프로덕션 빌드에서는 절대 켜지지 않는다
 *   2) BO_DEV_BYPASS_AUTH=1 을 명시적으로 넣었을 때 (.env.local · gitignore 대상)
 *
 * 기본값은 꺼짐이다. 레포에는 플래그 값이 커밋되지 않으므로 다른 사람이 받아도 게이트는 그대로다.
 * 데이터를 실제로 읽고 쓰는 권한은 백엔드가 별도로 강제하므로, 이 우회로는 화면만 열린다.
 */
const DEV_BYPASS =
  process.env.NODE_ENV === "development" && process.env.BO_DEV_BYPASS_AUTH === "1";

export function middleware(req: NextRequest) {
  if (DEV_BYPASS) return NextResponse.next();

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
