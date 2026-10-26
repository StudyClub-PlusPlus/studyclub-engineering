import { CATEGORY_DISPLAY, STUDY_CATEGORIES, type Study, type StudyLifecycleStatus } from '@studyclub/mock';

/**
 * 스터디 관리 목록의 필터·정렬·페이지 — 서버 컴포넌트(`app/studies/page.tsx`)와 화면(`StudiesTable`)이 같이 쓴다.
 * 그래서 `'use client'` 파일에 두지 않는다.
 *
 * 목록은 두 가지로 받는다.
 * - **서버 페이지** — 걸린 조건을 모두 `GET /api/admin/studies` Query 로 옮길 수 있을 때. 서버가 거르고 정렬해 20건씩 준다
 *   (specs/dashboard 4.4). 대시보드 「전체 보기」·카테고리 행에서 들어온 목록이 이쪽이다
 * - **전체** — 서버에 없는 조건(검색 · 신청 폼 없는 것만 · 「마감」 · 기본 순서)이 하나라도 걸렸을 때. 전부 받아 화면이 거른다
 */

export const LIST_PAGE_SIZE = 20;

export const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '주제 전체' },
  ...STUDY_CATEGORIES.map((c) => ({ value: c, label: c })),
];

export type StudyStatusFilter = 'all' | StudyLifecycleStatus;
export type KindFilter = 'all' | 'study' | 'club';
export type RecruitFilter = 'all' | 'apply' | 'closed';
export type PublishFilter = 'all' | 'live' | 'draft';

// "전체" 항목에 축 이름을 붙인다 — 필터가 한 줄에 나란히 서면 어떤 축인지 라벨 없이 알아야 한다.
export const STATUS_OPTIONS: { value: StudyStatusFilter; label: string }[] = [
  { value: 'all', label: '상태 전체' },
  { value: 'DRAFT', label: '작성 중' },
  { value: 'OPEN', label: '개설' },
  { value: 'ONGOING', label: '진행 중' },
  { value: 'ENDED', label: '종료' },
  { value: 'CLOSED', label: '운영 종료' },
];

export const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: '종류 전체' },
  { value: 'study', label: '스터디' },
  { value: 'club', label: '클럽' },
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

/**
 * 정렬. `all` 은 이 목록의 기본 순서(모집중 먼저, 마감 빠른 순)다. 나머지는 대시보드 「전체 보기」·카테고리 행이
 * 여는 순서와 같다 (specs/dashboard 4.4 — TITLE_ASC · RECRUITMENT · ID_DESC). 보드에 보인 4건이 이 목록의 첫 4건이어야 한다.
 */
export type SortOrder = 'all' | 'title' | 'recruitment' | 'id';

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'all', label: '기본 순서' },
  { value: 'title', label: '이름순' },
  { value: 'recruitment', label: '모집 마감순' },
  { value: 'id', label: '최근 등록순' },
];

/** 모집 마감순은 「개설」 스터디에만 뜻이 있다 — 다른 상태면 최근 등록순으로 바꾼다 (spec 4.4). */
export function sortOptionsFor(status: StudyStatusFilter) {
  return status === 'OPEN' ? SORT_OPTIONS : SORT_OPTIONS.filter((o) => o.value !== 'recruitment');
}

export function effectiveSort(sort: SortOrder, status: StudyStatusFilter): SortOrder {
  return sort === 'recruitment' && status !== 'OPEN' ? 'id' : sort;
}

/** URL 쿼리 — `?category=…&status=OPEN&recruit=apply&noForm=1&page=2`. 기본값은 싣지 않는다. */
export const URL_DEFAULTS = {
  q: '',
  category: 'all',
  status: 'all',
  kind: 'all',
  recruit: 'all',
  publish: 'all',
  noForm: '',
  sort: 'all',
  view: '',
  page: '1',
};
export const URL_ALLOWED = {
  category: CATEGORY_OPTIONS.map((o) => o.value),
  status: STATUS_OPTIONS.map((o) => o.value),
  kind: KIND_OPTIONS.map((o) => o.value),
  recruit: RECRUIT_OPTIONS.map((o) => o.value),
  publish: PUBLISH_OPTIONS.map((o) => o.value),
  noForm: ['1'],
  sort: SORT_OPTIONS.map((o) => o.value),
};

export type ListFilters = typeof URL_DEFAULTS;

/**
 * 대시보드에서 들어오는 주소 (specs/dashboard 3 · 6 · 4.4). `?view=ongoing&category=AI_ML` 처럼 보기와
 * 카테고리 **코드**를 받는다. 이 목록의 필터·정렬로 바꿔 주소를 다시 쓰고, 나머지 조건(검색·종류·모집·신청 폼)은 비운다.
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
  const reset = { view: '', q: '', kind: 'all', recruit: 'all', noForm: '', page: '1', category };
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
 * - 검색 · 신청 폼 없는 것만 — 서버 Query 가 없다
 * - 모집 「마감」 — 화면은 모집중이 아닌 것 전부(진행 중 · 종료 포함), 서버 `RECRUIT_CLOSED` 는 개설 기수만이라 뜻이 다르다
 * - 기본 순서 — 서버 정렬에 없다
 */
export function serverListQuery(filters: ListFilters): string | null {
  const status = filters.status as StudyStatusFilter;
  const sort = SERVER_SORT[effectiveSort(filters.sort as SortOrder, status)];
  if (filters.q.trim() || filters.noForm === '1' || filters.recruit === 'closed' || !sort) return null;

  const query = new URLSearchParams();
  if (filters.category !== 'all') {
    const code = CATEGORY_CODE[filters.category];
    if (!code) return null;
    query.set('category', code);
  }
  if (status !== 'all') query.set('status', status);
  if (filters.kind !== 'all') query.set('studyKind', filters.kind === 'club' ? 'CLUB' : 'STUDY');
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
