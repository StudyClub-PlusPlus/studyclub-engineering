'use client';

// 문의·오류 신고 — 크루가 「내 문의」에서 보낸 문의 · 개선 의견 · 오류 신고 목록.
// 필터·검색·페이지는 서버가 한다(GET /api/admin/feedbacks). 화면에서 다시 거르지 않는다.
// 필터·검색·페이지는 URL 쿼리가 정본이다 — 새로고침·뒤로 가기(상세에서 돌아올 때)에도 남는다.
import { useRouter } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import { Button, Pagination } from '@studyclub/ui';

import { PageHeader } from '@/components/ui';
import { FeedbacksNotice, FeedbacksSkeleton, FeedbacksTable } from '@/features/feedbacks/components/FeedbacksTable';
import { FilterSelect } from '@/features/feedbacks/components/FilterSelect';
import { COPY, STATUS_OPTIONS, TYPE_OPTIONS } from '@/features/feedbacks/labels';
import { useFeedbacks } from '@/features/feedbacks/queries';
import {
  FEEDBACK_PAGE_SIZE,
  SEARCH_MAX,
  type FeedbackFilter,
  type FeedbackStatus,
  type FeedbackType,
} from '@/features/feedbacks/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/** URL 쿼리 — `?type=BUG&status=NEW&q=출석&page=2`. 기본값(전체·1쪽)은 싣지 않는다. */
const URL_DEFAULTS = { q: '', type: 'ALL', status: 'ALL', page: '1' };
const URL_ALLOWED = {
  type: ['ALL', ...TYPE_OPTIONS.map((o) => o.value)],
  status: ['ALL', ...STATUS_OPTIONS.map((o) => o.value)],
};
/** 검색은 입력을 멈추고 400ms 뒤에 건다 (PRD). */
const SEARCH_DEBOUNCE_MS = 400;

// 필터·페이지를 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다
export default function FeedbacksPage() {
  return (
    <Suspense>
      <FeedbacksList />
    </Suspense>
  );
}

function FeedbacksList() {
  const router = useRouter();
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const page = pageOf(filters.page);

  // 입력칸 글자는 화면 state. 멈추면 앞뒤 공백을 자른 값을 URL 에 — 첫 페이지부터.
  // 입력이 바뀌었을 때만 옮긴다: 「전체 보기」로 URL 을 먼저 비웠을 때 아직 남은 이전 디바운스 값이 되살아나지 않게.
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const lastDebounced = useRef(debounced);
  useEffect(() => {
    if (debounced === lastDebounced.current) return;
    lastDebounced.current = debounced;
    if (debounced !== filters.q) setFilters({ q: debounced, page: '1' });
  }, [debounced, filters.q, setFilters]);

  const filter = useMemo<FeedbackFilter>(
    () => ({
      type: filters.type === 'ALL' ? undefined : (filters.type as FeedbackType),
      status: filters.status === 'ALL' ? undefined : (filters.status as FeedbackStatus),
      q: filters.q || undefined,
      offset: (page - 1) * FEEDBACK_PAGE_SIZE,
      limit: FEEDBACK_PAGE_SIZE,
    }),
    [filters.type, filters.status, filters.q, page],
  );
  const { data, error, isPending, refetch } = useFeedbacks(filter);

  const loading = isPending && !error;
  const filtered = filters.type !== 'ALL' || filters.status !== 'ALL' || filters.q !== '';
  const pageCount = data ? Math.max(1, Math.ceil(data.total / FEEDBACK_PAGE_SIZE)) : 1;

  // 보던 페이지가 사라졌으면(건수가 줄었다 등) 첫 페이지로 돌아간다
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > 1) setFilters({ page: '1' });
  }, [data, page, setFilters]);

  function showAll() {
    setSearch('');
    setFilters({ q: '', type: 'ALL', status: 'ALL', page: '1' });
  }

  return (
    <div>
      <PageHeader title='문의·오류 신고' />

      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='제목·내용 검색'
          aria-label='제목·내용 검색'
          maxLength={SEARCH_MAX}
          className='h-9 w-52 shrink-0 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        <FilterSelect
          label='유형'
          value={filters.type}
          options={TYPE_OPTIONS}
          onChange={(next) => setFilters({ type: next, page: '1' })}
        />
        <FilterSelect
          label='상태'
          value={filters.status}
          options={STATUS_OPTIONS}
          onChange={(next) => setFilters({ status: next, page: '1' })}
        />
        {/* 걸러진 뒤의 전체 건수다 — 보이는 20건이 아니다. 못 읽었을 때는 숨긴다(0건으로 보이지 않게) */}
        <span className='tnum ml-auto shrink-0 pl-2 text-xs text-fg-muted' data-testid='feedback-total'>
          {data && !error && `총 ${data.total.toLocaleString()}건`}
        </span>
      </div>

      {loading ? (
        <FeedbacksSkeleton />
      ) : error ? (
        // 못 읽은 것과 한 건도 없는 것은 다른 일이다 — 읽기 실패를 「0건」으로 보여주지 않는다
        <FeedbacksNotice
          action={
            <Button size='sm' variant='secondary' onClick={() => refetch()}>
              다시 시도
            </Button>
          }
        >
          {COPY.listError}
        </FeedbacksNotice>
      ) : data && data.items.length > 0 ? (
        <FeedbacksTable rows={data.items} onOpen={(id) => router.push(`/feedbacks/${id}`)} />
      ) : (
        <FeedbacksNotice
          action={
            filtered && (
              <Button size='sm' variant='secondary' onClick={showAll}>
                전체 보기
              </Button>
            )
          }
        >
          {filtered ? COPY.listFilteredEmpty : COPY.listEmpty}
        </FeedbacksNotice>
      )}

      {/* 한 페이지에 다 들어가면 번호를 보이지 않는다(Pagination 이 1쪽이면 그리지 않는다) */}
      {data && !error && (
        <Pagination
          page={page}
          total={pageCount}
          onChange={(next) => setFilters({ page: String(next) })}
          className='mt-4'
        />
      )}
    </div>
  );
}
