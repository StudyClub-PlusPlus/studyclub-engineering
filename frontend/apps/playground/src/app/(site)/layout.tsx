import Link from "next/link";

const NAV = [
  { href: "/", label: "홈" },
  { href: "/components", label: "컴포넌트" },
  { href: "/screens/study-detail", label: "화면 · 스터디 상세" },
  { href: "/proto", label: "프로토" },
];

/** 문서형 크롬 — 카탈로그·시안 인덱스처럼 "읽는" 화면이 쓴다. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
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
    </>
  );
}
