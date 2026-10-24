'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Segmented } from '@studyclub/ui';
import type { UseQueryResult } from '@tanstack/react-query';

import {
  CardMessage,
  DashboardSection,
  LOAD_FAILED,
  SkeletonBar,
  queryState,
} from '@/features/dashboard/components/DashboardSection';
import { categoryLabel, formatCount } from '@/features/dashboard/format';
import type { ApiStudiesByCategory, CategoryScope } from '@/features/dashboard/types';

const SCOPE_OPTIONS: { value: CategoryScope; label: string }[] = [
  { value: 'ongoing', label: '진행중' },
  { value: 'cumulative', label: '누적' },
];

/** 고른 범위의 행 — 0개는 숨기고, 많은 순·같으면 코드 순 (spec 6). */
export function categoryRows(data: ApiStudiesByCategory, scope: CategoryScope) {
  return data.categories
    .map((c) => ({ code: c.code, count: scope === 'ongoing' ? c.ongoingCount : c.totalCount }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
}

/**
 * 카테고리별 스터디 수 (화면 6 · 6-1). 개수만 보여준다 — 출석률은 추세 카드 소관이다.
 * 범위는 저장하지 않는다 — 새로고침하면 「진행중」으로 돌아간다(그래서 URL 이 아니라 화면 state 다).
 * 두 범위를 한 번에 받아 두었으므로 범위를 바꿔도 다시 부르지 않는다.
 */
export function CategoryCountsCard({
  query,
}: {
  query: Pick<UseQueryResult<ApiStudiesByCategory>, 'data' | 'isError'>;
}) {
  const [scope, setScope] = useState<CategoryScope>('ongoing');
  const state = queryState(query);

  return (
    <DashboardSection
      title='카테고리별 스터디 수'
      action={<Segmented size='sm' shape='pill' options={SCOPE_OPTIONS} value={scope} onChange={setScope} />}
    >
      {state.status === 'loading' && (
        <div className='flex min-h-32 flex-col gap-3'>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonBar key={i} className='h-5 w-full' />
          ))}
          <span className='sr-only'>불러오는 중</span>
        </div>
      )}
      {state.status === 'error' && <CardMessage>{LOAD_FAILED}</CardMessage>}
      {state.status === 'ok' && <CategoryBars data={state.data} scope={scope} />}
    </DashboardSection>
  );
}

function CategoryBars({ data, scope }: { data: ApiStudiesByCategory; scope: CategoryScope }) {
  const rows = categoryRows(data, scope);
  if (rows.length === 0) return <CardMessage>해당하는 스터디가 없습니다.</CardMessage>;

  // 크기 비교는 이 범위에서 가장 많은 분야를 기준으로 한다 (PRD 6)
  const most = Math.max(...rows.map((r) => r.count));
  const scopeName = scope === 'ongoing' ? '진행중' : '누적';

  return (
    <ul className='flex flex-col gap-1'>
      {rows.map((row) => {
        const label = categoryLabel(row.code);
        return (
          <li key={row.code}>
            {/* 행 전체가 링크다. 목록에는 표시 이름이 아니라 코드로 넘긴다 (PRD 6) */}
            <Link
              href={`/studies?view=${scope}&category=${encodeURIComponent(row.code)}`}
              aria-label={`${label} ${scopeName} 스터디 ${formatCount(row.count)}개 — 목록 보기`}
              className='flex items-center gap-3 rounded-control px-1 py-1.5 transition-colors hover:bg-surface-2'
            >
              <span className='w-28 shrink-0 truncate text-sm font-medium text-fg-secondary' title={label}>
                {label}
              </span>
              <span className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
                <span
                  className='block h-full rounded-pill'
                  style={{ width: `${(row.count / most) * 100}%`, background: 'var(--color-primary-600)' }}
                />
              </span>
              <span className='tnum w-12 shrink-0 text-right text-sm font-bold text-fg'>{formatCount(row.count)}개</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
