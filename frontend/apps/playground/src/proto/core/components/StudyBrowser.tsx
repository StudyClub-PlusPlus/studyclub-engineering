'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Locale, Operator, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { recruitState } from '@core/lib/recruit';
import { toISODate } from '@studyclub/mock';
import { Check, Search, X } from 'lucide-react';

import { StudyCard } from './StudyCard';
import { getBookmarks } from '@core/lib/me';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { APPLY_COMPLETE_SPEC, APPLY_SPEC, DISCORD_GATE_SPEC } from '@/proto/specs/study-apply';
import { STUDY_BROWSER_SPEC } from '@/proto/specs/study-browser';

type RecruitmentFilter = 'all' | 'recruiting' | 'ongoing' | 'closed';
type SortOption = 'default' | 'deadline' | 'bookmarks' | 'participants' | 'ended' | 'completion';
type TimezoneFilter = 'all' | 'KST' | 'PST' | 'both';

const RECRUITMENT_OPTIONS: { value: RecruitmentFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'recruiting', label: '모집 중' },
  { value: 'ongoing', label: '진행 중' },
  { value: 'closed', label: '종료' },
];
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'AI&ML', label: 'AI · ML' },
  { value: '알고리즘', label: '알고리즘' }, { value: '데이터', label: '데이터' },
  { value: '소프트웨어 개발', label: '소프트웨어 개발' }, { value: '커리어', label: '커리어' },
  { value: '북클럽', label: '북클럽' }, { value: '어학', label: '어학' },
  { value: '라이프스타일', label: '라이프스타일' }, { value: '기획 · PM', label: '기획 · PM' },
  { value: '비즈니스', label: '비즈니스' }, { value: '기타', label: '기타' },
];
const TIMEZONE_OPTIONS: { value: TimezoneFilter; label: string }[] = [
  { value: 'KST', label: 'KST' }, { value: 'PST', label: 'PST' }, { value: 'both', label: '동시 모집' },
];

function statusOf(study: Study): Exclude<RecruitmentFilter, 'all'> {
  if (study.status === 'ongoing') return 'ongoing';
  if (study.status === 'closed' || recruitState(study) === 'closed') return 'closed';
  return 'recruiting';
}
function sortOptionsFor(status: RecruitmentFilter): { value: SortOption; label: string }[] {
  if (status === 'recruiting') {
    return [
      { value: 'deadline', label: '모집 기한이 가까운 순' },
      { value: 'bookmarks', label: '찜 순' },
    ];
  }
  if (status === 'ongoing') return [{ value: 'participants', label: '사람 많은 순' }];
  if (status === 'closed') {
    return [
      { value: 'ended', label: '스터디 끝난 기한 순' },
      { value: 'participants', label: '사람 많은 순' },
      { value: 'completion', label: '완주율 순' },
    ];
  }
  return [{ value: 'default', label: '기본 순' }];
}

function dateNumber(raw?: string): number {
  const value = raw ? Date.parse(`${toISODate(raw)}T23:59:59`) : Number.NaN;
  return Number.isNaN(value) ? 0 : value;
}

