"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/content";

type Region = {
  id: string;
  flag: string;
  name: { ko: string; en: string };
  city: { ko: string; en: string };
  tz: string;
  color: string; // 대표 색
  soft: string; // 옅은 배경
};

// 스터디 클럽이 활동하는 세 지역 (운영진 분포 기준).
const REGIONS: Region[] = [
  {
    id: "us",
    flag: "🇺🇸",
    name: { ko: "미국", en: "USA" },
    city: { ko: "베이 에어리어", en: "Bay Area" },
    tz: "America/Los_Angeles",
    color: "#2563eb",
    soft: "#eff4ff",
  },
  {
    id: "kr",
    flag: "🇰🇷",
    name: { ko: "한국", en: "Korea" },
    city: { ko: "서울", en: "Seoul" },
    tz: "Asia/Seoul",
    color: "#e03131",
    soft: "#fff0f0",
  },
  {
    id: "ca",
    flag: "🇨🇦",
    name: { ko: "캐나다", en: "Canada" },
    city: { ko: "밴쿠버", en: "Vancouver" },
    tz: "America/Vancouver",
    color: "#e8590c",
    soft: "#fff4ed",
  },
];

function parts(tz: string, locale: Locale) {
  const loc = locale === "ko" ? "ko-KR" : "en-US";
  const now = new Date();
  const time = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const date = new Intl.DateTimeFormat(loc, {
    timeZone: tz,
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false }).format(now),
  );
  const daytime = hour >= 7 && hour < 19;
  return { time, date, daytime };
}

export function RegionClocks({ locale }: { locale: Locale }) {
  // SSR/CSR 시각 불일치(hydration) 방지: 마운트 전엔 placeholder.
  const [mounted, setMounted] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {REGIONS.map((r) => {
        const p = mounted ? parts(r.tz, locale) : null;
        return (
          <div
            key={r.id}
            className="card overflow-hidden p-0"
            style={{ borderTop: `3px solid ${r.color}` }}
          >
            <div className="flex items-center gap-3 px-5 pt-4">
              <span className="text-2xl leading-none">{r.flag}</span>
              <div className="min-w-0">
                <div className="font-semibold" style={{ color: r.color }}>
                  {locale === "ko" ? r.name.ko : r.name.en}
                </div>
                <div className="text-xs text-[var(--color-fg-subtle)]">
                  {locale === "ko" ? r.city.ko : r.city.en}
                </div>
              </div>
              <span className="ml-auto text-lg">{p ? (p.daytime ? "☀️" : "🌙") : ""}</span>
            </div>
            <div className="mt-2 px-5 pb-4" style={{ background: r.soft }}>
              <div
                className="pt-3 font-mono text-3xl font-bold tabular-nums tracking-tight"
                style={{ color: r.color }}
                suppressHydrationWarning
              >
                {p ? p.time : "--:--:--"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-fg-muted)]" suppressHydrationWarning>
                {p ? p.date : " "}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
