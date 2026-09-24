'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { LIFECYCLE_LABEL, LIFECYCLE_ORDER } from '@console/components/lifecycle';
import { LifecycleBadge } from '@console/components/LifecycleBadge';
import { Pagination } from '@console/components/Pagination';
import { KIND_LABEL, TIMEZONE_LABEL } from '@console/components/StudyForm';
import { tx } from '@console/lib/l10n';
import {
  STUDY_CATEGORIES,
  applyFormUrl,
  attendanceRate,
  categoriesOf,
  getStudyCrew,
  lifecycleState,
  publishState,
  recruitCapacity,
  recruitState,
  toISODate,
  todayISO,
  type LifecycleState,
  type Study,
  type StudyKind,
} from '@studyclub/mock';
import { Badge, Button, Modal } from '@studyclub/ui';
import { Check, ChevronUp, ChevronDown, GripVertical, Minus, RotateCcw } from 'lucide-react';

/**
 * 스터디 관리 목록.
 *
 * **칼럼은 등록 폼에 있는 항목으로만 짠다.** 운영자가 입력할 수 없는 값(연도)은
 * 영원히 비거나 더미로 남으므로 목록에 두지 않는다. 제목·주제·종류·시간대·모집 상태·참여 인원·공개 상태·스터디 시작일·
 * 모집 마감일이 보이고, 여기에 스터디 상태(5단계)가 더해진다. 한 줄 소개·진행 일정(자유 텍스트)은 목록에 두지
 * 않는다 — 진행 일정은 신청 화면에 알리는 문구일 뿐 운영자가 목록에서 훑어볼 값이 아니고, 정렬·필터도 못 건다.
 * 언제 시작하는지가 궁금하면 **스터디 시작일**(`STUDY.START_AT`, 정렬 가능한 날짜)을 본다.
 * 종류(스터디/클럽)는 새 프로그램을 등록할 때 정하고 그 뒤로는 바꾸지 못하는 값이다 — 기수(이 목록의
 * 한 행)가 아니라 프로그램의 속성이지만, 운영자가 목록에서 클럽만 걸러 보는 일이 많아 컬럼·필터로 둔다.
 * 시간대(KST/PST/동시 진행)는 등록 폼에서 운영자가 직접 고르는 값이다 — 값이 없으면 「미정」이다.
 * 모집 상태는 「모집 종료일」과 「모집 정원」에서, 지원 현황의 분모는 「모집 정원」(비우면 제한 없음)에서 나온다.
 * 공개 상태는 등록 폼이 아니라 이 목록에서 켠다 — **모집 시작 일자가 있으면 공개**다.
 *
 * 판정 함수는 사용자 사이트와 공유한다(`@studyclub/mock`) — 콘솔에만 "마감"으로 보이는 사고 방지.
 *
 * 필터는 **사용자 사이트 목록과 같은 모양**이다 — 선택지가 적은 축은 드롭다운이 아니라 세그먼트 탭으로,
 * 눌러 보기 전에 무엇이 걸려 있는지 보이게 한다. 주제는 다중 선택 여부를 정하는 중이라 지금은 그대로 둔다.
 *
 * 컬럼 순서는 운영자가 바꿀 수 있다. **프로그램 ID › 스터디(제목) 두 칸은 맨 앞에 고정**한다 — 행이 어느 스터디인지 잃으면
 * 나머지 칸을 읽을 수 없고, 프로그램이 스터디를 묶는 위계라 그 앞에 온다.
 *
 * 행에 편집·삭제 버튼을 두지 않는다. 스터디 이름을 누르면 **운영 페이지**로 들어가고, 거기서
 * 크루 명단·출석·정보 수정을 모두 한다.
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

type RecruitFilter = 'all' | 'apply' | 'closed';
type PublishFilter = 'all' | 'live' | 'draft';
const PAGE_SIZE = 20;

type StatusFilter = 'all' | LifecycleState;
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '상태 전체' },
  ...LIFECYCLE_ORDER.map((s) => ({ value: s, label: LIFECYCLE_LABEL[s] })),
];

type KindFilter = 'all' | StudyKind;
const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '종류 전체' },
  { value: 'study', label: KIND_LABEL.study },
  { value: 'club', label: KIND_LABEL.club },
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

/**
 * 필터 셀렉트 — 다섯 축이 한 줄에 나란히 서므로 생김새를 하나로 맞춘다.
 * 「전체」 항목에 축 이름을 붙여 라벨 없이도 어떤 축인지 알 수 있게 한다.
 */
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
      className={`h-9 shrink-0 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
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

/** 주제 셀렉트. 다중 선택으로 바뀌면 칩으로 교체한다 (회의 후 결정). */
function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 shrink-0 rounded-control border bg-surface px-3 text-sm outline-none focus:border-brand ${
        value === 'all' ? 'border-border-strong text-fg-secondary' : 'border-brand font-semibold text-fg'
      }`}
    >
      {CATEGORY_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** 목록에 필요한 만큼만 뽑는다 — 어느 스터디를 열어야 하는지 고르기 위한 숫자. */
function summarize(study: Study) {
  const { crew, capacity, attendance } = getStudyCrew(study);
  const active = crew.filter((c) => c.status === 'active');
  const rows = active.map((c) => attendanceRate(attendance[c.id])).filter((r): r is number => r !== undefined);
  return {
    capacity,
    active: active.length,
    rate: rows.length === 0 ? undefined : Math.round(rows.reduce((a, b) => a + b, 0) / rows.length),
  };
}

/** 화면에서 바꾼 공개 상태. TODO(api): 저장 API 를 붙이면 서버 값으로 대체한다. */
type PublishPatch = { published?: boolean; publish_at?: string };

/** 모집 시작일 = 공개한 날. 공개 중이 아니면 없다(별도 「공개 시작일」은 두지 않는다). */
function startedOn(s: Study): string | undefined {
  if (publishState(s) !== 'live') return undefined;
  return toISODate(s.publish_at) ?? toISODate(s.recruitment?.start);
}

type ColumnKey =
  | 'status'
  | 'category'
  | 'kind'
  | 'timezone'
  | 'recruitStart'
  | 'recruitEnd'
  | 'recruit'
  | 'crew'
  | 'startAt'
  | 'rate'
  | 'form'
  | 'publish';

type Row = { s: Study; open: boolean; crewStat: ReturnType<typeof summarize> };

type Column = {
  key: ColumnKey;
  label: string;
  cellClass?: string;
  anno?: string;
  render: (row: Row, ctx: { requestPublish: (s: Study, next: boolean) => void }) => ReactNode;
};

const COLUMNS: Column[] = [
  {
    key: 'status',
    label: '스터디 상태',
    cellClass: 'whitespace-nowrap',
    anno: 'status:2',
    render: ({ s }) => {
      return <LifecycleBadge state={lifecycleState(s)} />;
    },
  },
  {
    key: 'category',
    label: '주제',
    cellClass: 'whitespace-nowrap text-fg-secondary',
    render: ({ s }) => <CategoryCell categories={categoriesOf(s)} />,
  },
  {
    key: 'kind',
    label: '종류',
    cellClass: 'whitespace-nowrap text-fg-secondary',
    anno: 'list:2-2',
    render: ({ s }) => (s.program?.kind ? KIND_LABEL[s.program.kind] : <span className='text-fg-muted'>—</span>),
  },
  {
    key: 'timezone',
    label: '시간대',
    cellClass: 'whitespace-nowrap text-fg-secondary',
    anno: 'list:2-3',
    render: ({ s }) => (s.timezone ? TIMEZONE_LABEL[s.timezone] : <span className='text-fg-muted'>미정</span>),
  },
  {
    key: 'recruitStart',
    label: '모집 시작일',
    cellClass: 'tnum whitespace-nowrap text-xs text-fg-secondary',
    anno: 'list:2',
    render: ({ s }) => startedOn(s) ?? <span className='text-fg-muted'>—</span>,
  },
  {
    key: 'recruitEnd',
    label: '모집 종료일',
    cellClass: 'tnum whitespace-nowrap text-xs text-fg-secondary',
    anno: 'list:2-1',
    render: ({ s }) => toISODate(s.recruitment?.deadline) ?? <span className='text-fg-muted'>—</span>,
  },
  {
    key: 'recruit',
    label: '모집 상태',
    cellClass: 'whitespace-nowrap',
    render: ({ open }) => (
      <Badge tone={open ? 'recruiting' : 'closed'} dot className='px-2.5 py-1 font-semibold'>
        {open ? '모집중' : '마감'}
      </Badge>
    ),
  },
  {
    key: 'crew',
    label: '지원 현황',
    cellClass: 'tnum whitespace-nowrap text-xs text-fg-secondary',
    anno: 'list:1',
    render: ({ s, crewStat }) => (
      <>
        {crewStat.active}
        <span className='text-fg-muted'>{recruitCapacity(s) ? `/${recruitCapacity(s)}` : ' · 제한 없음'}</span>
      </>
    ),
  },
  {
    key: 'startAt',
    label: '스터디 시작일',
    cellClass: 'tnum whitespace-nowrap text-xs text-fg-secondary',
    anno: 'list:3',
    render: ({ s }) => toISODate(s.startAt) ?? <span className='text-fg-muted'>미정</span>,
  },
  {
    key: 'rate',
    label: '출석률',
    cellClass: 'tnum whitespace-nowrap text-xs font-semibold text-fg-secondary',
    render: ({ crewStat }) =>
      crewStat.rate === undefined ? <span className='text-fg-muted'>—</span> : `${crewStat.rate}%`,
  },
  {
    key: 'form',
    label: '신청 폼',
    cellClass: 'whitespace-nowrap text-xs',
    anno: 'publish:2',
    render: ({ s, open }) => <FormCell url={applyFormUrl(s)} recruiting={open} />,
  },
  {
    key: 'publish',
    label: '공개 상태',
    cellClass: 'whitespace-nowrap text-xs',
    anno: 'publish:1',
    render: ({ s }, { requestPublish }) => (
      <PublishCell
        live={publishState(s) === 'live'}
        hasForm={Boolean(applyFormUrl(s))}
        onToggle={(next) => requestPublish(s, next)}
      />
    ),
  },
];

/** 정렬 기준 — 컬럼 머리의 위·아래 화살표로 건다. 고정 두 칸(프로그램·스터디)도 정렬된다. */
type SortKey = ColumnKey | 'program' | 'title';
type SortDir = 'asc' | 'desc';
type SortState = { key: SortKey; dir: SortDir } | null;

/** 칸마다 무엇으로 줄 세울지. 값이 없는(undefined) 행은 방향과 관계없이 늘 맨 뒤로 보낸다. */
const SORT_VALUE: Record<SortKey, (s: Study) => string | number | undefined> = {
  program: (s) => (s.program ? Number(s.program.id) : undefined),
  title: (s) => tx(s.title),
  status: (s) => LIFECYCLE_ORDER.indexOf(lifecycleState(s)),
  category: (s) => categoriesOf(s)[0],
  kind: (s) => s.program?.kind,
  timezone: (s) => s.timezone,
  recruitStart: (s) => startedOn(s),
  recruitEnd: (s) => toISODate(s.recruitment?.deadline),
  recruit: (s) => (recruitState(s) === 'apply' ? 0 : 1),
  crew: (s) => summarize(s).active,
  startAt: (s) => toISODate(s.startAt),
  rate: (s) => summarize(s).rate,
  form: (s) => (applyFormUrl(s) ? 1 : 0),
  publish: (s) => (publishState(s) === 'live' ? 1 : 0),
};

function compareBy(sort: NonNullable<SortState>, a: Study, b: Study): number {
  const va = SORT_VALUE[sort.key](a);
  const vb = SORT_VALUE[sort.key](b);
  if (va === undefined || vb === undefined) return va === vb ? 0 : va === undefined ? 1 : -1;
  const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ko');
  return sort.dir === 'asc' ? c : -c;
}

/**
 * 컬럼 머리의 위·아래 화살표. 누르면 그 방향으로 정렬하고, 이미 눌린 화살표를 다시 누르면 정렬을 푼다
 * (기본 순서 — 모집중 먼저, 마감 임박순 — 로 돌아간다).
 */
function SortArrows({
  label,
  active,
  onChange,
}: {
  label: string;
  active: SortDir | null;
  onChange: (dir: SortDir | null) => void;
}) {
  const arrow = (dir: SortDir, Icon: typeof ChevronUp, name: string) => (
    <button
      type='button'
      aria-label={`${label} ${name} 정렬`}
      aria-pressed={active === dir}
      onClick={() => onChange(active === dir ? null : dir)}
      className={`rounded-sm p-0 leading-none ${active === dir ? 'text-brand' : 'text-fg-placeholder hover:text-fg-secondary'}`}
    >
      <Icon size={11} strokeWidth={2.5} />
    </button>
  );
  return (
    <span data-anno='list:9' className='inline-flex flex-col'>
      {arrow('asc', ChevronUp, '오름차순')}
      {arrow('desc', ChevronDown, '내림차순')}
    </span>
  );
}

const DEFAULT_ORDER: ColumnKey[] = COLUMNS.map((c) => c.key);
const ORDER_STORAGE_KEY = 'studyclub.console.studies.columns';

/** 저장된 순서를 읽는다. 컬럼이 늘거나 줄었어도 깨지지 않게 알려진 키만 남기고 빠진 것은 뒤에 붙인다. */
function loadOrder(): ColumnKey[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? 'null');
    if (!Array.isArray(raw)) return DEFAULT_ORDER;
    const known = raw.filter((k): k is ColumnKey => DEFAULT_ORDER.includes(k));
    return [...known, ...DEFAULT_ORDER.filter((k) => !known.includes(k))];
  } catch {
    return DEFAULT_ORDER;
  }
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function StudiesTable({ studies }: { studies: Study[] }) {
  const [patch, setPatch] = useState<Record<string, PublishPatch>>({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [kind, setKind] = useState<KindFilter>('all');
  const [recruit, setRecruit] = useState<RecruitFilter>('all');
  const [publish, setPublish] = useState<PublishFilter>('all');
  const [noFormOnly, setNoFormOnly] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<ColumnKey[]>(DEFAULT_ORDER);
  const [dragKey, setDragKey] = useState<ColumnKey | null>(null);
  // 가로 스크롤바를 표 위에도 둔다 — 행이 많으면 아래로 내려가야 스크롤바가 보인다.
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [scrollWidth, setScrollWidth] = useState(0);
  /** 공개/미공개 전환 확인 팝업. 값이 있으면 열려 있다. */
  const [confirm, setConfirm] = useState<{ id: string; title: string; next: boolean } | null>(null);

  useEffect(() => {
    const el = bodyScrollRef.current;
    if (!el) return;
    const update = () => setScrollWidth(el.scrollWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, []);

  /** 위·아래 스크롤바를 서로 맞춘다. 한쪽이 움직이면 다른 쪽을 옮기되, 되돌아오는 이벤트는 무시한다. */
  function syncScroll(from: 'top' | 'body') {
    if (syncing.current) {
      syncing.current = false;
      return;
    }
    const src = from === 'top' ? topScrollRef.current : bodyScrollRef.current;
    const dst = from === 'top' ? bodyScrollRef.current : topScrollRef.current;
    if (!src || !dst || dst.scrollLeft === src.scrollLeft) return;
    syncing.current = true;
    dst.scrollLeft = src.scrollLeft;
  }

  // 저장된 순서는 마운트 뒤에 읽는다 — 서버 렌더와 첫 클라이언트 렌더가 같아야 한다.
  useEffect(() => setOrder(loadOrder()), []);

  function changeOrder(next: ColumnKey[]) {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // 저장이 막혀 있어도(시크릿 창 등) 이번 화면에서는 순서가 바뀐다
    }
  }

  // 컬럼을 뺐다 넣었다 하는 동안 localStorage 에 남은 옛 컬럼 키(예: 삭제된 'schedule')가
  // 있어도 죽지 않도록 존재하지 않는 키는 걸러낸다 — order 는 loadOrder() 가 이미 걸러주지만
  // 방어적으로 한 번 더 막는다.
  const columns = order
    .map((k) => COLUMNS.find((c) => c.key === k))
    .filter((c): c is (typeof COLUMNS)[number] => c !== undefined);
  const isDefaultOrder = order.every((k, i) => k === DEFAULT_ORDER[i]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (
      studies
        .map((s) => (patch[s.id] ? { ...s, ...patch[s.id] } : s))
        .filter((s) => {
          if (category !== 'all' && !categoriesOf(s).includes(category)) return false;
          if (status !== 'all' && lifecycleState(s) !== status) return false;
          if (kind !== 'all' && s.program?.kind !== kind) return false;
          if (recruit !== 'all' && recruitState(s) !== recruit) return false;
          if (publish !== 'all' && publishState(s) !== publish) return false;
          if (noFormOnly && applyFormUrl(s)) return false;
          if (q) {
            const hay = `${tx(s.title)} ${categoriesOf(s).join(' ')}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        // 컬럼 화살표로 고른 정렬이 우선이다. 같은 값끼리는 기본 순서를 따른다.
        // 기본: 운영자가 손댈 것부터 위로 — 모집중 먼저, 그 안에서 마감이 임박한 순.
        // 마감일은 필수다 — 값이 비어 있는 옛 데이터만 급할 게 없으므로 모집중 그룹의 끝.
        .sort((a, b) => {
          if (sort) {
            const c = compareBy(sort, a, b);
            if (c !== 0) return c;
          }
          const ra = recruitState(a) === 'apply' ? 0 : 1;
          const rb = recruitState(b) === 'apply' ? 0 : 1;
          if (ra !== rb) return ra - rb;
          const da = toISODate(a.recruitment?.deadline) ?? '9999-99-99';
          const db = toISODate(b.recruitment?.deadline) ?? '9999-99-99';
          return da.localeCompare(db);
        })
    );
  }, [studies, patch, query, category, status, kind, recruit, publish, noFormOnly, sort]);

  // 필터·정렬이 바뀌어 페이지 수가 줄어도 빈 페이지가 남지 않게 현재 페이지를 눌러 준다.
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function applySort(key: SortKey, dir: SortDir | null) {
    setSort(dir ? { key, dir } : null);
    setPage(1);
  }

  function applyPublish() {
    if (!confirm) return;
    // 공개를 켜는 날이 모집 시작 일자다. 내리면 시작 일자가 사라진다(= 미공개).
    // TODO(api): 공개 전환 API — 공개 = 모집 시작 (STATUS DRAFT → OPEN, STUDY_RECRUITMENT.START_AT 채움)
    setPatch((m) => ({
      ...m,
      [confirm.id]: { published: confirm.next, publish_at: confirm.next ? todayISO() : undefined },
    }));
    setConfirm(null);
  }

  return (
    <div>
      {/* 필터는 한 줄에 둔다. 좁으면 줄바꿈하지 않고 옆으로 넘긴다. */}
      <div data-anno='list:4' className='mb-5 flex flex-nowrap items-center gap-2 overflow-x-auto'>
        <input
          type='search'
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder='제목 검색'
          className='h-9 w-44 shrink-0 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <CategorySelect
          value={category}
          onChange={(v) => {
            setCategory(v);
            setPage(1);
          }}
        />
        <span data-anno='status:3' className='shrink-0'>
          <FilterSelect
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </span>
        <FilterSelect
          value={kind}
          onChange={(v) => {
            setKind(v);
            setPage(1);
          }}
          options={KIND_OPTIONS}
        />
        <FilterSelect
          value={recruit}
          onChange={(v) => {
            setRecruit(v);
            setPage(1);
          }}
          options={RECRUIT_OPTIONS}
        />
        <span data-anno='publish:3' className='shrink-0'>
          <FilterSelect
            value={publish}
            onChange={(v) => {
              setPublish(v);
              setPage(1);
            }}
            options={PUBLISH_OPTIONS}
          />
        </span>
        <button
          data-anno='list:5'
          type='button'
          role='switch'
          aria-checked={noFormOnly}
          onClick={() => {
            setNoFormOnly((v) => !v);
            setPage(1);
          }}
          className={`inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-control border px-3 text-sm transition-colors ${
            noFormOnly ? 'border-brand font-semibold text-fg' : 'border-border-strong text-fg-secondary'
          }`}
        >
          <span
            aria-hidden='true'
            className={`relative h-4 w-7 rounded-pill transition-colors ${noFormOnly ? 'bg-brand' : 'bg-neutral-300'}`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${noFormOnly ? 'left-3.5' : 'left-0.5'}`}
            />
          </span>
          신청 폼 없는 것만
        </button>
        <span className='ml-auto shrink-0 pl-2 text-xs text-fg-muted'>{rows.length}개</span>
      </div>

      <div className='mb-2 flex h-6 items-center justify-end'>
        {!isDefaultOrder && (
          <button
            type='button'
            onClick={() => changeOrder(DEFAULT_ORDER)}
            className='inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg'
          >
            <RotateCcw size={12} /> 컬럼 순서 초기화
          </button>
        )}
      </div>

      <div data-anno='list:6' className='card'>
        <div
          ref={topScrollRef}
          onScroll={() => syncScroll('top')}
          aria-hidden='true'
          data-anno='list:7'
          className='overflow-x-auto overflow-y-hidden border-b border-border'
        >
          <div style={{ width: scrollWidth, height: 1 }} />
        </div>
        <div ref={bodyScrollRef} onScroll={() => syncScroll('body')} className='overflow-x-auto'>
          <table className='bo-table'>
            <thead>
              <tr>
                <th data-anno='program:1' className='whitespace-nowrap'>
                  <span className='inline-flex items-center gap-1'>
                    P-ID
                    <span data-anno='program:2'>
                      <SortArrows
                        label='P-ID'
                        active={sort?.key === 'program' ? sort.dir : null}
                        onChange={(d) => applySort('program', d)}
                      />
                    </span>
                  </span>
                </th>
                <th>
                  <span className='inline-flex items-center gap-1'>
                    스터디
                    <SortArrows
                      label='스터디'
                      active={sort?.key === 'title' ? sort.dir : null}
                      onChange={(d) => applySort('title', d)}
                    />
                  </span>
                </th>
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    draggable
                    onDragStart={() => setDragKey(c.key)}
                    onDragEnd={() => setDragKey(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragKey) changeOrder(move(order, order.indexOf(dragKey), i));
                      setDragKey(null);
                    }}
                    className={`group whitespace-nowrap ${dragKey === c.key ? 'opacity-40' : ''}`}
                  >
                    <span className='inline-flex items-center gap-1'>
                      <GripVertical size={12} className='cursor-grab text-fg-placeholder' aria-hidden='true' />
                      {c.label}
                      <SortArrows
                        label={c.label}
                        active={sort?.key === c.key ? sort.dir : null}
                        onChange={(d) => applySort(c.key, d)}
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((s) => {
                const row: Row = { s, open: recruitState(s) === 'apply', crewStat: summarize(s) };
                return (
                  <tr key={s.id}>
                    <td className='max-w-[10rem] truncate text-xs text-fg-secondary'>
                      {s.program?.id ?? <span className='text-fg-muted'>—</span>}
                    </td>
                    <td className='min-w-[24rem] max-w-[32rem]'>
                      <Link
                        href={`/proto/console/studies/${s.id}`}
                        className='block truncate font-semibold underline-offset-4 hover:text-brand hover:underline'
                      >
                        {tx(s.title)}
                      </Link>
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} data-anno={c.anno} className={c.cellClass}>
                        {c.render(row, {
                          requestPublish: (study, next) => setConfirm({ id: study.id, title: tx(study.title), next }),
                        })}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className='text-center text-fg-muted'>
                    조건에 맞는 스터디가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination anno='list:8' page={current} total={pageCount} onChange={setPage} />

      <Modal
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm?.next ? '스터디 공개' : '스터디 비공개'}
        footer={
          <>
            <Button variant='secondary' onClick={() => setConfirm(null)}>
              취소
            </Button>
            <Button onClick={applyPublish}>{confirm?.next ? '공개' : '비공개로 전환'}</Button>
          </>
        }
      >
        <div data-anno='publish:4' className='py-6 text-center'>
          <p className='text-sm font-semibold text-fg'>
            ‘{confirm?.title}’ {confirm?.next ? '스터디를 공개하시겠습니까?' : '스터디를 비공개로 전환하시겠습니까?'}
          </p>
          <p className='mt-1.5 text-sm text-fg-muted'>
            {confirm?.next
              ? '공개하면 오늘이 모집 시작일이 되고, 스터디 상태가 「개설」이 되어 사용자 사이트에 노출됩니다.'
              : '사용자 사이트에서 내려가고 스터디 상태가 「작성 중」으로 돌아갑니다.'}
          </p>
        </div>
      </Modal>
    </div>
  );
}

/**
 * 공개 설정 칸 — **공개는 여기서 켠다.**
 *
 * 등록 폼에는 공개일이 없다. 등록 직후에는 신청 폼도 회차도 없어서, 그 상태로 사이트에 뜨면
 * 크루가 신청할 데 없는 스터디를 보게 된다. 그래서 등록은 늘 미공개로 끝나고, 준비가 된 뒤
 * 이 자리에서 켠다. **누르면 바로 바뀌지 않고 확인 팝업이 먼저 뜬다** — 공개는 모집 시작이라
 * 실수로 눌러도 사이트에 나간다.
 *
 * **예약 공개는 두지 않는다** — 준비가 됐는지는 날짜가 아니라 사람이 판단한다.
 * **신청 폼이 없으면 켤 수 없다** — 공개하는 순간 신청할 데 없는 스터디가 목록에 선다.
 */
function PublishCell({
  live,
  hasForm,
  onToggle,
}: {
  live: boolean;
  hasForm: boolean;
  onToggle: (next: boolean) => void;
}) {
  const blocked = !live && !hasForm;
  return (
    <button
      type='button'
      onClick={() => !blocked && onToggle(!live)}
      disabled={blocked}
      data-anno={blocked ? 'publish:1-1' : undefined}
      title={blocked ? '신청 폼을 먼저 연결하세요.' : live ? '눌러서 내린다' : '눌러서 공개한다'}
      className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
        live
          ? 'bg-success-50 text-success-700 hover:bg-success-100'
          : blocked
            ? 'cursor-not-allowed bg-surface-2 text-fg-placeholder'
            : 'bg-surface-2 text-fg-secondary hover:bg-neutral-200'
      }`}
    >
      {live ? '공개' : '미공개'}
    </button>
  );
}

/**
 * 신청 폼 칸 — 폼이 걸려 있는가.
 *
 * 값을 읽기만 한다. **폼을 붙이는 자리는 스터디 운영 화면의 신청폼 탭**이며, 그 탭은 다른
 * 작업으로 만들어지는 중이다. 여기서 또 입력받게 하면 같은 값을 두 곳에서 고치게 된다.
 *
 * 있고 없고 두 값뿐이라 글자로 쓰지 않는다. 목록에서 훑는 값이라 표시가 짧을수록 빨리 읽힌다.
 * **모집중인데 폼이 없으면** 신청할 데가 없다는 뜻이므로 그 경우만 눈에 띄게 하고,
 * 마감된 스터디의 빈 폼은 조용히 둔다 — 이미 지난 일이라 고칠 것이 없다.
 */
function FormCell({ url, recruiting }: { url?: string; recruiting: boolean }) {
  if (url) {
    return (
      <span title={url}>
        <Check size={15} className='inline text-success-700' aria-label='연결됨' />
      </span>
    );
  }
  return (
    <Minus
      size={15}
      className={`inline ${recruiting ? 'text-warning-700' : 'text-fg-placeholder'}`}
      aria-label={recruiting ? '없음 — 모집중인데 신청 폼이 없다' : '없음'}
    />
  );
}

/** 목록에서 보여줄 주제 수. 셋을 넘기면 제목 칸이 밀려 스터디를 못 읽는다. */
const CATEGORY_PREVIEW = 2;

/**
 * 주제 칸.
 *
 * 주제는 여러 개 붙는다. 전부 늘어놓으면 이 칸이 제목보다 넓어지므로 **두 개까지만** 적고
 * 나머지는 개수로 접는다. 접힌 이름은 마우스를 올리면 볼 수 있다.
 */
function CategoryCell({ categories }: { categories: string[] }) {
  if (categories.length === 0) return <span className='text-fg-muted'>—</span>;
  const shown = categories.slice(0, CATEGORY_PREVIEW);
  const rest = categories.slice(CATEGORY_PREVIEW);
  return (
    <span className='inline-flex items-center gap-1.5' title={categories.join(' · ')}>
      {shown.map((c) => (
        <span key={c} className='rounded-pill bg-surface-2 px-2 py-0.5 text-xs font-medium text-fg-secondary'>
          {c}
        </span>
      ))}
      {rest.length > 0 && <span className='tnum text-xs text-fg-muted'>+{rest.length}</span>}
    </span>
  );
}
