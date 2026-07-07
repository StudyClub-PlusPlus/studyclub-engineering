"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale, Operator, Study } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { StudyCard } from "./StudyCard";

type KindFilter = "all" | "study" | "club";
type StatusFilter = "all" | "recruiting" | "ongoing" | "closed";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
      style={
        active
          ? { color: "#fff", background: "var(--color-accent)" }
          : { color: "var(--color-fg-subtle)", background: "var(--color-surface-subtle)" }
      }
    >
      {children}
    </button>
  );
}

export function StudyBrowser({
  studies,
  locale,
  leads,
}: {
  studies: Study[];
  locale: Locale;
  leads: Record<string, Operator>;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  // 기본: 종료(closed) 숨김
  const [status, setStatus] = useState<StatusFilter>("all");
  // 날짜 범위 (ISO yyyy-mm-dd). 빈 문자열 = 열린 경계.
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      // 날짜 범위 — s.date 는 content 에서 항상 주입됨 (year 없으면 `${year}-01-01`).
      // yyyy-mm-dd 는 사전순 비교가 곧 날짜순 비교.
      const d = s.date ?? "";
      if (from && (!d || d < from)) return false;
      if (to && (!d || d > to)) return false;
      // 종류
      if (kind !== "all") {
        const k = s.kind ?? "study";
        if (k !== kind) return false;
      }
      // 상태 — 기본(all)은 종료 숨김, "종료" 선택 시에만 종료 표시
      if (status === "all") {
        if (s.status === "closed") return false;
      } else if (s.status !== status) {
        return false;
      }
      // 검색 — 제목·요약·태그·카테고리 (ko+en)
      if (q) {
        const hay = [
          s.title.ko,
          s.title.en,
          s.summary.ko,
          s.summary.en,
          s.category ?? "",
          ...(s.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [studies, query, kind, status, from, to]);

  const kindOptions: { value: KindFilter; label: string }[] = [
    { value: "all", label: m("filter.all", locale) },
    { value: "study", label: m("kind.study", locale) },
    { value: "club", label: m("kind.club", locale) },
  ];
  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: "all", label: m("filter.all", locale) },
    { value: "recruiting", label: m("status.recruiting", locale) },
    { value: "ongoing", label: m("status.ongoing", locale) },
    { value: "closed", label: m("status.closed", locale) },
  ];

  return (
    <div className="mt-8">
      {/* Toolbar — 검색 + 필터를 하나의 정돈된 패널로 */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-5">
      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-fg-faint)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={m("filter.search_studies", locale)}
          className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-[var(--color-accent)]"
        />
      </div>

      {/* Filter chips */}
      <div className="mt-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-[var(--color-fg-faint)]">{m("filter.kind", locale)}</span>
          {kindOptions.map((o) => (
            <FilterChip key={o.value} active={kind === o.value} onClick={() => setKind(o.value)}>
              {o.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-[var(--color-fg-faint)]">{m("filter.status", locale)}</span>
          {statusOptions.map((o) => (
            <FilterChip key={o.value} active={status === o.value} onClick={() => setStatus(o.value)}>
              {o.label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold text-[var(--color-fg-faint)]">{m("filter.date", locale)}</span>
          <input
            type="date"
            aria-label={m("filter.date_from", locale)}
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--color-accent)]"
          />
          <span className="text-xs text-[var(--color-fg-faint)]">~</span>
          <input
            type="date"
            aria-label={m("filter.date_to", locale)}
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs outline-none transition-colors focus:border-[var(--color-accent)]"
          />
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-[var(--color-fg-subtle)] transition-colors hover:text-[var(--color-fg)]"
            >
              {m("filter.reset", locale)}
            </button>
          )}
        </div>
      </div>
      </div>

      {/* 결과 카운트 */}
      <div className="mt-5 text-sm font-semibold text-[var(--color-fg-subtle)]">
        {filtered.length}
        {locale === "ko" ? "개" : ""}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-[var(--color-fg-subtle)]">{m("filter.none", locale)}</p>
      )}
    </div>
  );
}
