// httpOnly refresh 쿠키로 액세스 토큰을 갱신한다.
// POST: http.ts 가 401 을 받으면 부르고 원래 요청을 재시도한다.
// GET: 미들웨어가 액세스 쿠키 없는 화면 요청을 보낸다. 갱신되면 그 화면으로, 아니면 로그인으로 돌려보낸다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/auth';
import { tokenResponseSchema } from '@/features/auth/response-schema';
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
    });
  } catch {
    return { status: 502, message: '백엔드에 연결할 수 없습니다.' };
  }

  if (!upstream.ok) return { status: 401, message: '세션이 만료됐습니다. 다시 로그인해 주세요.', expired: true };

  const parsed = tokenResponseSchema.safeParse(await upstream.json().catch(() => null));
  if (!parsed.success) return { status: 502, message: '백엔드 응답 형식이 올바르지 않습니다.' };
  return { accessToken: parsed.data.accessToken, maxAge: parsed.data.accessTokenExpiresIn ?? 60 * 15 };
}

function withResult(res: NextResponse, result: Refreshed): NextResponse {
  if ('accessToken' in result) {
    res.cookies.set(ACCESS_COOKIE, result.accessToken, accessCookie(result.maxAge));
  } else if (result.expired) {
    // refresh 실패 = 세션 만료. 쿠키 둘 다 제거해 미들웨어가 로그인으로 보내도록 한다.
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
  const target = 'accessToken' in result ? next : `/login?next=${encodeURIComponent(next)}`;
  return withResult(redirectInSite(target), result);
}
