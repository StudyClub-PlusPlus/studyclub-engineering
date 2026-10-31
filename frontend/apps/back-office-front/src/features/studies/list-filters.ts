import { CATEGORY_DISPLAY, STUDY_CATEGORIES, type Study, type StudyLifecycleStatus } from '@studyclub/mock';

/**
 * 스터디 관리 목록의 필터·정렬·페이지 — 서버 컴포넌트(`app/studies/page.tsx`)와 화면(`StudiesTable`)이 같이 쓴다.
 * 그래서 `'use client'` 파일에 두지 않는다.
 *
 * 목록은 두 가지로 받는다.
 * - **서버 페이지** — 걸린 조건을 모두 `GET /api/admin/studies` Query 로 옮길 수 있을 때. 서버가 거르고 정렬해 20건씩 준다
 *   (specs/dashboard 4.4). 대시보드 「전체 보기」·카테고리 행에서 들어온 목록이 이쪽이다
 * - **전체** — 서버에 없는 조건(검색 · 신청 폼 · 「마감」 · 기본 순서 · 열 머리 정렬)이 하나라도 걸렸을 때. 전부 받아 화면이 거른다
 *
 * 필터 · 정렬은 PRD captain-list-all-studies 기준이다 — 검색 · 주제 · 상태 · 모집 · 공개 · 신청 폼(있음 · 없음), 열 이름을 눌러 정렬.
 */

export const LIST_PAGE_SIZE = 20;

export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export type StudyStatusFilter = 'all' | StudyLifecycleStatus;
export type RecruitFilter = 'all' | 'apply' | 'closed';
export type PublishFilter = 'all' | 'live' | 'draft';
export type FormFilter = 'all' | 'has' | 'none';

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
export const STATUS_OPTIONS: { value: StudyStatusFilter; label: string }[] = [
  { value: 'all', label: '상태 전체' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'OPEN', label: '개설' },
  { value: 'ONGOING', label: '진행 중' },
  { value: 'ENDED', label: '종료' },
  { value: 'CLOSED', label: '운영 종료' },
];

export const RECRUIT_OPTIONS: { value: RecruitFilter; label: string }[] = [
  { value: 'all', label: '모집 전체' },
  { value: 'apply', label: '모집중' },
  { value: 'closed', label: '마감' },
];

export const PUBLISH_OPTIONS: { value: PublishFilter; label: string }[] = [
  { value: 'all', label: '공개 전체' },
  { value: 'live', label: '공개' },
  { value: 'draft', label: '미공개' },
];

/** 신청 폼 (PRD 5) — 있음 · 없음. */
export const FORM_OPTIONS: { value: FormFilter; label: string }[] = [
  { value: 'all', label: '신청 폼 전체' },
  { value: 'has', label: '있음' },
  { value: 'none', label: '없음' },
];

/**
 * 정렬 (PRD 9) — 열 이름을 누르면 오름차순, 다시 누르면 내림차순. 한 번에 한 열.
 *
 * - `all` — 기본 순서: 모집중 먼저, 그 안에서 모집 종료일이 가까운 순. 화면에는 「모집 상태」 열 오름차순으로 보인다
 * - `title` · `recruitment` · `id` — 대시보드 「전체 보기」·카테고리 행이 여는 순서 (specs/dashboard 4.4 — TITLE_ASC · RECRUITMENT ·
 *   ID_DESC). 서버가 정렬해 준다. `title` 은 「스터디」 열 오름차순과 같다
 * - `<열>:<asc|desc>` — 그 밖의 열 머리 정렬. 전체를 받아 화면이 정렬한다
 */
export const SORT_COLUMNS = [
  'program',
  'title',
  'status',
  'category',
  'timezone',
  'recruitStart',
  'recruitEnd',
  'recruit',
  'crew',
  'startAt',
  'form',
  'publish',
  'author',
] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';
export type SortOrder = 'all' | 'title' | 'recruitment' | 'id' | `${SortColumn}:${SortDir}`;

const COLUMN_SORTS = SORT_COLUMNS.flatMap((c) => [`${c}:asc`, `${c}:desc`] as const);

/** 정렬 값 → 머리에 강조할 열과 방향. 최근 등록순(`id`)은 열이 없어 강조하지 않는다. */
export function headerSortOf(sort: SortOrder): { key: SortColumn; dir: SortDir } | null {
  if (sort === 'all' || sort === 'recruitment') return { key: 'recruit', dir: 'asc' };
  if (sort === 'title') return { key: 'title', dir: 'asc' };
  if (sort === 'id') return null;
  const [key, dir] = sort.split(':') as [SortColumn, SortDir];
  return { key, dir };
}

/** 열 머리를 눌렀을 때의 정렬 값 — 같은 열이 오름차순이면 내림차순, 아니면 오름차순. 서버가 정렬할 수 있는 값으로 접는다. */
export function nextSortFor(current: SortOrder, key: SortColumn): SortOrder {
  const active = headerSortOf(current);
  const dir: SortDir = active?.key === key && active.dir === 'asc' ? 'desc' : 'asc';
  if (key === 'recruit' && dir === 'asc') return 'all';
  if (key === 'title' && dir === 'asc') return 'title';
  return `${key}:${dir}`;
}

/** 모집 마감순은 「개설」 스터디에만 뜻이 있다 — 다른 상태면 최근 등록순으로 바꾼다 (spec 4.4). */
export function effectiveSort(sort: SortOrder, status: StudyStatusFilter): SortOrder {
  return sort === 'recruitment' && status !== 'OPEN' ? 'id' : sort;
}

