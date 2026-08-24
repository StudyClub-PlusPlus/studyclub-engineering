// httpOnly refresh 쿠키로 액세스 토큰을 갱신한다.
// fetch wrapper 에서 401 수신 시 이 라우트를 호출하고 원래 요청을 재시도한다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth';

const API_BASE =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'refresh token 없음' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    return NextResponse.json({ message: '백엔드에 연결할 수 없습니다.' }, { status: 502 });
  }

  if (!upstream.ok) {
    // refresh 실패 = 세션 만료. 쿠키 둘 다 제거해 미들웨어가 로그인으로 보내도록 한다.
    const res = NextResponse.json(
      { message: '세션이 만료됐습니다. 다시 로그인해 주세요.' },
      { status: 401 },
    );
    res.cookies.set(ACCESS_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
    return res;
  }

  const data = await upstream.json().catch(() => ({}));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: data.accessTokenExpiresIn ?? 60 * 60 * 24 * 7,
  });
  return res;
}
