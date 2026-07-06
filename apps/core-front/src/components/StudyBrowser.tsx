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
  const [year, setYear] = useState<string>("all");

  // 존재하는 연도(내림차순)
  const years = useMemo(
    () => Array.from(new Set(studies.map((s) => s.year).filter(Boolean) as string[])).sort((a, b) => b.localeCompare(a)),
    [studies],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      // 연도(날짜)
      if (year !== "all" && s.year !== year) return false;
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
  }, [studies, query, kind, status, year]);

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
    <div className="mt-10">
      {/* Search */}
      <div className="relative max-w-md">
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
        {years.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold text-[var(--color-fg-faint)]">{m("filter.year", locale)}</span>
            <FilterChip active={year === "all"} onClick={() => setYear("all")}>
              {m("filter.all", locale)}
            </FilterChip>
            {years.map((y) => (
              <FilterChip key={y} active={year === y} onClick={() => setYear(y)}>
                {y}
              </FilterChip>
            ))}
          </div>
        )}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
