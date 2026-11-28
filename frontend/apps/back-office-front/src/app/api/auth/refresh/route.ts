import { NextRequest, NextResponse } from 'next/server';

import { tokenResponseSchema } from '@/features/auth/response-schema';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/cookie-names';
import { accessCookie, clearAccess, clearRefresh } from '@/lib/cookies';
import { safeNext } from '@/lib/safe-next';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

type Refreshed = { accessToken: string; maxAge: number } | { status: number; message: string; expired?: true };

async function refreshAccess(req: NextRequest): Promise<Refreshed> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return { status: 401, message: 'refresh token 없음' };

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { status: 502, message: '백엔드에 연결할 수 없습니다.' };
  }

  if (upstream.status === 401) {
    return { status: 401, message: '세션이 만료됐습니다. 다시 로그인해 주세요.', expired: true };
  }
  if (!upstream.ok) {
    return { status: upstream.status, message: '로그인을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }

  const parsed = tokenResponseSchema.safeParse(await upstream.json().catch(() => null));
  if (!parsed.success) return { status: 502, message: '백엔드 응답 형식이 올바르지 않습니다.' };
  return { accessToken: parsed.data.accessToken, maxAge: parsed.data.accessTokenExpiresIn ?? 60 * 15 };
}

function withResult(res: NextResponse, result: Refreshed): NextResponse {
  res.headers.set('Cache-Control', 'no-store');
  if ('accessToken' in result) {
    res.cookies.set(ACCESS_COOKIE, result.accessToken, accessCookie(result.maxAge));
  } else if (result.expired) {
    res.cookies.set(ACCESS_COOKIE, '', clearAccess);
    res.cookies.set(REFRESH_COOKIE, '', clearRefresh);
  }
  return res;
}

export async function POST(req: NextRequest) {
  const result = await refreshAccess(req);
  const res =
    'accessToken' in result
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ message: result.message }, { status: result.status });
  return withResult(res, result);
}

// 배포된 Next 는 프록시 뒤에서 req.nextUrl 의 호스트를 자기 주소(localhost:3000)로 본다. 미들웨어 리다이렉트는 Next 가
// 상대 경로로 바꿔 주지만 라우트 핸들러 응답은 그대로 나가므로 Location 을 상대 경로로 쓴다(NextResponse.redirect 는 절대 주소만 받는다).
function redirectInSite(path: string): NextResponse {
  const { pathname, search } = new URL(path, 'http://site.invalid');
  // 정규화 뒤 `//` 로 시작하면(`/x/..//evil`) 브라우저가 다른 호스트로 읽는다
  const location = (pathname.startsWith('//') ? '/' : pathname) + search;
  return new NextResponse(null, { status: 307, headers: { Location: location } });
}

export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  const result = await refreshAccess(req);
  if (!('accessToken' in result) && result.status !== 401) {
    return unavailable(next, result.status);
  }
  const target = 'accessToken' in result ? next : `/login?next=${encodeURIComponent(next)}`;
  return withResult(redirectInSite(target), result);
}

function unavailable(next: string, status: number): NextResponse {
  // 보호 화면을 렌더링할 수 없는 상태라 인증에 의존하지 않는 문서에서 재시도한다.
  return new NextResponse(
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>잠시 후 다시 시도해 주세요</title><body><main><h1>로그인을 확인하지 못했습니다</h1><p>잠시 후 다시 시도해 주세요.</p><a href="/api/auth/refresh?next=${encodeURIComponent(next)}">다시 시도</a></main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
        'Referrer-Policy': 'no-referrer',
      },
    },
  );
}
