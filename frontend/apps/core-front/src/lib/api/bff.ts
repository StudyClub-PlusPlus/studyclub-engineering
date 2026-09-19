// Route Handler 공통 — 쿠키의 access token 을 읽어 백엔드에 Bearer 로 프록시한다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE } from '@/lib/auth';

export const API_BASE =
  process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function proxyToBackend(
  req: NextRequest,
  backendPath: string,
  init?: RequestInit,
): Promise<NextResponse> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { errorCode: 'UNAUTHORIZED', errorMessage: '로그인이 필요합니다.' },
      { status: 401 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}${backendPath}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
    });
  } catch {
    return NextResponse.json(
      { errorCode: 'BAD_GATEWAY', errorMessage: '백엔드에 연결할 수 없습니다.' },
      { status: 502 },
    );
  }

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}
