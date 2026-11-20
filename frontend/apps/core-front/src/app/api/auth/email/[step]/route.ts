// 테스트 로그인(specs/stage-email-login) BFF — signup · verify 는 그대로 넘기고, login 은 소셜 로그인과 같이
// 토큰을 httpOnly 쿠키로 심고 account 만 돌려준다. 백엔드 스위치가 꺼져 있으면 셋 다 404 가 그대로 간다.
import { NextRequest, NextResponse } from 'next/server';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/features/auth/auth';
import { socialLoginResponseSchema } from '@/features/auth/response-schema';
import { accessCookie, refreshCookie } from '@/lib/cookies';

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
const STEPS = new Set(['signup', 'verify', 'login']);

export async function POST(req: NextRequest, ctx: { params: Promise<{ step: string }> }) {
  const { step } = await ctx.params;
  if (!STEPS.has(step)) return NextResponse.json({ message: 'not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/email/${step}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return NextResponse.json(
      { message: '백엔드(api)에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 502 },
    );
  }

  const raw = await upstream.json().catch(() => null);
  if (!upstream.ok) return NextResponse.json(raw, { status: upstream.status });
  if (step !== 'login') return new NextResponse(null, { status: 204 });

  const parsed = socialLoginResponseSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ message: '백엔드 응답 형식이 올바르지 않습니다.' }, { status: 502 });
  const data = parsed.data;
  const res = NextResponse.json({ account: data.account, suggestedNickname: null });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, accessCookie(data.accessTokenExpiresIn ?? 60 * 60 * 24 * 7));
  if (data.refreshToken) {
    res.cookies.set(REFRESH_COOKIE, data.refreshToken, refreshCookie(data.refreshTokenExpiresIn ?? 60 * 60 * 24 * 30));
  }
  return res;
}
