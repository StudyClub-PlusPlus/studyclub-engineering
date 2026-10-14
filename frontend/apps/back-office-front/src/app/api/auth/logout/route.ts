// BO 로그아웃 — httpOnly access·refresh 쿠키를 서버측에서 제거.
import { NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth';
import { clearAccess, clearRefresh } from '@/lib/cookies';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, '', clearAccess);
  res.cookies.set(REFRESH_COOKIE, '', clearRefresh);
  return res;
}
