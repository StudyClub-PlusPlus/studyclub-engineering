// 내 참가자 허브 조회 — httpOnly access 쿠키로 백엔드 GET /api/me/studies 를 대신 호출한다.
// 탈퇴 화면이 "맡은 진행 중인 스터디" 경고를 채우는 데 쓴다 (specs/user-leave/spec.md).
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ errorCode: 'UNAUTHORIZED', errorMessage: '로그인이 필요합니다.' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/me/studies`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { errorCode: 'EXTERNAL_SERVICE_ERROR', errorMessage: '백엔드에 연결할 수 없습니다.' },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
