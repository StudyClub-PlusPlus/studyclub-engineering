// BFF 공통 — bo_access_token 쿠키(httpOnly)를 서버측에서 읽어 백엔드를 Bearer 로 호출한다.
// 클라이언트는 같은 오리진의 /api/* 라우트만 치면 되고, 토큰은 브라우저 JS 에 닿지 않는다.
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

/**
 * 백엔드 GET 을 그대로 중계한다. 상태 코드와 바디를 손대지 않고 넘겨, 401·403 을 화면이 구분할 수 있게 둔다.
 *
 * @param path `/api/studies?offset=0` 처럼 쿼리까지 붙인 백엔드 경로
 */
export async function proxyGet(path: string): Promise<NextResponse> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
  }
  try {
    const upstream = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await upstream.json().catch(() => null);
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ message: '백엔드(api)에 연결할 수 없습니다.' }, { status: 502 });
  }
}
