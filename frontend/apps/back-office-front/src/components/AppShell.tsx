"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

// 로그인 전(/login)에는 사이드바·헤더 없이 children 만 렌더. 그 외에는 운영 콘솔 셸.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";

  if (pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-6 backdrop-blur-md">
          <div className="text-sm font-bold tracking-tight">StudyClub++ Back Office</div>
          <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-subtle)]">
            운영자 콘솔
          </span>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
