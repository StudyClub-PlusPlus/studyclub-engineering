import type { ReactNode } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';

/** 조회 실패 문구 — 모든 카드가 같다 (spec 2.4). 실패를 0 이나 빈 상태로 바꾸지 않는다. */
export const LOAD_FAILED = '정보를 불러오지 못했습니다.';

export type QueryState<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

/**
 * 카드가 그릴 상태 하나로 줄인다. **실패가 먼저다** — 다시 읽다 실패하면 받아 둔 값이 남아 있어도
 * 실패로 그린다. 이전 수를 그대로 두면 지금 수로 읽힌다 (spec 2.4).
 */
export function queryState<T>(query: Pick<UseQueryResult<T>, 'data' | 'isError'>): QueryState<T> {
  if (query.isError) return { status: 'error' };
  if (query.data === undefined) return { status: 'loading' };
  return { status: 'ok', data: query.data };
}

/** 차트 카드 틀 — 제목·보조 문구·오른쪽 조작. 본문 높이는 각 카드가 지킨다. */
export function DashboardSection({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className='card px-6 py-5'>
      <div className='flex flex-wrap items-baseline gap-x-2 gap-y-1'>
        <h2 className='text-base font-bold'>{title}</h2>
        {note && <span className='text-xs text-fg-muted'>{note}</span>}
        {action && <div className='ml-auto'>{action}</div>}
      </div>
      <div className='mt-4'>{children}</div>
    </section>
  );
}

/** 카드 안 가운데 안내 — 빈 상태와 실패에 같이 쓴다. 높이를 지켜 화면이 들썩이지 않게 한다. */
export function CardMessage({ children, minHeight = 'min-h-32' }: { children: ReactNode; minHeight?: string }) {
  return <p className={`flex items-center justify-center text-center text-sm text-fg-muted ${minHeight}`}>{children}</p>;
}

/** 로딩 자리 — 카드 크기를 지키는 회색 막대 (spec 2.4 권장). */
export function SkeletonBar({ className = '' }: { className?: string }) {
  return <span aria-hidden='true' className={`block animate-pulse rounded-control bg-surface-2 ${className}`} />;
}
