'use client';

// 유저 — 가입한 회원 목록·이메일 보기·계정 권한 변경.
// 정렬·필터·검색·페이지는 서버가 한다(GET /api/admin/users). 화면에서 다시 거르지 않는다.
// 서버 상태는 features/users/queries.ts, 이 페이지는 탭·검색·페이지 입력과 「보기」로 받은 원본만 들고 있다.
import { Suspense, useEffect, useMemo, useState } from 'react';

import { Pagination, Segmented } from '@studyclub/ui';
import { Info } from 'lucide-react';

import { PageHeader } from '@/components/ui';
import { PermissionMatrixDialog } from '@/features/users/components/PermissionMatrixDialog';
import { UsersTable } from '@/features/users/components/UsersTable';
import { TAB_OPTIONS } from '@/features/users/labels';
import { useUsers } from '@/features/users/queries';
import { USER_PAGE_SIZE, type UserFilter, type UserRole } from '@/features/users/types';
import { useRevealedEmails } from '@/features/users/use-revealed-emails';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/** URL 쿼리 — `?role=CAPTAIN&q=kim&page=2`. 기본값은 싣지 않는다. */
const URL_DEFAULTS = { role: 'ALL', q: '', page: '1' };
const URL_ALLOWED = { role: TAB_OPTIONS.map((o) => o.value) };

// 탭·검색·페이지를 URL 로 든다(useSearchParams) — 정적 프리렌더에는 Suspense 경계가 필요하다
export default function UsersAdmin() {
  return (
    <Suspense>
      <UsersAdminContent />
    </Suspense>
  );
}

function UsersAdminContent() {
  // 탭·검색어·페이지는 URL 이 정본이다 — 새로고침·뒤로 가기에도 남는다. 「보기」로 받은 이메일 원본은 URL 에 두지 않는다
  const [filters, setFilters] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const tab = filters.role as UserRole;
  const q = filters.q;
  const page = pageOf(filters.page);
  const setPage = (next: number) => setFilters({ page: String(next) });
  const [matrixOpen, setMatrixOpen] = useState(false);

  // 입력칸 글자는 화면 state. 타이핑마다 부르지 않고, 멈추면(300ms) 앞뒤 공백을 자른 값을 URL 에 — 첫 페이지부터
  const [search, setSearch] = useState(q);
  const debounced = useDebouncedValue(search.trim(), 300);
  useEffect(() => {
    if (debounced !== q) setFilters({ q: debounced, page: '1' });
  }, [debounced, q, setFilters]);

  const filter = useMemo<UserFilter>(
    () => ({
      role: tab,
      q: q || undefined,
      offset: (page - 1) * USER_PAGE_SIZE,
      limit: USER_PAGE_SIZE,
    }),
    [tab, q, page],
  );

  const { data, error, isPending, isPlaceholderData, dataUpdatedAt } = useUsers(filter);
  const { emails, reveal } = useRevealedEmails(dataUpdatedAt);

  // 권한을 바꾼 뒤 필터 결과가 줄면 지금 페이지가 범위 밖일 수 있다(서버는 빈 items + 실제 total).
  // 에러가 아니므로 total 로 마지막 페이지를 계산해 다시 부른다(결과가 아예 없으면 첫 페이지).
  useEffect(() => {
    if (!data || isPlaceholderData) return;
    if (data.items.length === 0 && data.offset >= data.total && page > 1) {
      // total 이 0 이면 돌아갈 마지막 장이 없다 — 첫 페이지로
      setFilters({ page: String(Math.max(1, Math.ceil(data.total / data.limit))) });
    }
  }, [data, isPlaceholderData, page, setFilters]);

  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title='유저'
        action={
          <button
            type='button'
            onClick={() => setMatrixOpen(true)}
            title='역할별 기본 권한'
            aria-label='역할별 기본 권한'
            className='grid h-8 w-8 place-items-center rounded-full text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg'
          >
            <Info size={17} />
          </button>
        }
      />

      <div className='mb-3 flex flex-wrap items-center gap-3'>
        {/* 탭은 넷뿐이라 접어 둘 이유가 없다 — 펴 두면 지금 무엇으로 걸러져 있는지 한눈에 보인다 */}
        <Segmented
          shape='pill'
          options={TAB_OPTIONS}
          value={tab}
          onChange={(next) => setFilters({ role: next, page: '1' })}
        />
        <input
          type='search'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='이름 · 이메일 검색'
          aria-label='이름 · 이메일 검색'
          maxLength={100}
          className='h-9 w-56 rounded-control border border-border-strong bg-surface px-3 text-sm outline-none focus:border-brand'
        />
        {/* 탭·검색으로 걸러진 뒤의 수다 — 표 위에 두어야 무엇을 세고 있는지가 분명하다 */}
        <span className='tnum ml-auto text-sm text-fg-muted'>{data && `총 ${data.total}명`}</span>
      </div>

      {error && (
        <div className='mb-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-sm text-red-600'>
          {error.message}
        </div>
      )}

      {isPending && !error ? (
        <p className='py-10 text-center text-sm text-fg-muted'>불러오는 중…</p>
      ) : (
        data && <UsersTable rows={data.items} revealed={emails} onReveal={reveal} />
      )}

      <Pagination page={page} total={pageCount} onChange={setPage} className='mt-4' />

      <PermissionMatrixDialog open={matrixOpen} onClose={() => setMatrixOpen(false)} />
    </div>
  );
}
