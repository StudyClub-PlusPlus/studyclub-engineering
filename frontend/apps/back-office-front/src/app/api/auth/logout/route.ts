// BO 로그아웃 — httpOnly bo_access_token 쿠키를 서버측에서 제거.
import { NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // 지울 때도 심을 때와 **같은 domain** 이어야 한다 — 다르면 브라우저가 다른 쿠키로 보고 원본이 남는다.
  res.cookies.set(ACCESS_COOKIE, '', {
    httpOnly: true,
    path: '/',
    ...(process.env.AUTH_COOKIE_DOMAIN ? { domain: process.env.AUTH_COOKIE_DOMAIN } : {}),
    maxAge: 0,
  });
  return res;
}
