'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { type Study, type StudyLifecycleStatus } from '@studyclub/types';
import { Badge, Pagination, Select, cx, type BadgeTone } from '@studyclub/ui';
import { applyFormUrl, publishState, recruitState, toISODate } from '@studyclub/utils';

import {
  CATEGORY_OPTIONS,
  FORM_OPTIONS,
  LIST_PAGE_SIZE,
  PUBLISH_OPTIONS,
  RECRUIT_OPTIONS,
  STATUS_OPTIONS,
  URL_ALLOWED,
  URL_DEFAULTS,
  effectiveSort,
  entryFilters,
  headerSortOf,
  nextSortFor,
  type FormFilter,
  type PublishFilter,
  type RecruitFilter,
  type SortColumn,
  type SortDir,
  type SortOrder,
  type StudyListData,
  type StudyStatusFilter,
} from '@/features/studies/list-filters';
import { rememberStudiesListSearch } from '@/features/studies/list-return';
import { PublishConfirmDialog, type PublishTarget } from '@/features/studies/PublishConfirmDialog';
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
 *
 * 받은 목록이 서버가 자른 한 페이지면(`list.mode === 'server'`) 그대로 그리고, 전체면 여기서 거르고 정렬해 자른다
 * (어느 쪽으로 받을지는 list-filters 의 serverListQuery).
 */

/** 문자열 비교 — 서버 정렬(제목 → 기수 ID)과 같은 결과가 나오도록 로캘을 타지 않는다. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function byTitle(a: Study, b: Study): number {
  return compareText(tx(a.title), tx(b.title)) || a.study_id - b.study_id;
}

/** 마감 시각(ms). 없거나 읽을 수 없으면 맨 끝으로 보낸다. */
function deadlineTime(study: Study): number {
  const raw = study.recruitment?.deadline;
  const at = raw ? Date.parse(raw) : NaN;
  if (!Number.isNaN(at)) return at;
  const date = toISODate(raw);
  const day = date ? Date.parse(date) : NaN;
  return Number.isNaN(day) ? Number.POSITIVE_INFINITY : day;
}

/**
 * 모집 마감순 (spec 3-2 · 4.4 RECRUITMENT). 모집중을 먼저, 마감을 나중에 — 모집 상태는 서버 판정
 * (`recruitStatus` → `recruitment.status`) 그대로 쓴다. 각 묶음은 마감 시각이 빠른 순, 마감이 없으면 끝.
 */
function byRecruitment(a: Study, b: Study): number {
  const ra = a.recruitment?.status === 'open' ? 0 : 1;
  const rb = b.recruitment?.status === 'open' ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const da = deadlineTime(a);
  const db = deadlineTime(b);
  if (da !== db) return da < db ? -1 : 1;
  return byTitle(a, b);
}

/** 이 목록의 기본 순서 — 운영자가 손댈 것부터: 모집중 먼저, 그 안에서 마감이 빠른 순. 마감일 없는 상시 모집은 모집중의 끝. */
function byDefault(a: Study, b: Study): number {
  const ra = recruitState(a) === 'apply' ? 0 : 1;
  const rb = recruitState(b) === 'apply' ? 0 : 1;
  if (ra !== rb) return ra - rb;
  const da = toISODate(a.recruitment?.deadline) ?? '9999-99-99';
  const db = toISODate(b.recruitment?.deadline) ?? '9999-99-99';
  return da.localeCompare(db);
}

const LIFECYCLE_ORDER: StudyLifecycleStatus[] = ['DRAFT', 'OPEN', 'ONGOING', 'ENDED', 'CLOSED'];

const TIMEZONE_LABEL: Record<NonNullable<Study['timezone']>, string> = {
  KST: 'KST',
  PST: 'PST',
  both: '동시 진행(KST·PST)',
};