function timezoneOf(study: Study): Exclude<TimezoneFilter, 'all'> {
  const text = [study.schedule?.ko, study.schedule?.en, study.recruitment?.kickoff].filter(Boolean).join(' ');
  if (/PST|PDT/i.test(text)) return 'PST';
  if (/KST/i.test(text)) return 'KST';
  return 'both';
}
function categoryMatches(study: Study, value: string): boolean {
  const text = `${study.category ?? ''} ${study.title.ko} ${study.summary.ko}`;
  const patterns: Record<string, RegExp> = {
    알고리즘: /알고리즘|algorithm|leetcode|리트코드|코테/i,
    데이터: /데이터|data|sql|db|디비/i,
    '소프트웨어 개발': /be|fe|소프트웨어 개발|코딩|coding|backend|frontend|개발/i,
    커리어: /커리어|career|취업|resume|이력서|interview|면접/i,
    북클럽: /북클럽|book|독서|리딩/i,
    '기획 · PM': /기획|pm|프로덕트|product/i,
  };
  return patterns[value]?.test(text) ?? study.category === value;
}
function searchText(study: Study): string {
  return [study.title.ko, study.title.en, study.summary.ko, study.summary.en].filter(Boolean).join(' ').toLowerCase();
}

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
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function SortChoices({
  value,
  options,
  onChange,
}: {
  value: SortOption;
  options: { value: SortOption; label: string }[];
  onChange: (value: SortOption) => void;
}) {
  return (
    <div className='flex flex-wrap gap-x-5 gap-y-2'>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type='button'
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 text-sm font-semibold transition-colors ${active ? 'text-brand' : 'text-fg-secondary hover:text-fg'}`}
          >
            <Check size={16} strokeWidth={2.5} className={active ? 'text-brand' : 'invisible'} aria-hidden='true' />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterRow({ children }: { children: React.ReactNode }) {
  return <div className='flex flex-wrap gap-1.5'>{children}</div>;
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
  const [recruitment, setRecruitment] = useState<RecruitmentFilter>('all');
  const [sort, setSort] = useState<SortOption>('default');
  const [bookmarks, setBookmarks] = useState<string[]>([]);
  useEffect(() => setBookmarks(getBookmarks()), []);
  const [category, setCategory] = useState<string>('all');
  const [timezone, setTimezone] = useState<TimezoneFilter>('all');
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return studies.filter((s) => {
      if (category !== 'all' && !categoryMatches(s, category)) return false;
      if (timezone !== 'all' && timezoneOf(s) !== timezone) return false;
      if (q && !searchText(s).includes(q)) return false;
      return true;
    });
  }, [studies, query, category, timezone]);


  const hasQuery = query.trim().length > 0;
  const commitSearch = () => setQuery(input);
  const clearSearch = () => {
    setInput('');
    setQuery('');
    setRecruitment('all');
    setSort('default');
    setCategory('all');
    setTimezone('all');
  };

  const filtered = useMemo(() => {
    const list = recruitment === 'all' ? base : base.filter((s) => statusOf(s) === recruitment);
    return [...list].sort((a, b) => {
      if (sort === 'deadline') return (dateNumber(a.recruitment?.deadline) || Number.MAX_SAFE_INTEGER) - (dateNumber(b.recruitment?.deadline) || Number.MAX_SAFE_INTEGER);
      if (sort === 'bookmarks') return Number(bookmarks.includes(b.id)) - Number(bookmarks.includes(a.id)) || (a.order ?? 99) - (b.order ?? 99);
      if (sort === 'participants') return (b.stats?.participants ?? b.seats?.taken ?? 0) - (a.stats?.participants ?? a.seats?.taken ?? 0);
      if (sort === 'ended') return dateNumber(b.date ?? b.recruitment?.deadline) - dateNumber(a.date ?? a.recruitment?.deadline);
      if (sort === 'completion') return (b.stats?.completion_rate ?? -1) - (a.stats?.completion_rate ?? -1);
      return (a.order ?? 99) - (b.order ?? 99);
    });
  }, [base, bookmarks, recruitment, sort]);

  const sortOptions = sortOptionsFor(recruitment);


  return (
    <div>
      {/*
        층마다 다른 모양을 쓴다 — 상단 사이트 메뉴가 이미 밑줄 탭이라, 여기서도 밑줄을 쓰면
        같은 위계로 읽힌다. 상태는 **세그먼트**, 카테고리는 **테두리 칩**.
      */}
      <div className='mb-6 flex flex-col gap-4'>
        <div className='flex flex-wrap items-center justify-start gap-3'>
        <div role='tablist' aria-label='모집 상태' className='inline-flex w-fit shrink-0 rounded-pill bg-surface-2 p-1'>
          {RECRUITMENT_OPTIONS.map((option) => {
            const active = recruitment === option.value;
            return (
              <button
                key={option.value}
                type='button'
                role='tab'
                aria-selected={active}
                onClick={() => {
                  setRecruitment(option.value);
                  setSort(sortOptionsFor(option.value)[0].value);
                }}
                className={`whitespace-nowrap rounded-pill px-4 py-1.5 text-sm font-bold transition-colors ${active ? 'bg-bg text-fg shadow-sm' : 'text-fg-secondary hover:text-fg'}`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        <FilterSelect
          value={timezone}
          options={[{ value: 'all' as const, label: '시간대' }, ...TIMEZONE_OPTIONS]}
          onChange={setTimezone}
        />
        <div className='relative flex h-9 w-full shrink-0 items-center rounded-pill border border-border-strong bg-bg px-1 sm:ml-auto sm:w-[312px]'>
          <Search
            size={15}
            className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-placeholder'
          />
          <input
            data-anno='2-1'
            type='text'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && commitSearch()}
            placeholder={m('filter.search_studies', locale)}
            className='h-9 min-w-0 flex-1 bg-transparent pl-9 pr-2 text-sm outline-none'
          />
          {(input || hasQuery) && (
            <button
              data-anno='2-2'
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
            data-anno='2-3'
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
            <FilterOption key={option.value} active={category === option.value} onClick={() => setCategory(option.value)}>{option.label}</FilterOption>
          ))}
        </FilterRow>
        <SortChoices value={sort} options={sortOptions} onChange={setSort} />

      </div>

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
