'use client';

import { useEffect, useRef, useState } from 'react';

import type { Locale, Study } from '@studyclub/types';
import { Button, FilterChip, Segmented, TimeZonePicker } from '@studyclub/ui';
import { CATEGORY_DISPLAY } from '@studyclub/utils';
import { Search, X } from 'lucide-react';

import { StudyListCard } from './StudyListCard';
import { useStudies } from '@/features/studies/queries';
import type { StudyPhaseFilter, StudySearch, StudyTimezoneFilter } from '@/features/studies/types';
import { track, type AnalyticsEvent } from '@/lib/analytics';
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
/** 값은 API enum, 라벨은 playground 모집 시간대 필터와 같은 지역 이름(한국 · 미국 · LA). 서버가 아직 KST · PST · BOTH 로만 거른다. */
const TIMEZONE_OPTIONS: { value: TimezoneFilter; label: string }[] = [
  { value: 'KST', label: '한국' },
  { value: 'PST', label: '미국 · LA' },
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
    <FilterChip selected={active} selectMode='single' onClick={onClick}>
      {children}
    </FilterChip>
  );
}

/** URL 쿼리 — `?q=react&status=recruiting&category=AI_ML&tz=KST`. 기본값은 싣지 않는다. */
const URL_DEFAULTS = { q: '', status: 'all', category: 'all', tz: 'all' };
const URL_ALLOWED = {
  status: RECRUITMENT_OPTIONS.map((o) => o.value),
  category: CATEGORY_OPTIONS.map((o) => o.value),
  tz: ['all', ...TIMEZONE_OPTIONS.map((o) => o.value)],
};

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
}: {
  studies?: Study[];
  locale: Locale;
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

  // 결과 수는 새 조건의 응답이 와야 안다 — 클릭 순간의 studies 는 이전 조건의 목록이다.
  // 조건이 바뀌고 로딩이 끝나면 그때 보낸다. 실패한 조회는 보내지 않는다(결과 수가 없다).
  const searchKey = JSON.stringify(search);
  const pendingTrack = useRef<{ fromKey: string; build: (resultCount: number) => AnalyticsEvent } | null>(null);
  const trackAfterLoad = (build: (resultCount: number) => AnalyticsEvent) => {
    pendingTrack.current = { fromKey: searchKey, build };
  };
  useEffect(() => {
    const pending = pendingTrack.current;
    if (!pending || loading || searchKey === pending.fromKey) return;
    pendingTrack.current = null;
    if (!failed) track(pending.build(studies.length));
  }, [searchKey, loading, failed, studies.length]);

  const hasQuery = query.trim().length > 0;
  const commitSearch = () => {
    if (input.trim() !== query.trim()) {
      const queryLength = input.trim().length;
      trackAfterLoad((count) => ({
        name: 'Study Searched',
        props: { query_length: queryLength, result_count: count, has_results: count > 0 },
      }));
    }
    setFilters({ q: input });
  };
  const clearSearch = () => {
    setInput('');
    setFilters(URL_DEFAULTS);
  };

  return (
    <div>
      {/*
        층마다 다른 모양을 쓴다. 상단 사이트 메뉴가 이미 밑줄 탭이라, 여기서도 밑줄을 쓰면
        같은 위계로 읽힌다. 상태는 **세그먼트**, 카테고리는 **테두리 칩**.
      */}
      <div className='mb-6 flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-start gap-3'>
          <Segmented
            shape='pill'
            aria-label='모집 상태'
            value={recruitment}
            options={RECRUITMENT_OPTIONS}
            onChange={(value) => {
              if (value !== recruitment) {
                trackAfterLoad((count) => ({
                  name: 'Study Filter Tab Changed',
                  props: {
                    tab: value as 'all' | 'recruiting' | 'ongoing' | 'closed',
                    result_count: count,
                    category: filters.category,
                  },
                }));
              }
              setFilters({ status: value });
            }}
            className='shrink-0'
          />
          <div>
            <TimeZonePicker
              className='w-40'
              size='sm'
              label='모집 시간대 필터'
              hideLabel
              value={timezone}
              options={[{ value: 'all', label: '시간대 전체' }, ...TIMEZONE_OPTIONS]}
              onChange={(tz) => setFilters({ tz: tz as TimezoneFilter })}
            />
          </div>
          <div className='relative flex h-9 w-full shrink-0 items-center rounded-pill border border-border bg-bg px-1 transition-[border-color,width] duration-200 focus-within:border-border-interactive sm:ml-auto sm:w-[200px] sm:focus-within:w-full lg:focus-within:w-[312px]'>
            <input
              // ui-native: 늘어나는 알약 검색창 — 지우기 · 검색 단추를 품은 고유 검색칸
              role='searchbox'
              type='text'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
              placeholder={m('filter.search_studies', locale)}
              className='h-9 min-w-0 flex-1 bg-transparent pl-3 pr-2 type-label-lg outline-none'
            />
            {(input || hasQuery) && (
              <button
                // ui-native: 꾸민 검색창 안의 지우기 표시 — 늘어나는 알약 검색창의 일부
                type='button'
                onClick={clearSearch}
                aria-label='검색어 지우기'
                className='shrink-0 rounded-full p-1 text-fg-muted hover:text-fg'
              >
                <X size={14} />
              </button>
            )}
            <div className='mx-1 h-5 w-px shrink-0 bg-border' />
            <button
              // ui-native: 꾸민 검색창 안의 검색 단추 — 늘어나는 알약 검색창의 일부
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
              onClick={() => {
                if (category !== option.value) {
                  trackAfterLoad((count) => ({
                    name: 'Study Category Filtered',
                    props: { category: option.value, tab: filters.status, result_count: count },
                  }));
                }
                setFilters({ category: option.value });
              }}
            >
              {option.label}
            </FilterOption>
          ))}
        </FilterRow>
      </div>

      {/* Grid */}
      {failed ? (
        <div className='flex min-h-[240px] items-center justify-center'>
          <p className='type-title-md text-fg-secondary'>
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
          className={`grid grid-cols-2 gap-3 transition-opacity sm:gap-4 lg:grid-cols-3 ${loading ? 'opacity-60' : ''}`}
        >
          {studies.map((s, i) => (
            <StudyListCard key={s.id} study={s} locale={locale} index={i} />
          ))}
        </div>
      ) : hasQuery ? (
        <div className='flex min-h-[240px] flex-col items-center justify-center gap-4 text-center'>
          <p className='type-title-md text-fg-secondary'>
            <span className='text-fg'>&quot;{query.trim()}&quot;</span>
            {t({ ko: '에 해당하는 스터디를 찾을 수 없어요', en: ': no studies found' }, locale)}
          </p>
          <Button type='button' variant='secondary' size='sm' onClick={clearSearch}>
            {t({ ko: '검색어 지우기', en: 'Clear search' }, locale)}
          </Button>
        </div>
      ) : (
        <div className='flex min-h-[240px] items-center justify-center'>
          <p className='type-title-md text-[var(--color-fg-muted)]'>{m('filter.none', locale)}</p>
        </div>
      )}
    </div>
  );
}