/** 열마다 무엇으로 줄 세울지 (PRD 9). 값이 없는(undefined) 행은 방향과 관계없이 늘 맨 뒤로 보낸다. */
const SORT_VALUE: Record<SortColumn, (s: Study) => string | number | undefined> = {
  program: (s) => (s.program ? Number(s.program.id) : undefined),
  title: (s) => tx(s.title),
  status: (s) => LIFECYCLE_ORDER.indexOf(lifecycleStatusOf(s)),
  category: (s) => s.category || undefined,
  timezone: (s) => (s.timezone ? TIMEZONE_LABEL[s.timezone] : undefined),
  recruitStart: (s) => toISODate(s.recruitment?.start),
  recruitEnd: (s) => (deadlineTime(s) === Number.POSITIVE_INFINITY ? undefined : deadlineTime(s)),
  recruit: (s) => (recruitState(s) === 'apply' ? 0 : 1),
  crew: (s) => summarize(s).applied,
  startAt: (s) => toISODate(s.date),
  form: (s) => (hasApplicationFormOf(s) ? 1 : 0),
  publish: (s) => (publishState(s) === 'live' ? 1 : 0),
  author: (s) => s.authorNickname || undefined,
};

function byColumn(key: SortColumn, dir: SortDir) {
  return (a: Study, b: Study): number => {
    const va = SORT_VALUE[key](a);
    const vb = SORT_VALUE[key](b);
    if (va === undefined || vb === undefined) return va === vb ? a.study_id - b.study_id : va === undefined ? 1 : -1;
    const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko');
    return (dir === 'asc' ? c : -c) || a.study_id - b.study_id;
  };
}

/** 정렬 값 → 비교 함수. 대시보드 진입 순서(이름순 · 모집 마감순 · 최근 등록순)는 서버 정렬과 같은 결과를 낸다. */
function comparatorOf(sort: SortOrder): (a: Study, b: Study) => number {
  if (sort === 'all') return byDefault;
  if (sort === 'title') return byTitle;
  if (sort === 'recruitment') return byRecruitment;
  if (sort === 'id') return (a, b) => b.study_id - a.study_id;
  const [key, dir] = sort.split(':') as [SortColumn, SortDir];
  return byColumn(key, dir);
}

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

/**
 * 공개 설정 칸 — **공개는 여기서 켠다** (captain-publish-study 1 · 1-1). 누르면 바로 바뀌지 않고 확인 팝업이 먼저 뜬다.
 *
 * - 신청 폼이 없으면 공개하지 못한다 — 공개하는 순간 크루가 신청할 데 없는 스터디를 보게 된다
 * - 서버는 작성 중(DRAFT)만 공개하고, 개설(OPEN)만 비공개로 돌린다. 진행 중·종료된 스터디는 누를 수 없다
 * - 누를 수 없을 때 이유는 말풍선으로 — disabled 버튼에는 마우스 이벤트가 오지 않아 title 이 뜨지 않는다.
 *   그래서 aria-disabled 로 막고(포커스·호버는 받는다) 「스터디 상태」 칸과 같은 말풍선을 띄운다.
 *   커서는 기본 그대로 둔다 — 금지 커서와 말풍선이 함께 뜨면 무엇을 봐야 할지 헷갈린다
 */
function PublishCell({
  live,
  lifecycleStatus,
  hasForm,
  onToggle,
}: {
  live: boolean;
  lifecycleStatus: StudyLifecycleStatus;
  hasForm: boolean;
  onToggle: (next: boolean) => void;
}) {
  const reason = live
    ? lifecycleStatus === 'OPEN'
      ? undefined
      : '진행 중이거나 종료된 스터디는 비공개로 돌릴 수 없습니다.'
    : hasForm
      ? undefined
      : '신청 폼을 먼저 연결하세요.';
  const blocked = reason !== undefined;
  const ref = useRef<HTMLButtonElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number } | null>(null);
  const width = 220;

  function showTip() {
    const rect = ref.current?.getBoundingClientRect();
    if (!blocked || !rect) return;
    const x = Math.min(Math.max(rect.left + rect.width / 2, width / 2 + 8), window.innerWidth - width / 2 - 8);
    setTip({ x, y: rect.bottom + 6 });
  }

  return (
    <span className='inline-flex'>
      <button
        ref={ref}
        type='button'
        onClick={() => !blocked && onToggle(!live)}
        aria-disabled={blocked || undefined}
        aria-describedby={blocked && tip ? 'publish-blocked-tip' : undefined}
        onMouseEnter={showTip}
        onMouseLeave={() => setTip(null)}
        onFocus={showTip}
        onBlur={() => setTip(null)}
        title={blocked ? undefined : live ? '눌러서 비공개로 전환' : '눌러서 공개'}
        className={cx(
          'rounded-pill px-2.5 py-1 type-label-lg outline-none transition-colors focus-visible:shadow-[var(--ring)]',
          live
            ? blocked
              ? 'cursor-default bg-success-50 text-success-700'
              : 'bg-success-50 text-success-700 hover:bg-success-100'
            : blocked
              ? 'cursor-default bg-surface-2 text-fg-placeholder'
              : 'bg-surface-2 text-fg-secondary hover:bg-neutral-200',
        )}
      >
        {live ? '공개' : '미공개'}
      </button>
      {tip && (
        <span
          id='publish-blocked-tip'
          role='tooltip'
          style={{ position: 'fixed', left: tip.x, top: tip.y, width, transform: 'translateX(-50%)' }}
          className='pointer-events-none z-50 whitespace-normal rounded-control bg-neutral-900 px-3 py-2 text-left type-label-sm text-white shadow-lg'
        >
          {reason}
        </span>
      )}
    </span>
  );
}

