// 두 가지를 한다:
//  1. 로케일 없는 경로(`/`, `/studies`)를 기본 로케일로 리다이렉트
//     — 루트 레이아웃이 `app/[locale]/layout.tsx` 라서 로케일 없는 경로는 렌더할 레이아웃이 없다.
//       덤으로 `/studies` 같은 외부 링크가 404 대신 정상 페이지로 착지한다(SEO).
//  2. 수강생 영역(/:locale/my) 로그인 게이팅 — access 쿠키(sc_access_token)가 없으면 /login 으로.
import { NextRequest, NextResponse } from 'next/server';

import { DEFAULT_LOCALE, isLocale } from '@/lib/i18n';

const ACCESS_COOKIE = 'sc_access_token';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split('/')[1] ?? '';

  if (!isLocale(first)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  // /:locale/my 이하만 게이트
  const rest = pathname.slice(first.length + 1);
  if (!(rest === '/my' || rest.startsWith('/my/'))) return NextResponse.next();

  if (req.cookies.get(ACCESS_COOKIE)?.value) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/${first}/login`;
  url.search = `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // api·_next·그리고 **확장자가 있는 모든 경로**를 뺀다.
  // 후자가 핵심이다 — sitemap.xml·robots.txt·llms.txt·og 이미지·public 자산이 전부 여기 걸린다.
  // 하나씩 나열하면 파일이 늘 때마다 조용히 리다이렉트되어 404 가 된다.
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
};
