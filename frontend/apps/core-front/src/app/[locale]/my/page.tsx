"use client";

// 수강생 페이지(A8) — 로그인 게이팅. 서버 미들웨어가 access 쿠키로 1차 게이트하고,
// 여기서도 클라이언트 세션(sc_user)이 없으면 /login 으로 보낸다(방어적).
// 내 스터디는 당분간 mock (// TODO(api): /auth/me + 내 신청/출석 연동).
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { clearSession, getUser, type SessionUser } from "@/lib/auth";

export default function MyPage() {
  const params = useParams();
  const router = useRouter();
  const locale = (params?.locale as string) ?? "ko";
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      router.replace(`/${locale}/login?next=/${locale}/my`);
      return;
    }
    setUser(u);
    setReady(true);
  }, [locale, router]);

  if (!ready || !user) {
    return <div className="px-6 py-16 text-center text-sm text-neutral-500">불러오는 중…</div>;
  }

  function logout() {
    clearSession();
    router.replace(`/${locale}`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center gap-4">
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="h-14 w-14 rounded-full" />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-neutral-200 text-lg font-bold">
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold tracking-tight">{user.name ?? "수강생"}</h1>
          <p className="text-sm text-neutral-500">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="ml-auto rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
        >
          로그아웃
        </button>
      </div>

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-neutral-800">내 스터디</h2>
        <p className="mt-1 text-xs text-neutral-500">
          아직 신청한 스터디가 없어요. 스터디를 둘러보고 합류해 보세요.
        </p>
        {/* TODO(api): /auth/me 로 역할 확인 + 내 신청·출석 목록 연동 (MVP P3) */}
        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400">
          내 스터디 목록 (준비 중)
        </div>
      </section>
    </div>
  );
}
