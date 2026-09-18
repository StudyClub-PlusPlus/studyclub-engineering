import { NextRequest } from 'next/server';

import { proxyToBackend } from '@/lib/api/bff';

/** POST /accounts/onboarding — 온보딩 완료 (가입 확정). */
export async function POST(req: NextRequest) {
  const body = await req.text();
  return proxyToBackend(req, '/accounts/onboarding', { method: 'POST', body });
}
