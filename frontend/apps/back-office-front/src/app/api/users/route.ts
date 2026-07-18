// BFF — bo_access_token 쿠키(httpOnly)를 서버측에서 읽어 백엔드 /users 를 Bearer 로 호출.
// 클라이언트는 이 라우트만 치면 됨(같은 오리진, 쿠키 자동 첨부).
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACCESS_COOKIE } from "@/lib/auth";

const API_BASE = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export async function GET() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ message: "인증이 필요합니다." }, { status: 401 });
  }
  try {
    const upstream = await fetch(`${API_BASE}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const data = await upstream.json().catch(() => []);
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json({ message: "백엔드(api)에 연결할 수 없습니다." }, { status: 502 });
  }
}
