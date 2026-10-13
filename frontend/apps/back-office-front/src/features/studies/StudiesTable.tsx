'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

import {
  STUDY_CATEGORIES,
  getStudyCrew,
  publishState,
  recruitState,
  toISODate,
  applyFormUrl,
  type Study,
  type StudyLifecycleStatus,
} from '@studyclub/mock';
import { Badge, type BadgeTone } from '@studyclub/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { STATUS_LABEL, tx } from '@/lib/l10n';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { pageOf, useUrlState } from '@/lib/use-url-state';

import './studies-table.css';

/**
 * 스터디 관리 목록. 화면 정본은 playground 「스터디 관리 (운영 콘솔)」 (`proto/console/studies/spec.ts`).
 *
 * 모집 상태(모집중·마감)는 서버가 판정해 내려준 값(`recruitStatus` → `recruitment.status`)을 그린다 —
 * 날짜·인원으로 다시 계산하지 않는다 (docs/backend-development-guide/api/endpoint-convention.md §판정은 서버가 내려준다).
 *
 * 행에 편집·삭제 버튼을 두지 않는다. 스터디 이름을 누르면 **운영 페이지**로 들어가고, 거기서
 * 크루 승인·출석·정보 수정을 모두 한다.
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type StudyStatusFilter = 'all' | StudyLifecycleStatus;
type KindFilter = 'all' | 'study' | 'club';
type RecruitFilter = 'all' | 'apply' | 'closed';
type PublishFilter = 'all' | 'live' | 'draft';

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
const STATUS_OPTIONS: { value: StudyStatusFilter; label: string }[] = [
  { value: 'all', label: '상태 전체' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'OPEN', label: '개설' },
  { value: 'ONGOING', label: '진행 중' },
  { value: 'ENDED', label: '종료' },
  { value: 'CLOSED', label: '운영 종료' },
];

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '종류 전체' },
  { value: 'study', label: '스터디' },
  { value: 'club', label: '클럽' },
];

const RECRUIT_OPTIONS: { value: RecruitFilter; label: string }[] = [
  { value: 'all', label: '모집 전체' },
  { value: 'apply', label: '모집중' },
  { value: 'closed', label: '마감' },
];

const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: 'all', label: '공개 전체' },
  { value: 'live', label: '공개' },
  { value: 'draft', label: '미공개' },
];

/** URL 쿼리 — `?category=…&status=OPEN&recruit=apply&noForm=1&page=2`. 기본값은 싣지 않는다. */
const URL_DEFAULTS = {
  q: '',
  category: 'all',
  status: 'all',
  kind: 'all',
  recruit: 'all',
  publish: 'all',
  noForm: '',
  page: '1',
};
const URL_ALLOWED = {
  category: CATEGORY_OPTIONS.map((o) => o.value),
  status: STATUS_OPTIONS.map((o) => o.value),
  kind: KIND_OPTIONS.map((o) => o.value),
  recruit: RECRUIT_OPTIONS.map((o) => o.value),
  publish: PUBLISH_OPTIONS.map((o) => o.value),
  noForm: ['1'],
};

const STUDY_STATUS_GUIDE = [
  {
    label: '작성 중',
    tone: 'neutral' as const,
    description: '작성 중 · 모집 전. 사이트에 보이지 않는다.',
    nextStep: '캡틴이 공개하며 모집을 시작하면 ‘개설’로 넘어간다.',
  },
  {
    label: '개설',
    tone: 'recruiting' as const,
    description: '개설 · 모집을 시작한 상태다.',
    nextStep: '네비게이터가 첫 미팅을 등록하면 ‘진행 중’으로 넘어간다.',
  },
  {
    label: '진행 중',
    tone: 'inprogress' as const,
    description: '첫 미팅이 등록되어 운영 중인 상태다.',
    nextStep: '네비게이터가 종료 처리하거나 마지막 미팅에서 N주가 지나면 ‘종료’로 넘어간다.',
  },
  {
    label: '종료',
    tone: 'error' as const,
    description: '스터디 활동이 끝난 상태다.',
    nextStep: '캡틴이 채널을 삭제하고 운영 종료 처리하면 ‘운영 종료’로 넘어간다.',
  },
  {
    label: '운영 종료',
    tone: 'closed' as const,
    description: '채널 삭제와 운영 종료 처리가 끝난 상태다.',
    nextStep: '더 이상 다음 단계로 넘어가지 않는다.',
  },
];

