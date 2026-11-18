// 로그아웃 — refresh token 을 서버에서 무효화하고 httpOnly 쿠키를 제거한다.
// refresh 쿠키는 httpOnly 라 JS 에서 못 읽으므로 Next.js 라우트가 읽어 백엔드에 전달한다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/auth';
import { clearAccess, clearRefresh } from '@/lib/cookies';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    try {
      const res = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        console.warn('[logout] backend token revocation failed', res.status);
      }
    } catch (err) {
      // 백엔드 호출 실패해도 쿠키는 지운다 — 클라이언트 세션은 이미 정리됨
      console.warn('[logout] backend token revocation error', err);
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, '', clearAccess);
  res.cookies.set(REFRESH_COOKIE, '', clearRefresh);
  return res;
}
