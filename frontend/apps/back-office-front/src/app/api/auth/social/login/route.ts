import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/auth';
import { authAccountSchema, socialLoginResponseSchema } from '@/features/auth/response-schema';
import { accessCookie, refreshCookie } from '@/lib/cookies';

// BO code 교환 — platform 을 서버측에서 BACK_OFFICE 로 강제 주입(클라이언트 값 불신).
// 백엔드가 SYSTEM_ROLE=ADMIN 계정만 토큰 발급. 여기서 계정의 role 을 한 번 더 본다(두 겹).

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, redirectUri } = body ?? {};
  if (!code) {
    return NextResponse.json({ message: 'code 가 필요합니다.' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/social-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, provider: 'google', platform: 'BACK_OFFICE', redirectUri }),
    });
  } catch {
    return NextResponse.json(
      { message: '백엔드(api)에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  const bodyData = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    return NextResponse.json(bodyData, { status: upstream.status });
  }

  // 백엔드가 뚫려도 쿠키를 안 심는다. 응답은 백엔드 403 과 같은 모양이라 로그인 화면이 구분 없이 처리한다.
  const account = authAccountSchema.safeParse(bodyData?.account);
  if (!account.success || account.data.role !== 'ADMIN') {
    return NextResponse.json(
      { errorCode: 'FORBIDDEN', errorMessage: '백오피스 운영 권한이 없는 계정입니다.' },
      { status: 403 },
    );
  }

  const parsed = socialLoginResponseSchema.safeParse(bodyData);
  if (!parsed.success) return NextResponse.json({ message: '로그인 응답이 올바르지 않습니다.' }, { status: 502 });
  const data = parsed.data;
  const res = NextResponse.json({
    account: data.account,
  });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookie(data.accessTokenExpiresIn ?? 60 * 60 * 24 * 7));
  if (data.refreshToken) {
    res.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookie(data.refreshTokenExpiresIn ?? 60 * 60 * 24 * 30));
  }
  return res;
}
