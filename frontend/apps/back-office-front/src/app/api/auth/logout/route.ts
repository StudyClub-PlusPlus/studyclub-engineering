// BO 로그아웃 — httpOnly bo_access_token 쿠키를 서버측에서 제거.
import { NextResponse } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
