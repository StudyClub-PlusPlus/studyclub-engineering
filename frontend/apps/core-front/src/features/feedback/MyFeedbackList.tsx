'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button, Pagination } from '@studyclub/ui';
import { Plus } from 'lucide-react';

import { LOAD_FAILED_MESSAGE, PAGE_SIZE, formatDay, isOnboardingRequired } from './feedback';
import { FeedbackStatusBadge, FeedbackTypeBadge } from './FeedbackBadges';
import { FeedbackDialog } from './FeedbackDialog';
import { useMyFeedbacks } from './queries';
import { useOnboardedAccount } from './useOnboardedAccount';
import type { Locale } from '@/lib/content';
import { PAGE } from '@/lib/layout';
import { pageOf, useUrlState } from '@/lib/use-url-state';

/**
 * 내 문의 — 푸터 「문의·오류 신고」(`?write=1`, 팝업이 바로 열림)와 직접 주소로 온다.
 * 프로토 proto/core/components/MyFeedback.tsx 의 목록.
 *
 * 본인 것만, 접수 시각 내림차순, 20건씩 — 모두 서버가 정한다. 상태(접수 · 답변 완료)도 서버 값을 그린다.
 * 페이지는 URL(`?page=2`)이 정본이다 — 상세를 열었다 뒤로 와도 같은 페이지다.
 */

// 모듈 상수로 둔다 — 렌더마다 새 객체면 set 이 매번 바뀐다
const URL_DEFAULTS = { page: '1', write: '' };
const URL_ALLOWED = { write: ['1'] };

const COLUMNS = 4;

export function MyFeedbackList() {
  const params = useParams();
  const router = useRouter();
  const locale = ((params?.locale as string) ?? 'ko') as Locale;
  const base = `/${locale}/my/feedbacks`;
  const [query, setQuery] = useUrlState(URL_DEFAULTS, URL_ALLOWED);
  const page = pageOf(query.page);
  const wantsWrite = query.write === '1';
  const accountId = useOnboardedAccount(locale, wantsWrite ? `${base}?write=1` : base);
  const [writing, setWriting] = useState(false);

  const { data, error, isPending, isError, isFetching, refetch } = useMyFeedbacks(accountId, page);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  // 푸터에서 온 사람은 쓰러 온 사람이다 — 목록을 보여 주고 한 번 더 누르게 하지 않는다.
  // 주소에서는 지운다. 새로고침·뒤로 가기에 팝업이 다시 열리지 않게
  useEffect(() => {
    if (accountId === undefined || !wantsWrite) return;
    setWriting(true);
    setQuery({ write: '' });
  }, [accountId, wantsWrite, setQuery]);

  // 세션은 온보딩을 마쳤다는데 서버가 아니라고 하면(다른 기기에서 바뀐 경우 등) 온보딩으로
  useEffect(() => {
    if (isOnboardingRequired(error)) router.replace(`/${locale}/onboarding?next=${encodeURIComponent(base)}`);
  }, [error, locale, base, router]);

  // 주소를 고쳐 범위 밖 페이지로 오면 마지막 페이지로
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && page > pages) setQuery({ page: String(pages) });
  }, [data, page, pages, setQuery]);

  const writeButton = (
    <Button
      size='sm'
      leadingIcon={<Plus size={15} />}
      disabled={accountId === undefined}
      onClick={() => setWriting(true)}
    >
      문의하기
    </Button>
  );

  const loading = accountId === undefined || (isPending && !isError);

  return (
    <div className={`${PAGE} pb-16 pt-10`}>
      <div className='flex items-end justify-between gap-4'>
        <h1 className='text-2xl font-extrabold tracking-tight'>내 문의</h1>
        {writeButton}
      </div>

      <div className='card mt-6 overflow-x-auto p-0'>
        <table className='w-full table-fixed text-sm' aria-busy={loading || undefined}>
          <colgroup>
            <col className='w-[110px]' />
            <col className='min-w-[180px]' />
            <col className='w-[110px]' />
            <col className='w-[110px]' />
          </colgroup>
          <thead className='border-b border-border text-left text-xs font-semibold text-fg-muted'>
            <tr>
              <th className='px-5 py-3'>유형</th>
              <th className='px-5 py-3'>제목</th>
              <th className='px-5 py-3'>접수일</th>
              <th className='px-5 py-3'>상태</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-border'>
            {loading ? (
              Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={COLUMNS} className='px-5 py-4'>
                    <span className='block h-4 animate-pulse rounded bg-surface-2' />
                  </td>
                </tr>
              ))
            ) : isError || !data ? (
              // 실패를 0건으로 보이지 않는다
              <tr>
                <td colSpan={COLUMNS} className='px-5 py-16 text-center text-fg-muted'>
                  <span className='inline-flex flex-col items-center gap-3'>
                    {LOAD_FAILED_MESSAGE}
                    <Button variant='secondary' size='sm' loading={isFetching} onClick={() => void refetch()}>
                      다시 시도
                    </Button>
                  </span>
                </td>
              </tr>
            ) : data.total === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className='px-5 py-16 text-center text-fg-muted'>
                  <span className='inline-flex flex-col items-center gap-3'>
                    접수한 문의가 없습니다.
                    {writeButton}
                  </span>
                </td>
              </tr>
            ) : (
              data.items.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => router.push(`${base}/${f.id}`)}
                  className='cursor-pointer transition-colors hover:bg-surface-2'
                >
                  <td className='px-5 py-4'>
                    <FeedbackTypeBadge type={f.type} />
                  </td>
                  <td className='truncate px-5 py-4 font-semibold' title={f.title}>
                    {/* 줄 어디를 눌러도 상세다. 키보드로도 갈 수 있게 제목은 링크로 둔다 */}
                    <Link
                      href={`${base}/${f.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className='outline-none focus-visible:underline'
                    >
                      {f.title}
                    </Link>
                  </td>
                  <td className='tnum px-5 py-4 text-fg-secondary'>{formatDay(f.createdAt)}</td>
                  <td className='px-5 py-4'>
                    <FeedbackStatusBadge status={f.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Pagination
        className='mt-4'
        page={Math.min(page, pages)}
        total={pages}
        onChange={(p) => setQuery({ page: String(p) })}
      />

      {accountId !== undefined && (
        <FeedbackDialog
          open={writing}
          accountId={accountId}
          onClose={() => setWriting(false)}
          // 서버가 돌려준 건이 첫 페이지 맨 위에 들어갔다(useSubmitFeedback) — 그 페이지로 간다
          onSent={() => setQuery({ page: '1' })}
        />
      )}
    </div>
  );
}
