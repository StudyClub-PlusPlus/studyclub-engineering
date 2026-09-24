// BFF — 백오피스 스터디 목록.
//
// ⚠️ 규약 예외: 백오피스 화면은 원래 `/api/admin/...` 을 불러야 한다
// (docs/backend-development-guide/api/endpoint-convention.md · share/2026-09-24-admin-api-path.md).
// 백오피스 전용 목록 API 는 **다른 담당자가 개발 예정**이라, 그때까지 사용자 사이트용
// `GET /api/studies` 를 그대로 중계한다. 전용 API 가 생기면 이 파일의 경로만 바꾼다.
//
// 이 예외 때문에 생기는 한계 — 사용자 API 는 **공개 대상만** 돌려준다(숨김·DRAFT 제외).
// 즉 지금 목록에는 작성 중이거나 숨긴 스터디가 안 보인다. 화면에도 같은 문구를 띄운다.
import type { NextRequest } from 'next/server';

import { proxyGet } from '@/lib/bff';

/** 사용자 목록 API 가 받는 조건만 통과시킨다 — 모르는 파라미터를 그대로 넘기지 않는다. */
const ALLOWED = ['category', 'status', 'timezone', 'keyword', 'offset', 'limit'] as const;

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ALLOWED) {
    const value = from.get(key);
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return proxyGet(`/api/studies${qs ? `?${qs}` : ''}`);
}
