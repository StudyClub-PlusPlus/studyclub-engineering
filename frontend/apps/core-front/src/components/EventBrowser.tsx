"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { Locale, StudyclubEvent } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { EventRow } from "./EventCard";

/**
 * 행사 목록 — 스터디 목록과 **같은 규칙**으로 고른다.
 *
 * - 큰 상태(예정/지난)는 세그먼트, 그 하위 분류(타입)는 테두리 칩. 상단 사이트 메뉴가 밑줄 탭이라
 *   여기서 밑줄을 또 쓰면 같은 위계로 읽힌다
 * - 검색은 **제목만** — 소개까지 훑으면 무엇이 걸렸는지 알 수 없다
 * - 개수는 세그먼트가 말해주므로 따로 적지 않는다
 *
 * 목록 자체는 카드 격자가 아니라 시계열 세로 나열을 유지한다 — 행사는 "언제"가 먼저다.
 */

const TODAY = new Date().toISOString().slice(0, 10);

type WhenTab = "upcoming" | "past" | "all";
const WHEN_ORDER: WhenTab[] = ["upcoming", "past", "all"];

const WHEN_LABEL: Record<WhenTab, { ko: string; en: string }> = {
  upcoming: { ko: "예정", en: "Upcoming" },
  past: { ko: "지난 행사", en: "Past" },
  all: { ko: "전체", en: "All" },
};

type TypeFilter = "all" | "meetup" | "workshop" | "talk" | "online";

function TypeChip({
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
      className={`shrink-0 rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? "border-brand bg-brand text-on-brand"
          : "border-border-strong bg-bg text-fg-secondary hover:border-fg-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

export function EventBrowser({ events, locale }: { events: StudyclubEvent[]; locale: Locale }) {
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<WhenTab>("upcoming");
  const [type, setType] = useState<TypeFilter>("all");

  /** 시점 탭을 제외한 조건만 적용한 집합 — 탭별 건수의 기준. */
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (type !== "all" && e.type !== type) return false;
      if (q && !`${e.title.ko} ${e.title.en}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [events, query, type]);

  const counts = useMemo(() => {
    const c: Record<WhenTab, number> = { upcoming: 0, past: 0, all: base.length };
    for (const e of base) c[e.date >= TODAY ? "upcoming" : "past"] += 1;
    return c;
  }, [base]);

  const filtered = useMemo(() => {
    const list =
      when === "all" ? base : base.filter((e) => (when === "upcoming" ? e.date >= TODAY : e.date < TODAY));
    // 예정은 가까운 날부터, 지난 행사는 최근부터
    return [...list].sort((a, b) =>
      when === "upcoming" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date),
    );
  }, [base, when]);

  const typeOptions: { value: TypeFilter; label: string }[] = [
    { value: "all", label: m("filter.all", locale) },
    { value: "meetup", label: m("event_type.meetup", locale) },
    { value: "workshop", label: m("event_type.workshop", locale) },
    { value: "talk", label: m("event_type.talk", locale) },
    { value: "online", label: m("event_type.online", locale) },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div role="tablist" className="inline-flex shrink-0 rounded-pill bg-surface-2 p-1">
          {WHEN_ORDER.map((w) => {
            const on = when === w;
            return (
              <button
                key={w}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setWhen(w)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
                  on ? "bg-bg text-fg shadow-sm" : "text-fg-secondary hover:text-fg"
                }`}
              >
                {t(WHEN_LABEL[w], locale)}
                <span className={`tnum text-xs ${on ? "text-fg-secondary" : "text-fg-muted"}`}>{counts[w]}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-52 shrink-0">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-placeholder"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={m("filter.search_events", locale)}
            className="h-8 w-full rounded-pill border border-border-strong bg-bg pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]"
          />
        </div>
      </div>

      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto whitespace-nowrap">
        {typeOptions.map((o) => (
          <TypeChip key={o.value} active={type === o.value} onClick={() => setType(o.value)}>
            {o.label}
          </TypeChip>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="card divide-y divide-border overflow-hidden p-0">
          {filtered.map((e) => (
            <EventRow key={e.id} event={e} locale={locale} />
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm text-fg-secondary">{m("filter.none", locale)}</p>
      )}
    </div>
  );
}