const STATUS_DESCRIPTION: Record<string, string> = {
  recruiting: STUDY_STATUS_GUIDE[1].description,
  ongoing: STUDY_STATUS_GUIDE[2].description,
  closed: STUDY_STATUS_GUIDE[3].description,
};

function lifecycleStatusOf(study: Study): StudyLifecycleStatus {
  if (study.lifecycleStatus) return study.lifecycleStatus;
  if (study.status === 'ongoing') return 'ONGOING';
  if (study.status === 'closed') return 'ENDED';
  return 'OPEN';
}

function statusToneOf(status: StudyLifecycleStatus): BadgeTone {
  if (status === 'DRAFT') return 'neutral';
  if (status === 'OPEN') return 'recruiting';
  if (status === 'ONGOING') return 'inprogress';
  if (status === 'ENDED') return 'error';
  return 'closed';
}

function hasApplicationFormOf(study: Study): boolean {
  if (study.hasApplicationForm !== undefined) return study.hasApplicationForm;
  return Boolean(study.applicationForm?.length || applyFormUrl(study));
}

/** 필터 셀렉트 — 세 축이 한 줄에 나란히 서므로 생김새를 하나로 맞춘다. */
function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className={`h-9 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 목록에 필요한 만큼만 뽑는다 — 어느 스터디를 열어야 하는지 고르기 위한 숫자. */
function summarize(study: Study) {
  if (study.applicantCount !== undefined) {
    return {
      capacity: study.recruitment?.capacity ?? study.seats?.total ?? 0,
      active: study.applicantCount,
      applied: study.applicantCount,
      pending: 0,
    };
  }

  if (study.seats) {
    return {
      capacity: study.seats.total,
      active: study.seats.taken,
      applied: study.seats.taken,
      pending: 0,
    };
  }

  const { crew, capacity } = getStudyCrew(study);
  // 승인 대기는 없다(#171) — 신청한 사람이 곧 크루다
  return { capacity, active: crew.length, applied: crew.length, pending: 0 };
}

function StatusTooltip({
  tone,
  label,
  description,
  nextStep,
}: {
  tone: BadgeTone;
  label: string;
  description: string;
  nextStep: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const width = 256;

  function show() {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), window.innerWidth - width / 2 - 8);
    setPos({ x, y: rect.bottom + 6 });
  }

  return (
    <span
      ref={ref}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
      className='inline-flex rounded-pill outline-none focus-visible:shadow-[var(--ring)]'
    >
      <Badge tone={tone} dot className='h-6 font-semibold'>
        {label}
      </Badge>
      {pos && (
        <span
          role='tooltip'
          style={{ position: 'fixed', left: pos.x, top: pos.y, width, transform: 'translateX(-50%)' }}
          className='pointer-events-none z-50 whitespace-normal rounded-control bg-neutral-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg'
        >
          <span className='block font-semibold'>{label}</span>
          <span className='block'>{description}</span>
          {nextStep && <span className='mt-1 block text-neutral-300'>{nextStep}</span>}
          {label === '종료' && (
            <span className='mt-1 block border-t border-white/15 pt-1 text-amber-300'>
              클럽: 채널을 다음 기수가 그대로 물려받아 지우지 않는다 — 지나간 기수는 여기 영구히 남고, 운영 종료로
              넘어갈 수 있는 건 이 프로그램의 최신 기수뿐이다.
            </span>
          )}
          {label === '운영 종료' && (
            <span className='mt-1 block border-t border-white/15 pt-1 text-amber-300'>
              클럽: 이 프로그램의 최신 기수만 여기로 올 수 있다 — 지나간 기수는 채널을 물려주고 「종료」에 머무른다.
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function displayDate(value?: string) {
  return toISODate(value) ?? '—';
}

export function StudiesTable({ studies }: { studies: Study[] }) {
  // 조건·페이지는 URL 이 정본이다 — 운영 페이지에 들어갔다 뒤로 와도 걸어 둔 조건이 그대로다.
  // 조건을 바꾸면 페이지는 1로 돌아간다(같은 set 에서 함께 바꾼다).
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const category = filters.category;
  const studyStatus = filters.status as StudyStatusFilter;
  const kind = filters.kind as KindFilter;
  const recruit = filters.recruit as RecruitFilter;
  const publish = filters.publish as PublishFilter;
  const noFormOnly = filters.noForm === '1';
  const page = pageOf(filters.page);
  const setPage = (next: number) => setFilters({ page: String(next) });
  // 검색 입력칸 글자는 화면 state — 목록은 바로 거르고, 멈추면(300ms) URL 에 쓴다
  const [query, setQuery] = useState(filters.q);
  const debouncedQuery = useDebouncedValue(query, 300);
  useEffect(() => {
    if (debouncedQuery !== filters.q) setFilters({ q: debouncedQuery, page: '1' });
  }, [debouncedQuery, filters.q, setFilters]);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const syncTableScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const syncTopScroll = () => {
    if (topScrollRef.current && tableScrollRef.current) {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      studies
        .filter((s) => {
          if (category !== 'all' && s.category !== category) return false;
          if (studyStatus !== 'all' && lifecycleStatusOf(s) !== studyStatus) return false;
          if (kind !== 'all' && (s.kind ?? 'study') !== kind) return false;
          if (recruit !== 'all' && recruitState(s) !== recruit) return false;
          if (publish !== 'all' && publishState(s) !== publish) return false;
          if (noFormOnly && hasApplicationFormOf(s)) return false;
          if (q) {
            const hay = `${tx(s.title)} ${tx(s.summary)} ${s.category ?? ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        // 운영자가 손댈 것부터 위로: 모집중 먼저, 그 안에서 마감이 임박한 순.
        // 마감일 없는 상시 모집은 급할 게 없으므로 모집중 그룹의 끝.
        .sort((a, b) => {
          const ra = recruitState(a) === 'apply' ? 0 : 1;
          const rb = recruitState(b) === 'apply' ? 0 : 1;
          if (ra !== rb) return ra - rb;
          const da = toISODate(a.recruitment?.deadline) ?? '9999-99-99';
          const db = toISODate(b.recruitment?.deadline) ?? '9999-99-99';
          return da.localeCompare(db);
        })
    );
  }, [studies, query, category, studyStatus, kind, recruit, publish, noFormOnly]);

  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div>
      <div className='studies-status-guide mb-[14px] flex flex-wrap items-center gap-2 text-sm'>
        <span className='mr-1 font-semibold text-fg-secondary'>스터디 상태</span>
        {STUDY_STATUS_GUIDE.map((status, index) => (
          <span key={status.label} className='inline-flex items-center gap-2'>
            <StatusTooltip
              tone={status.tone}
              label={status.label}
              description={status.description}
              nextStep={status.nextStep}
            />
            {index < STUDY_STATUS_GUIDE.length - 1 && (
              <ChevronRight size={16} className='text-fg-muted' aria-hidden='true' />
            )}
          </span>
        ))}
        <span className='text-xs text-fg-muted'>
          모집중/마감은 상태가 아니라 모집 시작일·종료일과 정원으로 계산합니다
        </span>
      </div>
      <div className='mb-5 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제목 · 한 줄 소개 검색'
          className='h-9 w-[188px] rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect
          value={category}
          onChange={(v) => setFilters({ category: v, page: '1' })}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          value={studyStatus}
          onChange={(v) => setFilters({ status: v, page: '1' })}
          options={STATUS_OPTIONS}
        />
        <FilterSelect value={kind} onChange={(v) => setFilters({ kind: v, page: '1' })} options={KIND_OPTIONS} />
        <FilterSelect
          value={recruit}
          onChange={(v) => setFilters({ recruit: v, page: '1' })}
          options={RECRUIT_OPTIONS}
        />
        <FilterSelect
          value={publish}
          onChange={(v) => setFilters({ publish: v, page: '1' })}
          options={PUBLISH_OPTIONS}
        />
        <label className='inline-flex h-9 cursor-pointer items-center gap-2 rounded-control border border-border-strong bg-surface px-3 text-sm text-fg-secondary'>
          <input
            type='checkbox'
            checked={noFormOnly}
            onChange={(e) => setFilters({ noForm: e.target.checked ? '1' : '', page: '1' })}
            className='peer sr-only'
          />
          <span
            className={`relative h-5 w-9 rounded-full transition-colors duration-300 ease-in-out ${
              noFormOnly ? 'bg-brand' : 'bg-surface-3'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                noFormOnly ? 'translate-x-4 shadow' : ''
              }`}
            />
          </span>
          신청 폼 없는 것만
        </label>
        <span className='ml-auto text-xs text-fg-muted'>{rows.length}개</span>
      </div>

      <div className='card'>
        <div
          ref={topScrollRef}
          className='overflow-x-auto border-b border-border'
          onScroll={syncTableScroll}
          aria-label='테이블 가로 스크롤'
        >
          <div className='h-3 min-w-[1500px]' />
        </div>
        <div
          ref={tableScrollRef}
          className='overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          onScroll={syncTopScroll}
        >
          <table className='bo-table min-w-[1500px]'>
            <thead>
              <tr>
                <th className='whitespace-nowrap'>P-ID</th>
                <th>스터디명</th>
                <th className='whitespace-nowrap'>스터디 상태</th>
                <th className='whitespace-nowrap'>주제</th>
                <th className='whitespace-nowrap'>종류</th>
                <th className='whitespace-nowrap'>시간대</th>
                <th className='whitespace-nowrap'>모집 시작일</th>
                <th className='whitespace-nowrap'>모집 종료일</th>
                <th className='whitespace-nowrap'>모집 상태</th>
                <th className='whitespace-nowrap'>지원 현황</th>
                <th className='whitespace-nowrap'>스터디 시작일</th>
                <th className='whitespace-nowrap'>신청 폼</th>
                <th className='whitespace-nowrap'>스터디 공개</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const open = recruitState(s) === 'apply';
                const publish = publishState(s);
                const crewStat = summarize(s);
                const capacity = s.recruitment?.capacity ?? s.seats?.total;
                const applied = crewStat.applied;
                const lifecycleStatus = lifecycleStatusOf(s);
                return (
                  <tr key={s.id}>
                    <td className='whitespace-nowrap font-mono text-xs text-fg-muted'>{s.program?.id ?? '—'}</td>
                    <td className='w-[42%] max-w-0'>
                      <Link
                        href={`/studies/${s.id}`}
                        className='block truncate font-semibold underline-offset-4 hover:text-brand hover:underline'
                      >
                        {tx(s.title)}
                      </Link>
                    </td>
                    <td className='whitespace-nowrap'>
                      <StatusTooltip
                        tone={statusToneOf(lifecycleStatus)}
                        label={STATUS_LABEL[lifecycleStatus] ?? lifecycleStatus}
                        description={
                          STUDY_STATUS_GUIDE.find((guide) => guide.label === STATUS_LABEL[lifecycleStatus])
                            ?.description ??
                          STATUS_DESCRIPTION[s.status] ??
                          ''
                        }
                        nextStep={
                          STUDY_STATUS_GUIDE.find((guide) => guide.label === STATUS_LABEL[lifecycleStatus])?.nextStep ??
                          ''
                        }
                      />
                    </td>
                    <td className='whitespace-nowrap'>
                      <Badge tone='neutral'>{s.category ?? '—'}</Badge>
                    </td>
                    <td className='whitespace-nowrap text-fg-secondary'>{s.kind === 'club' ? '클럽' : '스터디'}</td>
                    <td className='whitespace-nowrap text-fg-secondary'>{s.schedule?.ko ?? '미정'}</td>
                    <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                      {displayDate(s.recruitment?.start)}
                    </td>
                    <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                      {displayDate(s.recruitment?.deadline)}
                    </td>
                    <td>
                      <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                        {open ? '모집중' : '마감'}
                      </Badge>
                    </td>
                    <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>
                      {applied} / {capacity === undefined ? '제한 없음' : capacity}
                    </td>
                    <td className='tnum whitespace-nowrap text-xs text-fg-secondary'>{toISODate(s.date) ?? '미정'}</td>
                    <td
                      className='whitespace-nowrap text-center text-sm'
                      aria-label={hasApplicationFormOf(s) ? '신청 폼 있음' : '신청 폼 없음'}
                    >
                      {hasApplicationFormOf(s) ? '✓' : '—'}
                    </td>
                    <td className='whitespace-nowrap'>
                      <Badge tone='neutral'>{publish === 'live' ? '공개' : '미공개'}</Badge>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={13} className='text-center text-fg-muted'>
                    조건에 맞는 스터디가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pageCount > 1 && (
          <div className='flex items-center justify-center gap-1.5 border-t border-border px-4 py-3'>
            <button
              type='button'
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              aria-label='이전 페이지'
              className='inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'
            >
              <ChevronLeft size={16} aria-hidden='true' />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type='button'
                onClick={() => setPage(pageNumber)}
                aria-label={pageNumber + '페이지'}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
                className={
                  currentPage === pageNumber
                    ? 'inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white'
                    : 'inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-fg-secondary hover:bg-surface-2'
                }
              >
                {pageNumber}
              </button>
            ))}
            <button
              type='button'
              onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount}
              aria-label='다음 페이지'
              className='inline-flex h-8 w-8 items-center justify-center rounded-full text-fg-secondary hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'
            >
              <ChevronRight size={16} aria-hidden='true' />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