/**
 * 정렬하는 열 머리 — **이름을 누른다** (PRD 9 · playground SortLabel 과 같다). 처음 누르면 오름차순, 다시 누르면 내림차순.
 * 화살표를 그리지 않는다 — 지금 정렬 중인 열은 이름이 강조색이다.
 */
function SortLabel({ label, active, onClick }: { label: string; active: SortDir | null; onClick: () => void }) {
  return (
    <button
      type='button'
      onClick={onClick}
      aria-label={`${label} ${active === 'asc' ? '내림차순으로' : '오름차순으로'} 정렬`}
      className={cx(
        'whitespace-nowrap rounded-sm text-left underline-offset-4 hover:underline',
        active && 'text-brand',
      )}
    >
      {label}
    </button>
  );
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
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  /** 접근 가능한 이름 — 옵션 글자만으로 무슨 축인지 알 수 없을 때 */
  label?: string;
}) {
  return (
    <Select
      size='sm'
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as T)}
      // 높이는 Select size='sm'(h-8) 그대로. 걸러 낸 축은 브랜드 테두리 · 굵은 글씨로 드러낸다
      className={cx(
        'w-auto',
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg',
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
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

  // 인원을 모르면 0 — 예시 명단으로 메우지 않는다
  return { capacity: study.recruitment?.capacity ?? 0, active: 0, applied: 0, pending: 0 };
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
          className='pointer-events-none z-50 whitespace-normal rounded-control bg-neutral-900 px-3 py-2 text-left type-label-sm text-white shadow-lg'
        >
          <span className='block font-semibold'>{label}</span>
          <span className='block'>{description}</span>
          {nextStep && <span className='mt-1 block text-neutral-300'>{nextStep}</span>}
          {label === '종료' && (
            <span className='mt-1 block border-t border-white/15 pt-1 text-warning-fg-inverse'>
              클럽: 채널을 다음 기수가 그대로 물려받아 지우지 않는다 — 지나간 기수는 여기 영구히 남고, 운영 종료로
              넘어갈 수 있는 건 이 프로그램의 최신 기수뿐이다.
            </span>
          )}
          {label === '운영 종료' && (
            <span className='mt-1 block border-t border-white/15 pt-1 text-warning-fg-inverse'>
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

export function StudiesTable({ list }: { list: StudyListData }) {
  // 조건·페이지는 URL 이 정본이다 — 운영 페이지에 들어갔다 뒤로 와도 걸어 둔 조건이 그대로다.
  // 조건을 바꾸면 페이지는 1로 돌아간다(같은 set 에서 함께 바꾼다).
  const [urlFilters, setUrlFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  /** 공개/비공개 전환 확인 팝업. 값이 있으면 열려 있다. */
  const [confirm, setConfirm] = useState<PublishTarget | null>(null);

  // 대시보드에서 `?view=…` 로 들어왔으면 그 조건으로 바로 그리고(깜빡임 없이), 주소는 이 목록의 필터로 바꿔 쓴다
  const searchParams = useSearchParams();
  // 상세의 「← 스터디 관리」가 이 조건으로 돌아오게 지금 주소의 쿼리를 적어 둔다
  useEffect(() => {
    const search = searchParams.toString();
    rememberStudiesListSearch(search ? `?${search}` : '');
  }, [searchParams]);
  const entry = useMemo(() => entryFilters(searchParams.get('view'), searchParams.get('category')), [searchParams]);
  // 주소만 바꾼다(shallow) — router.replace 면 서버 컴포넌트가 목록 전체를 한 번 더 받는다
  useEffect(() => {
    if (entry) setUrlFilters(entry, { shallow: true });
  }, [entry, setUrlFilters]);
  const filters = entry ? { ...urlFilters, ...entry } : urlFilters;
  // 주소를 옮겨 적기 전에 조건을 바꿔도 진입 조건 위에 얹는다 — 남아 있는 view·카테고리 코드가 고른 값을 덮지 않게
  const setFilters = useCallback(
    (patch: Partial<typeof URL_DEFAULTS>) => setUrlFilters(entry ? { ...entry, ...patch } : patch),
    [entry, setUrlFilters],
  );
  const category = filters.category;
  const studyStatus = filters.status as StudyStatusFilter;
  const recruit = filters.recruit as RecruitFilter;
  const publish = filters.publish as PublishFilter;
  const form = filters.form as FormFilter;
  const sort = effectiveSort(filters.sort as SortOrder, studyStatus);
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

  const studies = list.studies;
  const rows = useMemo(() => {
    // 서버가 이미 거르고 정렬했다 — 다시 거르면 서버와 다른 뜻의 조건(「마감」 등)이 섞인다
    if (list.mode === 'server') return studies;
    const q = query.trim().toLowerCase();
    return studies
      .filter((s) => {
        if (category !== 'all' && s.category !== category) return false;
        if (studyStatus !== 'all' && lifecycleStatusOf(s) !== studyStatus) return false;
        if (recruit !== 'all' && recruitState(s) !== recruit) return false;
        if (publish !== 'all' && publishState(s) !== publish) return false;
        if (form !== 'all' && hasApplicationFormOf(s) !== (form === 'has')) return false;
        if (q) {
          const hay = `${tx(s.title)} ${tx(s.summary)} ${s.category ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort(comparatorOf(sort));
  }, [list.mode, studies, query, category, studyStatus, recruit, publish, form, sort]);
  const headerSort = headerSortOf(sort);
  /** 열 이름을 누른다 — 오름차순, 다시 누르면 내림차순 (PRD 9). 정렬을 바꾸면 1페이지로 */
  const sortBy = (key: SortColumn) => setFilters({ sort: nextSortFor(sort, key), page: '1' });
  const th = (key: SortColumn, label: string, className = 'whitespace-nowrap') => (
    <th
      className={className}
      aria-sort={headerSort?.key === key ? (headerSort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <SortLabel label={label} active={headerSort?.key === key ? headerSort.dir : null} onClick={() => sortBy(key)} />
    </th>
  );

  const total = list.mode === 'server' ? list.total : rows.length;
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  // 서버 페이지는 서버가 실제로 준 위치를 따른다 — 끝을 넘는 주소면 서버가 마지막 페이지를 줬다(lib/api.ts)
  const currentPage = list.mode === 'server' ? Math.floor(list.offset / list.limit) + 1 : Math.min(page, pageCount);
  const pageRows =
    list.mode === 'server' ? rows : rows.slice((currentPage - 1) * LIST_PAGE_SIZE, currentPage * LIST_PAGE_SIZE);

  return (
    // studies-list — 표 칸 너비 · 말줄임 CSS(studies-table.css)의 기준
    <div className='studies-list'>
      {/* 필터는 한 줄에 둔다. 좁으면 줄바꿈하지 않고 옆으로 넘긴다 (프로토 명세 list:4).
          가로 스크롤 상자는 위아래로 넘친 것도 자른다 — 칸 테두리 · 포커스 링(3px)이 잘리지 않게 사방에 여백을 두고
          좌우는 음수 여백으로 상쇄해 줄 위치는 그대로 둔다 */}
      <div className='-mx-1 mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 py-1'>
        <input
          type='search'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='제목 · 한 줄 소개 검색'
          className='h-8 w-[188px] shrink-0 rounded-control border border-border-strong bg-surface px-3 type-body-sm outline-none focus:border-brand'
        />
        <FilterSelect
          value={category}
          onChange={(v) => setFilters({ category: v, page: '1' })}
          options={CATEGORY_OPTIONS}
        />
        <FilterSelect
          value={studyStatus}
          // 모집 마감순은 「개설」에만 뜻이 있다 — 상태를 바꾸면 최근 등록순으로 (spec 4.4)
          onChange={(v) => setFilters({ status: v, sort: effectiveSort(filters.sort as SortOrder, v), page: '1' })}
          options={STATUS_OPTIONS}
        />
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
        <FilterSelect value={form} onChange={(v) => setFilters({ form: v, page: '1' })} options={FORM_OPTIONS} />
        <span className='ml-auto shrink-0 whitespace-nowrap type-label-sm text-fg-muted'>{total}개</span>
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
                {th('program', 'P-ID')}
                {th('title', '스터디', '')}
                {th('status', '스터디 상태')}
                {th('category', '주제')}
                {th('timezone', '시간대')}
                {th('recruitStart', '모집 시작일')}
                {th('recruitEnd', '모집 종료일')}
                {th('recruit', '모집 상태')}
                {th('crew', '지원 현황')}
                {th('startAt', '스터디 시작일')}
                {th('form', '신청 폼')}
                {th('publish', '공개 상태')}
                {th('author', '작성자')}
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
                    <td className='whitespace-nowrap font-mono type-label-sm text-fg-muted'>{s.program?.id ?? '—'}</td>
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
                    <td className='whitespace-nowrap text-fg-secondary'>
                      {s.timezone ? TIMEZONE_LABEL[s.timezone] : <span className='text-fg-muted'>미정</span>}
                    </td>
                    <td className='tnum whitespace-nowrap type-label-sm text-fg-secondary'>
                      {displayDate(s.recruitment?.start)}
                    </td>
                    <td className='tnum whitespace-nowrap type-label-sm text-fg-secondary'>
                      {displayDate(s.recruitment?.deadline)}
                    </td>
                    <td>
                      <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
                        {open ? '모집중' : '마감'}
                      </Badge>
                    </td>
                    <td className='tnum whitespace-nowrap type-label-sm text-fg-secondary'>
                      {/* 「현재/정원」 · 정원이 없으면 「현재 · 제한 없음」 (PRD 1) */}
                      {applied}
                      <span className='text-fg-muted'>{capacity === undefined ? ' · 제한 없음' : `/${capacity}`}</span>
                    </td>
                    <td className='tnum whitespace-nowrap type-label-sm text-fg-secondary'>
                      {toISODate(s.date) ?? '미정'}
                    </td>
                    <td
                      className='whitespace-nowrap text-center type-body-sm'
                      aria-label={hasApplicationFormOf(s) ? '신청 폼 있음' : '신청 폼 없음'}
                    >
                      {hasApplicationFormOf(s) ? '✓' : '—'}
                    </td>
                    <td className='whitespace-nowrap'>
                      <PublishCell
                        live={publish === 'live'}
                        lifecycleStatus={lifecycleStatus}
                        hasForm={hasApplicationFormOf(s)}
                        onToggle={(next) => setConfirm({ studyId: Number(s.id), title: tx(s.title), next })}
                      />
                    </td>
                    <td className='whitespace-nowrap type-label-sm text-fg-secondary'>
                      {s.authorNickname ?? <span className='text-fg-muted'>—</span>}
                    </td>
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={13} className='text-center text-fg-muted'>
                    조건에 맞는 스터디가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* 이전 · 다음 · 번호(많으면 「…」). 한 페이지에 다 들어가면 그리지 않는다 (PRD 8) */}
        <Pagination
          className='border-t border-border px-4 py-3'
          page={currentPage}
          total={pageCount}
          onChange={setPage}
        />
      </div>

      <PublishConfirmDialog target={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
