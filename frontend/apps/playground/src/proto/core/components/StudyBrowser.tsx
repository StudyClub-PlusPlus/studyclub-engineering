'use client';

import { useMemo, useState } from 'react';

import type { Locale, Operator, Study } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { recruitState } from '@core/lib/recruit';
import { toISODate } from '@studyclub/mock';
import { Search, X } from 'lucide-react';

import { StudyCard } from './StudyCard';
import { ScreenSpecRegistrar } from '@/proto/annotate';
import { STUDY_BROWSER_SPEC } from '@/proto/specs/study-browser';

type RecruitmentFilter = 'all' | 'scheduled' | 'recruiting' | 'imminent' | 'closed' | 'always';
type TimezoneFilter = 'all' | 'KST' | 'PST' | 'both';

const RECRUITMENT_OPTIONS: { value: RecruitmentFilter; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'scheduled', label: '모집 예정' },
  { value: 'recruiting', label: '모집 중' }, { value: 'imminent', label: '종료 임박' },
  { value: 'closed', label: '모집 마감' }, { value: 'always', label: '상시 모집' },
];
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '전체' }, { value: 'AI&ML', label: 'AI · ML' },
  { value: 'CS(컴퓨터 사이언스)', label: 'CS' }, { value: '데이터 사이언스', label: '데이터' },
  { value: 'BE', label: '백엔드' }, { value: 'FE', label: '프론트엔드' },
  { value: '모바일 프로그래밍', label: '모바일' }, { value: '기획', label: '기획' },
  { value: 'PM', label: 'PM' }, { value: '디자인', label: '디자인' },
  { value: '커리어', label: '커리어' }, { value: '어학', label: '어학' },
  { value: '라이프스타일', label: '라이프스타일' }, { value: '비즈니스', label: '비즈니스' },
  { value: '기타', label: '기타' },
];
const TIMEZONE_OPTIONS: { value: TimezoneFilter; label: string }[] = [
  { value: 'KST', label: 'KST' }, { value: 'PST', label: 'PST' }, { value: 'both', label: '동시 모집' },
];

function statusOf(study: Study): Exclude<RecruitmentFilter, 'all'> {
  if (study.recruitment?.status === 'always' || study.recruitment?.status === 'monthly') return 'always';
  if (study.status === 'closed' || recruitState(study) === 'closed') return 'closed';
  if (study.publish_at && study.publish_at > new Date().toISOString().slice(0, 10)) return 'scheduled';
  const deadline = toISODate(study.recruitment?.deadline);
  if (deadline) {
    const days = Math.ceil((Date.parse(`${deadline}T23:59:59`) - Date.now()) / 86_400_000);
    if (days >= 0 && days <= 3) return 'imminent';
  }
  return 'recruiting';
}
function timezoneOf(study: Study): Exclude<TimezoneFilter, 'all'> {
  const text = [study.schedule?.ko, study.schedule?.en, study.recruitment?.kickoff].filter(Boolean).join(' ');
  if (/PST|PDT/i.test(text)) return 'PST';
  if (/KST/i.test(text)) return 'KST';
  return 'both';
}
function categoryMatches(study: Study, value: string): boolean {
  if (value === 'PM') return /pm|프로덕트|product/i.test(`${study.category ?? ''} ${study.title.ko}`);
  if (value === '커리어') return /커리어|career|취업|resume|이력서|interview|면접/i.test(`${study.category ?? ''} ${study.title.ko} ${study.summary.ko}`);
  return study.category === value;
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
      <span aria-hidden='true' className={active ? 'text-current' : 'text-fg-muted'}>{active ? '●' : '○'}</span>
      {children}
    </button>
  );
}

function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className='flex items-center gap-3'>
      <span className='w-20 shrink-0 text-sm font-bold text-fg'>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className='h-9 min-w-44 rounded-lg border border-border-strong bg-bg px-3 text-sm font-semibold text-fg outline-none transition-[border-color,box-shadow] focus:border-brand focus:shadow-[var(--ring)]'
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
      <span className='w-20 shrink-0 text-sm font-bold text-fg'>{label}</span>
      <div className='no-scrollbar flex gap-1.5 overflow-x-auto whitespace-nowrap'>{children}</div>
    </div>
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
  const [recruitment, setRecruitment] = useState<RecruitmentFilter>('recruiting');
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
    setCategory('all');
    setTimezone('all');
  };

  const filtered = useMemo(() => (recruitment === 'all' ? base : base.filter((s) => statusOf(s) === recruitment)), [base, recruitment]);


  return (
    <div>
      {/*
        층마다 다른 모양을 쓴다 — 상단 사이트 메뉴가 이미 밑줄 탭이라, 여기서도 밑줄을 쓰면
        같은 위계로 읽힌다. 상태는 **세그먼트**, 카테고리는 **테두리 칩**.
      */}
      <div className='mb-6 flex flex-col gap-4'>
        <FilterSelect
          label='모집 상태'
          value={recruitment}
          options={RECRUITMENT_OPTIONS}
          onChange={setRecruitment}
        />
        <FilterRow label='카테고리'>
          {CATEGORY_OPTIONS.map((option) => (
            <FilterOption key={option.value} active={category === option.value} onClick={() => setCategory(option.value)}>{option.label}</FilterOption>
          ))}
        </FilterRow>
        <FilterSelect
          label='시간대'
          value={timezone}
          options={[{ value: 'all' as const, label: '전체' }, ...TIMEZONE_OPTIONS]}
          onChange={setTimezone}
        />
        <div className='relative w-full shrink-0 sm:w-52'>
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
            className='h-11 min-w-0 flex-1 bg-transparent pl-4 pr-2 text-sm outline-none'
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
