'use client';

// 공지 관리 — 캡틴이 사이트 전체 공지를 올리고 고치고 내린다 (specs/site-notice/spec.md).
// 검색·정렬·페이지는 서버가 한다(GET /api/admin/notices). 화면에서 다시 거르지 않는다.
// 서버 상태는 features/site-notices/queries.ts, 이 페이지는 검색 입력과 열려 있는 팝업만 들고 있다.
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Button, Pagination } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { PageHeader } from '@/components/ui';
import { TimezoneNote } from '@/features/notifications/components/TimezoneNote';
import { SiteNoticeDialog } from '@/features/site-notices/components/SiteNoticeDialog';
import { SiteNoticesTable } from '@/features/site-notices/components/SiteNoticesTable';
import { useSiteNotices } from '@/features/site-notices/queries';
import {
  SITE_NOTICE_ORDERS,
  SITE_NOTICE_PAGE_SIZE,
  SITE_NOTICE_SORTS,
  type SiteNoticeFilter,
  type SiteNoticeOrder,
  type SiteNoticeSort,
} from '@/features/site-notices/types';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/** URL 쿼리 — `?q=모집&sort=title&order=asc&page=2`. 기본값은 싣지 않는다. 회원 목록과 같은 방식. */
const URL_DEFAULTS = { q: '', sort: 'publishedAt', order: 'desc', page: '1' };
const URL_ALLOWED = { sort: SITE_NOTICE_SORTS, order: SITE_NOTICE_ORDERS };

// 검색·정렬·페이지를 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다
export default function NoticesAdmin() {
  return (
    <Suspense>
      <NoticesAdminContent />
    </Suspense>
  );
}

function NoticesAdminContent() {
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const q = filters.q;
  const sort = filters.sort as SiteNoticeSort;
  const order = filters.order as SiteNoticeOrder;
  const page = pageOf(filters.page);
  const setPage = (next: number) => setFilters({ page: String(next) });

  /** null = 닫힘, 'new' = 등록, 숫자 = 그 공지 편집 */
  const [target, setTarget] = useState<'new' | number | null>(null);

  // 입력칸 글자는 화면 state. 타이핑마다 부르지 않고, 멈추면(300ms) 앞뒤 공백을 자른 값을 URL 에 — 첫 페이지부터
  const [search, setSearch] = useState(q);
  const debounced = useDebouncedValue(search.trim(), 300);
  useEffect(() => {
    if (debounced !== q) setFilters({ q: debounced, page: '1' });
  }, [debounced, q, setFilters]);

  const filter = useMemo<SiteNoticeFilter>(
    () => ({
      q: q || undefined,
      sort,
      order,
      offset: (page - 1) * SITE_NOTICE_PAGE_SIZE,
      limit: SITE_NOTICE_PAGE_SIZE,
    }),
    [q, sort, order, page],
  );

  const { data, error, isPending, isPlaceholderData } = useSiteNotices(filter);

  // 삭제해서 결과가 줄면 지금 페이지가 범위 밖일 수 있다(서버는 빈 items + 실제 total). 에러가 아니므로 마지막 페이지로
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    if (data.items.length === 0 && data.offset >= data.total && page > 1) {
      setFilters({ page: String(Math.max(1, Math.ceil(data.total / data.limit))) });
    }
  }, [data, isPlaceholderData, page, setFilters]);

  let pageCount = 1;
  if (data) pageCount = Math.max(1, Math.ceil(data.total / data.limit));

  let editingId: number | null = null;
  if (typeof target === 'number') editingId = target;

  let table: React.ReactNode = null;
  if (isPending && !error) {
    table = <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>;
  } else if (data) {
    table = (
      <SiteNoticesTable
        rows={data.items}
        sort={sort}
        order={order}
        searching={Boolean(q)}
        onSort={(nextSort, nextOrder) => setFilters({ sort: nextSort, order: nextOrder, page: '1' })}
        onOpen={setTarget}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title='공지 관리'
        action={
          <Button size='sm' leadingIcon={<Plus size={15} />} onClick={() => setTarget('new')}>
            공지 등록
          </Button>
        }
      />

      <div className='mb-3 flex flex-wrap items-center gap-2'>
        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='제목 검색'
          aria-label='제목 검색'
          maxLength={100}
          className='h-9 w-44 shrink-0 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        {/* 검색으로 걸러진 뒤의 수다 — 표 위에 두어야 무엇을 세고 있는지가 분명하다 */}
        <span className='tnum ml-auto text-sm text-fg-muted'>{data && `총 ${data.total}개`}</span>
      </div>

      {error && (
        <div className='mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-danger-fg'>
          {error.message}
        </div>
      )}

      <TimezoneNote />

      {table}

      <Pagination page={page} total={pageCount} onChange={setPage} className='mt-4' />

      <SiteNoticeDialog open={target !== null} noticeId={editingId} onClose={() => setTarget(null)} />
    </div>
  );
}
