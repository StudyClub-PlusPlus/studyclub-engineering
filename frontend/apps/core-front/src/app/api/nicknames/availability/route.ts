import { NextRequest } from 'next/server';

import { proxyToBackend } from '@/lib/api/bff';

/** GET /api/nicknames/availability?value= — 닉네임 사용 가능 여부. */
export async function GET(req: NextRequest) {
  const value = req.nextUrl.searchParams.get('value') ?? '';
  const qs = new URLSearchParams({ value });
  return proxyToBackend(req, `/api/nicknames/availability?${qs.toString()}`, { method: 'GET' });
}
