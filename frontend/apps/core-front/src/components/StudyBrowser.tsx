'use client';

import { useState } from 'react';

import { CATEGORY_DISPLAY } from '@studyclub/mock';
import { FilterChip } from '@studyclub/ui';
import { ChevronDown, Search, X } from 'lucide-react';

import { StudyCard } from './StudyCard';
import { useStudies } from '@/features/studies/queries';
import type { StudyPhaseFilter, StudySearch, StudyTimezoneFilter } from '@/lib/api';
import type { Locale, Operator, Study } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { useUrlState } from '@/lib/use-url-state';

type RecruitmentFilter = 'all' | StudyPhaseFilter;
type TimezoneFilter = 'all' | StudyTimezoneFilter;

const RECRUITMENT_OPTIONS: { value: RecruitmentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'recruiting', label: '모집 중' },
  { value: 'ongoing', label: '진행 중' },
  { value: 'closed', label: '종료' },
];
/** 값은 API enum(`AI_ML` …), 라벨은 화면 표기. 순서는 `CATEGORY_DISPLAY` 선언 순서. */
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' },
  ...Object.entries(CATEGORY_DISPLAY).map(([value, label]) => ({ value, label })),
];
const TIMEZONE_OPTIONS: { value: TimezoneFilter; label: string }[] = [
  { value: 'KST', label: 'KST' },
  { value: 'PST', label: 'PST' },
  { value: 'both', label: '동시 모집' },
];

/** URL 쿼리 — `?q=react&status=recruiting&category=AI_ML&tz=KST`. 기본값은 싣지 않는다. */
const URL_DEFAULTS = { q: '', status: 'all', category: 'all', tz: 'all' };
const URL_ALLOWED = {
  status: RECRUITMENT_OPTIONS.map((o) => o.value),
  category: CATEGORY_OPTIONS.map((o) => o.value),
  tz: ['all', ...TIMEZONE_OPTIONS.map((o) => o.value)],
};

function FilterSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className='relative w-fit'>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className='h-9 min-w-0 appearance-none rounded-lg border border-border-strong bg-bg pl-3 pr-9 text-sm font-semibold text-fg outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]'
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        className='pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted'
        aria-hidden
      />
    </div>
  );
}

function FilterRow({ children, ...rest }: React.ComponentPropsWithoutRef<'div'>) {
  return (
    <div {...rest} className='flex flex-wrap gap-1.5'>
      {children}
    </div>
  );
}

/**
 * 스터디 목록 + 필터. 필터는 **서버가** 한다 — 조건이 바뀌면 `/api/studies` 를 다시 부른다.
 * 첫 화면은 서버 컴포넌트가 기본 조건으로 받아 둔 `studies` 를 그대로 쓴다.
 */
export function StudyBrowser({
  studies: initial,
  locale,
  leads,
}: {
  studies?: Study[];
  locale: Locale;
  leads: Record<string, Operator>;
}) {
  // 조건은 URL 이 정본이다 — 스터디를 열었다 뒤로 와도 걸어 둔 조건이 그대로다
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const query = filters.q;
  const recruitment = filters.status as RecruitmentFilter;
  const category = filters.category;
  const timezone = filters.tz as TimezoneFilter;
  // 입력칸의 글자만 화면 state — Enter·검색 버튼으로 확정할 때 URL 에 쓴다
  const [input, setInput] = useState(query);

  const search: StudySearch = {
    keyword: query.trim() || undefined,
    status: recruitment === 'all' ? undefined : recruitment,
    timezone: timezone === 'all' ? undefined : timezone,
    category: category === 'all' ? undefined : category,
  };
  // 첫 화면은 서버가 기본 조건으로 받아 뒀다(initial) — 같은 조건이면 다시 부르지 않는다.
  // 늦게 온 이전 응답이 새 결과를 덮는 문제는 쿼리 키가 조건별로 갈려 생기지 않는다.
  const { data, isFetching, isError } = useStudies(search, initial);
  const studies = data ?? initial ?? [];
  const loading = isFetching;
  const failed = isError;

  const hasQuery = query.trim().length > 0;
  const commitSearch = () => setFilters({ q: input });
  const clearSearch = () => {
    setInput('');
    setFilters(URL_DEFAULTS);
  };

  return (
    <div>
      {/*
        층마다 다른 모양을 쓴다 — 상단 사이트 메뉴가 이미 밑줄 탭이라, 여기서도 밑줄을 쓰면
        같은 위계로 읽힌다. 상태는 **세그먼트**, 카테고리는 **테두리 칩**.
      */}
      <div className='mb-6 flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-start gap-3'>
          <div
            role='tablist'
            aria-label='모집 상태'
            className='inline-flex w-fit shrink-0 rounded-pill bg-surface-2 p-1'
          >
            {RECRUITMENT_OPTIONS.map((option) => {
              const active = recruitment === option.value;
              return (
                <button
                  key={option.value}
                  type='button'
                  role='tab'
                  aria-selected={active}
                  onClick={() => setFilters({ status: option.value })}
                  className={`whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${active ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <div>
            <FilterSelect
              value={timezone}
              options={[{ value: 'all' as const, label: '시간대 전체' }, ...TIMEZONE_OPTIONS]}
              onChange={(tz) => setFilters({ tz })}
            />
          </div>
          <div className='relative flex h-9 w-full shrink-0 items-center rounded-pill border border-border-strong bg-bg px-1 transition-[width] duration-200 sm:ml-auto sm:w-[200px] sm:focus-within:w-[312px]'>
            <input
              role='searchbox'
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              placeholder={m('filter.search_studies', locale)}
              className='h-9 min-w-0 flex-1 bg-transparent pl-3 pr-2 text-sm outline-none'
            />
            {(input || hasQuery) && (
              <button
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
              type='button'
              onClick={commitSearch}
              aria-label='검색'
              className='shrink-0 rounded-lg px-3 py-2 text-fg-secondary hover:text-fg'
            >
              <Search size={16} />
            </button>
          </div>
        </div>
        <FilterRow>
          {CATEGORY_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              selected={category === option.value}
              selectMode='single'
              onClick={() => setFilters({ category: option.value })}
              className='h-auto py-1.5 text-[13px] font-semibold'
            >
              {option.label}
            </FilterChip>
          ))}
        </FilterRow>
      </div>

      {/* Grid */}
      {failed ? (
        <div className='flex min-h-[240px] items-center justify-center'>
          <p className='text-base font-bold text-fg-secondary'>
            {t(
              {
                ko: '스터디 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
                en: 'Could not load studies. Please try again.',
              },
              locale,
            )}
          </p>
        </div>
      ) : studies.length > 0 ? (
        <div
          aria-busy={loading}
          className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}
        >
          {studies.map((s) => (
            <StudyCard key={s.id} study={s} locale={locale} lead={s.lead ? leads[s.lead] : undefined} />
          ))}
        </div>
      ) : hasQuery ? (
        <div className='flex min-h-[240px] flex-col items-center justify-center gap-4 text-center'>
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
          <p className='text-base font-bold text-[var(--color-fg-muted)]'>{m('filter.none', locale)}</p>
        </div>
      )}
    </div>
  );
}
