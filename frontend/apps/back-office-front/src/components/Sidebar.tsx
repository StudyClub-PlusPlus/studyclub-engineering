"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, BookOpen, CalendarDays, Users, LogOut } from "lucide-react";
import { getUser, logout, type SessionUser } from "@/lib/auth";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard, exact: true },
  { href: "/studies", label: "스터디", icon: BookOpen },
  { href: "/events", label: "행사", icon: CalendarDays },
  // 스터디원 + 운영진을 "유저" 하나로 통합 (실제 DB 유저 표시)
  { href: "/users", label: "유저", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  async function handleLogout() {
    await logout();
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-[var(--color-border)] px-5 text-[15px] font-bold">
        <span
          className="grid h-7 w-7 place-items-center rounded-lg text-xs font-extrabold text-white"
          style={{ background: "var(--color-fg)" }}
        >
          S+
        </span>
        Back Office
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
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

      {/* 계정 + 로그아웃 (사이드바 하단) */}
      <div className="border-t border-[var(--color-border)] p-3">
        {user ? (
          <div className="flex items-center gap-2.5">
            {user.picture ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.picture} alt="" className="h-8 w-8 shrink-0 rounded-full" />
            ) : (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                {(user.name ?? user.email).slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.name ?? "운영자"}</div>
              <div className="truncate text-xs text-[var(--color-fg-subtle)]">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="로그아웃"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--color-fg-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-red-600"
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div className="px-1 py-2 text-xs text-[var(--color-fg-subtle)]">로그인 필요</div>
        )}
      </div>
    </aside>
  );
}
