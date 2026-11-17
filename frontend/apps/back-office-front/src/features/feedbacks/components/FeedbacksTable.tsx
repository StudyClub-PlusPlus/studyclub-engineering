'use client';

import type { ReactNode } from 'react';

import { TableCard } from '@/components/ui';
import { FeedbackStatusBadge, FeedbackTypeBadge } from '@/features/feedbacks/components/FeedbackBadges';
import { EMPTY_VALUE, formatStamp, personLabel } from '@/features/feedbacks/labels';
import { FEEDBACK_PAGE_SIZE, type ApiAdminFeedback } from '@/features/feedbacks/types';

const COLUMNS = 6;

function FeedbacksHead() {
  return (
    <>
      <colgroup>
        <col className='w-[160px]' />
        <col className='w-[100px]' />
        <col className='min-w-[180px]' />
        <col className='w-[120px]' />
        <col className='w-[100px]' />
        <col className='w-[120px]' />
      </colgroup>
      <thead>
        <tr>
          <th className='whitespace-nowrap'>접수 시각</th>
          <th className='whitespace-nowrap'>유형</th>
          <th>제목</th>
          <th className='whitespace-nowrap'>제출자</th>
          <th className='whitespace-nowrap'>상태</th>
          <th className='whitespace-nowrap'>완료 처리자</th>
        </tr>
      </thead>
    </>
  );
}

/**
 * 문의·오류 신고 목록 표. 정렬·필터·페이지는 서버가 한다 — 받은 순서 그대로 그린다
 * (접수 시각 내림차순 고정, 열 머리로 정렬하지 않는다). 줄 어디를 눌러도 상세로 간다.
 */
export function FeedbacksTable({ rows, onOpen }: { rows: ApiAdminFeedback[]; onOpen: (id: number) => void }) {
  return (
    <TableCard tableClassName='table-fixed'>
      <FeedbacksHead />
      <tbody>
        {rows.map((f) => (
          <tr
            key={f.id}
            tabIndex={0}
            onClick={() => onOpen(f.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onOpen(f.id);
            }}
            className='cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none'
          >
            <td className='tnum whitespace-nowrap text-fg-secondary'>{formatStamp(f.createdAt)}</td>
            <td className='whitespace-nowrap'>
              <FeedbackTypeBadge type={f.type} />
            </td>
            {/* 한 줄로 자르고, 가리키면 전체 제목 */}
            <td className='truncate font-semibold' title={f.title}>
              {f.title}
            </td>
            <td className='truncate whitespace-nowrap text-fg-secondary'>{personLabel(f.submitter)}</td>
            <td className='whitespace-nowrap'>
              <FeedbackStatusBadge status={f.status} />
            </td>
            <td className='truncate whitespace-nowrap text-fg-secondary'>
              {f.doneBy ? personLabel(f.doneBy) : <span className='text-fg-muted'>{EMPTY_VALUE}</span>}
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

/** 읽는 중 — 표 자리에 20줄의 빈 칸. 같은 높이를 지켜 화면이 들썩이지 않게 한다. */
export function FeedbacksSkeleton() {
  return (
    <TableCard tableClassName='table-fixed'>
      <FeedbacksHead />
      <tbody>
        {Array.from({ length: FEEDBACK_PAGE_SIZE }, (_, i) => (
          <tr key={i} data-testid='feedback-skeleton-row'>
            {Array.from({ length: COLUMNS }, (__, c) => (
              <td key={c}>
                <span className='block h-3.5 w-full max-w-[140px] animate-pulse rounded bg-surface-2' />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

/** 표 자리에 서는 안내 한 줄(+ 버튼). 비어도 표 자리의 높이를 지킨다. */
export function FeedbacksNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className='flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center'>
      <p className='text-sm text-fg-secondary'>{children}</p>
      {action}
    </div>
  );
}
