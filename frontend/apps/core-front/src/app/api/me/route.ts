// 회원 탈퇴 — httpOnly access 쿠키로 백엔드 DELETE /api/me 를 대신 호출한다
// (JS 로는 httpOnly 쿠키를 못 읽어 Authorization 헤더를 직접 못 실으므로 서버 라우트가 대신한다).
//
// 쿠키 정리는 여기서 하지 않는다 — 탈퇴 성공 후 클라이언트가 기존 logout() 을 그대로 호출해서
// /api/auth/logout 라우트가 처리하게 한다(specs/user-leave/spec.md "알려진 한계": "새 로직을
// 만들지 않고 로그아웃과 동일한 정리를 재사용한다"). 여기서도 쿠키를 지우면 같은 로직이 두 곳에
// 복제된다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function DELETE(req: NextRequest) {
  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ errorCode: 'UNAUTHORIZED', errorMessage: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/api/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ reason: body?.reason ?? null }),
    });
  } catch {
    return NextResponse.json(
      { errorCode: 'EXTERNAL_SERVICE_ERROR', errorMessage: '백엔드에 연결할 수 없습니다.' },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  }

  return new NextResponse(null, { status: 204 });
}