/** URL 쿼리 — `?category=…&status=OPEN&recruit=apply&form=none&sort=crew:desc&page=2`. 기본값은 싣지 않는다. */
export const URL_DEFAULTS = {
  q: '',
  category: 'all',
  status: 'all',
  recruit: 'all',
  publish: 'all',
  form: 'all',
  sort: 'all',
  view: '',
  page: '1',
};
export const URL_ALLOWED = {
  category: CATEGORY_OPTIONS.map((o) => o.value),
  status: STATUS_OPTIONS.map((o) => o.value),
  recruit: RECRUIT_OPTIONS.map((o) => o.value),
  publish: PUBLISH_OPTIONS.map((o) => o.value),
  form: FORM_OPTIONS.map((o) => o.value),
  sort: ['all', 'title', 'recruitment', 'id', ...COLUMN_SORTS],
};

export type ListFilters = typeof URL_DEFAULTS;

/**
 * 대시보드에서 들어오는 주소 (specs/dashboard 3 · 6 · 4.4). `?view=ongoing&category=AI_ML` 처럼 보기와
 * 카테고리 **코드**를 받는다. 이 목록의 필터·정렬로 바꿔 주소를 다시 쓰고, 나머지 조건(검색·모집·신청 폼)은 비운다.
 * 모르는 view 면 null, 모르는 카테고리 코드면 카테고리를 걸지 않는다.
 *
 * | view | 필터 · 정렬 |
 * |---|---|
 * | ongoing | 진행 중 · 이름순 (카테고리가 있으면 + 공개) |
 * | recruitment | 개설 · 모집 마감순 |
 * | cumulative | 공개 · 최근 등록순 (카테고리 행에서만) |
 */
export function entryFilters(view: string | null, categoryCode: string | null): Partial<ListFilters> | null {
  if (view !== 'ongoing' && view !== 'recruitment' && view !== 'cumulative') return null;
  const category = (categoryCode && CATEGORY_DISPLAY[categoryCode]) || 'all';
  const reset = { view: '', q: '', recruit: 'all', form: 'all', page: '1', category };
  if (view === 'ongoing') {
    return { ...reset, status: 'ONGOING', publish: category === 'all' ? 'all' : 'live', sort: 'title' };
  }
  if (view === 'recruitment') return { ...reset, status: 'OPEN', publish: 'all', sort: 'recruitment' };
  return { ...reset, status: 'all', publish: 'live', sort: 'id' };
}

/** `page` 값 → 1 이상의 정수. lib/use-url-state 의 pageOf 와 같다 — 그쪽은 클라이언트 파일이라 서버에서 부르지 못한다. */
export function listPageOf(value: string): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * 서버 컴포넌트가 받은 쿼리 → 목록 필터. useUrlState 와 같은 규칙(허용 밖 값은 기본값)으로 읽고,
 * 대시보드 진입 주소(`view`)면 그 조건을 얹는다 — 화면이 주소를 옮겨 적기 전에 받는 첫 목록도 진입 조건대로다.
 */
export function resolveListFilters(params: Record<string, string | string[] | undefined>): ListFilters {
  const first = (key: string) => {
    const raw = params[key];
    return Array.isArray(raw) ? raw[0] : raw;
  };
  const allowed: Record<string, readonly string[] | undefined> = URL_ALLOWED;
  const filters = { ...URL_DEFAULTS };
  for (const key of Object.keys(URL_DEFAULTS) as (keyof ListFilters)[]) {
    const raw = first(key);
    if (raw !== undefined && raw !== '' && (allowed[key]?.includes(raw) ?? true)) filters[key] = raw;
  }
  const entry = entryFilters(first('view') ?? null, first('category') ?? null);
  return entry ? { ...filters, ...entry } : filters;
}

const CATEGORY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CATEGORY_DISPLAY).map(([code, label]) => [label, code]),
);

const SERVER_SORT: Partial<Record<SortOrder, string>> = { title: 'TITLE_ASC', recruitment: 'RECRUITMENT', id: 'ID_DESC' };

/**
 * 목록 필터 → `GET /api/admin/studies` Query (specs/dashboard 4.4). 서버에 없는 조건이 걸려 있으면 null — 전체를 받아 화면이 거른다.
 *
 * - 검색 · 신청 폼 — 서버 Query 가 없다
 * - 모집 「마감」 — 화면은 모집중이 아닌 것 전부(진행 중 · 종료 포함), 서버 `RECRUIT_CLOSED` 는 개설 기수만이라 뜻이 다르다
 * - 기본 순서 · 열 머리 정렬(이름 오름차순 밖) — 서버 정렬에 없다
 */
export function serverListQuery(filters: ListFilters): string | null {
  const status = filters.status as StudyStatusFilter;
  const sort = SERVER_SORT[effectiveSort(filters.sort as SortOrder, status)];
  if (filters.q.trim() || filters.form !== 'all' || filters.recruit === 'closed' || !sort) return null;

  const query = new URLSearchParams();
  if (filters.category !== 'all') {
    const code = CATEGORY_CODE[filters.category];
    if (!code) return null;
    query.set('category', code);
  }
  if (status !== 'all') query.set('status', status);
  if (filters.recruit === 'apply') query.set('recruitStatus', 'RECRUITING');
  if (filters.publish !== 'all') query.set('visibility', filters.publish === 'live' ? 'PUBLIC' : 'PRIVATE');
  query.set('sort', sort);
  query.set('offset', String((listPageOf(filters.page) - 1) * LIST_PAGE_SIZE));
  query.set('limit', String(LIST_PAGE_SIZE));
  return query.toString();
}

/** 서버 컴포넌트가 목록 화면에 넘기는 것 — 서버가 자른 한 페이지, 또는 화면이 거를 전체. */
export type StudyListData =
  | { mode: 'server'; studies: Study[]; total: number; offset: number; limit: number }
  | { mode: 'all'; studies: Study[] };
