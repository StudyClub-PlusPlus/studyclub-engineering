// code 를 받아 백엔드 /auth/social-login 으로 교환. platform 은 서버측에서 CORE 로 강제
// (클라이언트 값 불신 — BO 는 별도 라우트에서 BACK_OFFICE 강제). 성공 시 access 쿠키를
// httpOnly 로 심어 미들웨어 게이팅에 쓰고, 토큰/유저는 클라이언트로도 반환.
import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, PLATFORM } from "@/lib/auth";

// 서버(컨테이너) 내부에서 백엔드에 닿는 URL. 브라우저용 NEXT_PUBLIC_API_BASE_URL 과 구분.
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
      // platform 서버측 강제
      body: JSON.stringify({ code, provider: "google", platform: PLATFORM, redirectUri }),
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
