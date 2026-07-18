"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { buildGoogleAuthUrl, isConfigured, setUser } from "@/lib/auth";

export default function BackOfficeLoginPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get("next") ?? "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  const exchange = useCallback(
    async (code: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/auth/social/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.message ?? `로그인 실패 (${res.status})`);
        }
        if (data.user) setUser(data.user);
        router.replace(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "로그인 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    },
    [next, router],
  );

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.source !== "studyclub-oauth") return;
      popupRef.current?.close();
      if (data.error) {
        setError(`구글 인증이 취소되었습니다 (${data.error}).`);
        return;
      }
      if (data.code) void exchange(data.code);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [exchange]);

  function startLogin() {
    setError(null);
    if (!isConfigured()) {
      setError("구글 OAuth 클라이언트가 아직 설정되지 않았습니다 (NEXT_PUBLIC_GOOGLE_CLIENT_ID).");
      return;
    }
    const w = 480;
    const h = 640;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;
    popupRef.current = window.open(
      buildGoogleAuthUrl(),
      "studyclub-google-login",
      `width=${w},height=${h},left=${left},top=${top}`,
    );
  }

  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border,#e5e5e5)] bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-bold tracking-tight">Back Office 로그인</h1>
        <p className="mt-2 text-xs text-neutral-500">허용된 운영자 계정만 접근할 수 있습니다.</p>

        <button
          type="button"
          onClick={startLogin}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] shadow-sm transition hover:bg-neutral-50 disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path fill="#4285F4" d="M23.06 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.38z" />
            <path fill="#34A853" d="M12 24c3.1 0 5.7-1.03 7.6-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.88 1.1-2.98 0-5.5-2.01-6.4-4.72H1.76v2.98A11.99 11.99 0 0 0 12 24z" />
            <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6V7.12H1.76a12 12 0 0 0 0 10.56L5.6 14.7z" />
            <path fill="#EA4335" d="M12 4.75c1.68 0 3.19.58 4.38 1.71l3.28-3.28C17.7 1.19 15.1 0 12 0 7.31 0 3.26 2.69 1.76 6.62L5.6 9.9C6.5 7.19 9.02 4.75 12 4.75z" />
          </svg>
          {loading ? "로그인 처리 중…" : "Google 계정으로 로그인"}
        </button>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
