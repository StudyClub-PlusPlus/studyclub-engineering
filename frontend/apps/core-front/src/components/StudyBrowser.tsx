'use client';

import { useEffect, useRef, useState } from 'react';

import { CATEGORY_DISPLAY } from '@studyclub/mock';
import { Search, X } from 'lucide-react';

import { StudyCard } from './StudyCard';
import { searchStudies, type StudyPhaseFilter, type StudySearch, type StudyTimezoneFilter } from '@/lib/api';
import type { Locale, Operator, Study } from '@/lib/content';
import { m, t } from '@/lib/i18n';

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

function FilterOption({
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
      className={`flex shrink-0 items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-brand bg-brand text-on-brand'
          : 'border-border-strong bg-bg text-fg-secondary hover:border-fg-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}

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
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className='h-9 w-fit min-w-0 rounded-lg border border-border-strong bg-bg px-3 text-sm font-semibold text-fg outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]'
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
  studies: Study[];
  locale: Locale;
  leads: Record<string, Operator>;
}) {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [recruitment, setRecruitment] = useState<RecruitmentFilter>('all');
  const [category, setCategory] = useState<string>('all');
  const [timezone, setTimezone] = useState<TimezoneFilter>('all');

  const [studies, setStudies] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    // 첫 화면은 서버가 기본 조건으로 받아 뒀다 — 같은 요청을 한 번 더 보내지 않는다
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const search: StudySearch = {
      keyword: query.trim() || undefined,
      status: recruitment === 'all' ? undefined : recruitment,
      timezone: timezone === 'all' ? undefined : timezone,
      category: category === 'all' ? undefined : category,
    };
    // 빠르게 필터를 바꾸면 늦게 온 이전 응답이 새 결과를 덮는다 — 이전 요청은 끊는다
    const controller = new AbortController();
    setLoading(true);
    searchStudies(search, controller.signal)
      .then((next) => {
        setStudies(next);
        setFailed(false);
      })
      .catch((e: unknown) => {
        if ((e as Error).name !== 'AbortError') setFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [query, recruitment, timezone, category]);

  const hasQuery = query.trim().length > 0;
  const commitSearch = () => setQuery(input);
  const clearSearch = () => {
    setInput('');
    setQuery('');
    setRecruitment('all');
    setCategory('all');
    setTimezone('all');
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
                  onClick={() => setRecruitment(option.value)}
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
              onChange={setTimezone}
            />
          </div>
          <div className='relative flex h-9 w-full shrink-0 items-center rounded-pill border border-border-strong bg-bg px-1 sm:ml-auto sm:w-[312px]'>
            <Search
              size={15}
              className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-placeholder'
            />
            <input
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              placeholder={m('filter.search_studies', locale)}
              className='h-9 min-w-0 flex-1 bg-transparent pl-9 pr-2 text-sm outline-none'
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
            <FilterOption
              key={option.value}
              active={category === option.value}
              onClick={() => setCategory(option.value)}
            >
              {option.label}
            </FilterOption>
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
          <p className='text-base font-bold text-[var(--color-fg-subtle)]'>{m('filter.none', locale)}</p>
        </div>
      )}
    </div>
  );
}
