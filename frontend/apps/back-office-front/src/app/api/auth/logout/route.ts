// BO 로그아웃 — httpOnly bo_access_token 쿠키를 서버측에서 제거.
import { NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';
import { clearAccess } from '@/lib/cookies';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, '', clearAccess);
  return res;
}
