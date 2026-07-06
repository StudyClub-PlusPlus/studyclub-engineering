import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: {
    default: "StudyClub++ Back Office",
    template: "%s · StudyClub++ Back Office",
  },
  description: "StudyClub++ 운영자 콘솔 — 스터디/행사/스터디원/운영진 관리 (mock 데이터).",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] px-6 backdrop-blur-md">
              <div className="text-sm font-bold tracking-tight">StudyClub++ Back Office</div>
              <span className="rounded-full bg-[var(--color-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--color-fg-subtle)]">
                mock · 운영자 프리뷰
              </span>
            </header>
            <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
