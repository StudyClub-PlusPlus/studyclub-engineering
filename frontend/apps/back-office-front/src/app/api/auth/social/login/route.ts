// BO code 교환 — platform 을 서버측에서 BACK_OFFICE 로 강제 주입(클라이언트 값 불신).
// 백엔드가 allowlist(BACK_OFFICE_ALLOWED_EMAILS) 통과자만 토큰 발급.
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { code, redirectUri } = body ?? {};
  if (!code) {
    return NextResponse.json({ message: "code 가 필요합니다." }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_BASE}/auth/social-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, provider: "google", platform: "BACK_OFFICE", redirectUri }),
    });
  } catch {
    return NextResponse.json(
      { message: "백엔드(api)에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요." },
      { status: 502 },
    );
  }

  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return NextResponse.json(data, { status: upstream.status });
  }

  const res = NextResponse.json({
    user: data.user,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
  });
  res.cookies.set(ACCESS_COOKIE, data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: data.accessTokenExpiresIn ?? 60 * 60 * 24 * 7,
  });
  return res;
}
