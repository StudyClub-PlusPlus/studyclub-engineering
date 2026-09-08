'use client';

import { useMemo, useState } from 'react';

import type { Locale, Operator, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { recruitState, recruitTabLabel, type RecruitState } from '@core/lib/recruit';
import { STUDY_CATEGORIES } from '@studyclub/mock';
import { Search, X } from 'lucide-react';

import { StudyCard } from './StudyCard';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { STUDY_BROWSER_SPEC } from '@/proto/specs/study-browser';

/** 상태는 칩이 아니라 최상위 탭으로 분기한다. 카드 CTA와 동일 기준(`lib/recruit`). */
type StateTab = RecruitState | 'all';

const TAB_ORDER: StateTab[] = ['all', 'apply', 'closed'];

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
      type='button'
      onClick={onClick}
      aria-pressed={active}
      // 테두리로 칸을 나눈다 — 배경색만으로는 흰 바탕에서 칩 경계가 보이지 않는다
      className={`shrink-0 rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-brand bg-brand text-on-brand'
          : 'border-border-strong bg-bg text-fg-secondary hover:border-fg-muted hover:text-fg'
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
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  // 기본 탭은 "모집중" — 목록에 들어온 사람이 가장 먼저 찾는 것
  const [tab, setTab] = useState<StateTab>('apply');
  /** 카테고리는 상태 탭의 **하위** 필터 — 먼저 모집 여부로 고르고, 그 안에서 분야를 좁힌다. */
  const [category, setCategory] = useState<string>('all');
  /** 탭을 제외한 나머지 조건만 적용한 집합 — 탭별 건수 계산의 기준이 된다. */
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (q && !`${s.title.ko} ${s.title.en} ${s.category ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [studies, query, category]);

  const counts = useMemo(() => {
    const c: Record<StateTab, number> = { apply: 0, closed: 0, all: base.length };
    for (const s of base) c[recruitState(s)] += 1;
    return c;
  }, [base]);

  const hasQuery = query.trim().length > 0;
  const commitSearch = () => setQuery(input);
  const clearSearch = () => {
    setInput('');
    setQuery('');
    setTab('apply');
    setCategory('all');
  };

  const filtered = useMemo(() => (tab === 'all' ? base : base.filter((s) => recruitState(s) === tab)), [base, tab]);

  const tabLabel = (s: StateTab) => (s === 'all' ? t({ ko: '전체', en: 'All' }, locale) : recruitTabLabel(s, locale));

  return (
    <div>
      <ScreenSpecRegistrar spec={STUDY_BROWSER_SPEC} />
      {/* 검색바(왼쪽) + 상태 탭(오른쪽) — 항상 인라인 배치 */}
      <div className='mb-3 flex items-center gap-3'>
        <div
          data-anno='1'
          className='relative flex flex-1 items-center rounded-xl border border-border-strong bg-bg transition-[border-color,box-shadow] focus-within:border-brand focus-within:shadow-[var(--ring)]'
        >
          <input
            data-anno='1-1'
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
            placeholder={m('filter.search_studies', locale)}
            className='h-11 flex-1 bg-transparent pl-4 pr-2 text-sm outline-none'
          />
          {(input || hasQuery) && (
            <button
              data-anno='1-2'
              type='button'
              onClick={clearSearch}
              aria-label='검색어 지우기'
              className='shrink-0 rounded-full p-1 text-fg-muted hover:text-fg'
            >
              <X size={14} />
            </button>
          )}
          <div className='mx-1 h-5 w-px shrink-0 bg-border-strong' />
          <button
            data-anno='1-3'
            type='button'
            onClick={commitSearch}
            aria-label='검색'
            className='shrink-0 rounded-lg px-3 py-2 text-fg-secondary hover:text-fg'
          >
            <Search size={16} />
          </button>
        </div>

        {/* 상태 탭 — 항상 표시 */}
        <div data-anno='2' role='tablist' className='inline-flex shrink-0 rounded-pill bg-surface-2 p-1'>
          {TAB_ORDER.map((s) => {
            const on = tab === s;
            return (
              <button
                key={s}
                type='button'
                role='tab'
                aria-selected={on}
                onClick={() => setTab(s)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${
                  on ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'
                }`}
              >
                {tabLabel(s)}
                <span className={`tnum text-xs ${on ? 'text-fg-secondary' : 'text-fg-muted'}`}>{counts[s]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 카테고리 칩 — 항상 표시 */}
      <div data-anno='3' className='no-scrollbar mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap'>
        <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
          {t({ ko: '전체', en: 'All' }, locale)}
        </CategoryChip>
        {STUDY_CATEGORIES.map((c) => (
          <CategoryChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {c}
          </CategoryChip>
        ))}
      </div>

      {/* 결과 건수 — 검색어 있을 때만 */}
      {hasQuery && (
        <p data-anno='4' className='mb-5 text-sm text-fg-secondary'>
          <span className='font-semibold text-fg'>&quot;{query.trim()}&quot;</span>
          {t({ ko: ` 검색 결과 `, en: ` — ` }, locale)}
          <span className='font-semibold text-fg'>
            {filtered.length}
            {t({ ko: '개', en: ` result${filtered.length !== 1 ? 's' : ''}` }, locale)}
          </span>
        </p>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div data-anno='5' className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {filtered.map((s) => (
            <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
          ))}
        </div>
      ) : hasQuery ? (
        /* 검색 결과 없음 — PRD §2 상태별 화면 empty */
        <div data-anno='6' className='flex min-h-[240px] flex-col items-center justify-center gap-4 text-center'>
          <p className='text-base font-bold text-fg-secondary'>
            <span className='text-fg'>&quot;{query.trim()}&quot;</span>
            {t({ ko: '에 해당하는 스터디를 찾을 수 없어요', en: ' — no studies found' }, locale)}
          </p>
          <button
            type='button'
            onClick={clearSearch}
            className='rounded-pill border border-border-strong px-4 py-1.5 text-sm font-semibold text-fg-secondary hover:border-fg-muted hover:text-fg'
          >
            {t({ ko: '검색어 지우기', en: 'Clear search' }, locale)}
          </button>
        </div>
      ) : (
        <div className='flex min-h-[240px] items-center justify-center'>
          <p data-anno='7' className='text-base font-bold text-[var(--color-fg-subtle)]'>
            {m('filter.none', locale)}
          </p>
        </div>
      )}
    </div>
  );
}
