"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, CalendarDays, Users } from "lucide-react";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/studies", label: "스터디", icon: BookOpen },
  { href: "/events", label: "행사", icon: CalendarDays },
  // 스터디원 + 운영진을 "유저" 하나로 통합 (실제 DB 유저 표시)
  { href: "/users", label: "유저", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname() || "/";

  return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:block">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5 text-[15px] font-bold">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold text-white"
          style={{ background: "var(--color-fg)" }}
        >
          S+
        </span>
        Back Office
      </div>
      <nav className="flex flex-col gap-0.5 p-3">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: "var(--color-accent-soft)", color: "var(--color-accent)" }
                  : { color: "var(--color-fg-muted)" }
              }
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
