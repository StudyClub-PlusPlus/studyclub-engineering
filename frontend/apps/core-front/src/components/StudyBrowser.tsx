"use client";

import { useMemo, useState } from "react";

import { STUDY_CATEGORIES } from "@studyclub/mock";
import { Search } from "lucide-react";

import { StudyCard } from "./StudyCard";
import type { Locale, Operator, Study } from "@/lib/content";
import { m, t } from "@/lib/i18n";
import { recruitState, recruitTabLabel, type RecruitState } from "@/lib/recruit";

/** 상태는 칩이 아니라 최상위 탭으로 분기한다. 카드 CTA와 동일 기준(`lib/recruit`). */
type StateTab = RecruitState | "all";

const TAB_ORDER: StateTab[] = ["apply", "closed", "all"];

function CategoryChip({
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
      // 테두리로 칸을 나눈다 — 배경색만으로는 흰 바탕에서 칩 경계가 보이지 않는다
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
  // 기본 탭은 "모집 신청" — 목록에 들어온 사람이 가장 먼저 찾는 것
  const [tab, setTab] = useState<StateTab>("apply");
  /** 카테고리는 상태 탭의 **하위** 필터 — 먼저 모집 여부로 고르고, 그 안에서 분야를 좁힌다. */
  const [category, setCategory] = useState<string>("all");
  /** 탭을 제외한 나머지 조건만 적용한 집합 — 탭별 건수 계산의 기준이 된다. */
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      // 제목만 찾는다 — 소개·카테고리까지 훑으면 엉뚱한 결과가 섞여 무엇이 걸렸는지 알 수 없다
      if (q && !`${s.title.ko} ${s.title.en}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [studies, query, category]);

  const counts = useMemo(() => {
    const c: Record<StateTab, number> = { apply: 0, closed: 0, all: base.length };
    for (const s of base) c[recruitState(s)] += 1;
    return c;
  }, [base]);

  const filtered = useMemo(
    () => (tab === "all" ? base : base.filter((s) => recruitState(s) === tab)),
    [base, tab],
  );

  const tabLabel = (s: StateTab) =>
    s === "all" ? t({ ko: "전체", en: "All" }, locale) : recruitTabLabel(s, locale);

  return (
    <div>
      {/*
        층마다 다른 모양을 쓴다 — 상단 사이트 메뉴가 이미 밑줄 탭이라, 여기서도 밑줄을 쓰면
        같은 위계로 읽힌다. 상태는 **세그먼트**, 카테고리는 **테두리 칩**.
      */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div role="tablist" className="inline-flex shrink-0 rounded-pill bg-surface-2 p-1">
          {TAB_ORDER.map((s) => {
            const on = tab === s;
            return (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(s)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
                  on ? "bg-bg text-fg shadow-sm" : "text-fg-secondary hover:text-fg"
                }`}
              >
                {tabLabel(s)}
                <span className={`tnum text-xs ${on ? "text-fg-secondary" : "text-fg-muted"}`}>{counts[s]}</span>
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
            placeholder={m("filter.search_studies", locale)}
            className="h-8 w-full rounded-pill border border-border-strong bg-bg pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]"
          />
        </div>
      </div>

      {/* 카테고리 — 상태의 하위 필터. 한 줄을 온전히 써서 줄바꿈이 나지 않는다 */}
      <div className="no-scrollbar mb-5 flex gap-1.5 overflow-x-auto whitespace-nowrap">
        <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
          {t({ ko: "전체", en: "All" }, locale)}
        </CategoryChip>
        {STUDY_CATEGORIES.map((c) => (
          <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </CategoryChip>
        ))}
      </div>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
