import Link from "next/link";

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Playground · StudyClub++", template: "%s · Playground" },
  description: "StudyClub++ 디자인 playground — 실제 컴포넌트로 화면을 조립하는 샌드박스.",
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/", label: "홈" },
  { href: "/components", label: "컴포넌트" },
  { href: "/screens/study-detail", label: "화면 · 스터디 상세" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body className="min-h-full">
        <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-bold">
              <span
                className="grid h-6 w-6 place-items-center rounded-md text-[11px] font-extrabold text-white"
                style={{ background: "var(--color-accent)" }}
              >
                S
              </span>
              Playground
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="text-[var(--color-fg-muted)] transition-colors hover:text-[var(--color-fg)]"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-[11px] font-semibold text-[var(--color-fg-subtle)]">
              미공개 · noindex
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
