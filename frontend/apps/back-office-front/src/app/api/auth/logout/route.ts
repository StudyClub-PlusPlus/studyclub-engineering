import { NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/auth';
import { clearAccess, clearRefresh } from '@/lib/cookies';

// BO 로그아웃 — httpOnly access·refresh 쿠키를 서버측에서 제거.

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, '', clearAccess);
  res.cookies.set(REFRESH_COOKIE, '', clearRefresh);
  return res;
}
