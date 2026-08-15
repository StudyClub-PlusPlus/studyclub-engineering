"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

/**
 * 상단 메뉴 — **지금 보고 있는 화면을 표시한다.**
 * 표시가 없으면 사이트 안에서 자기 위치를 알 수 없어, 뒤로가기로만 이동하게 된다.
 */
export function NavLinks({
  links,
  mentoring,
}: {
  links: { href: string; label: string }[];
  mentoring?: { href: string; label: string };
}) {
  const pathname = usePathname() ?? "";

  return (
    <nav className="ml-2 hidden items-center gap-6 text-sm font-medium md:flex">
      {links.map((l) => {
        // /ko/studies 와 /ko/studies/xxx 는 같은 메뉴로 본다
        const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`relative py-5 transition-colors ${
              active ? "font-semibold text-fg" : "text-fg-muted hover:text-fg"
            }`}
          >
            {l.label}
            {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
          </Link>
        );
      })}
      {mentoring && (
        <a
          href={mentoring.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-fg-muted transition-colors hover:text-brand"
        >
          {mentoring.label}
          <ArrowUpRight size={13} />
        </a>
      )}
    </nav>
  );
}
