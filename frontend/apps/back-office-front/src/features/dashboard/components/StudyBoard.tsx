'use client';

import Link from 'next/link';

import type { UseQueryResult } from '@tanstack/react-query';

import { LOAD_FAILED, SkeletonBar, queryState } from '@/features/dashboard/components/DashboardSection';
import { deadlineLabel, formatCount, type DeadlineTone } from '@/features/dashboard/format';
import { BOARD_PREVIEW } from '@/features/dashboard/queries';
import type { ApiStudyBoard, ApiStudyBoardItem } from '@/features/dashboard/types';

type BoardQuery = Pick<UseQueryResult<ApiStudyBoard>, 'data' | 'isError'>;

/**
 * 현황 보드 (화면 3). 진행중·모집중을 **탭 없이 함께** 둔다 — 고르게 하면 고르지 않은 쪽의 일은 없는 일이 된다.
 * 칸마다 따로 부르므로 한 칸이 실패해도 다른 칸은 그린다.
 *
 * 예정 행사(PRD 3-3)는 아직 행사 API 가 없어 두지 않는다 (spec 1).
 */
export function StudyBoard({ ongoing, recruitment }: { ongoing: BoardQuery; recruitment: BoardQuery }) {
  return (
    <section className='card mt-6 grid grid-cols-1 overflow-hidden lg:grid-cols-2'>
      <BoardColumn
        title='진행중 스터디'
        query={ongoing}
        listHref='/studies?view=ongoing'
        empty='진행중 스터디가 없습니다.'
        className='border-b border-border lg:border-b-0 lg:border-r'
      />
      <BoardColumn
        title='모집중 스터디'
        query={recruitment}
        listHref='/studies?view=recruitment'
        empty='모집중 스터디가 없습니다.'
        withDeadline
      />
    </section>
  );
}

const DEADLINE_TONE: Record<DeadlineTone, string> = {
  normal: 'text-fg-secondary',
  muted: 'text-fg-muted',
  // 이미 닫힌 것(마감 경과·정원 마감)만 눈에 띄게 — 이미 벌어진 일이다 (PRD 3-2)
  closed: 'text-danger-fg',
};

function BoardColumn({
  title,
  query,
  listHref,
  empty,
  withDeadline = false,
  className = '',
}: {
  title: string;
  query: BoardQuery;
  /** 전체 보기 — 같은 대상·정렬의 목록 첫 페이지 (spec 3). 「외 N개」도 같은 곳으로 간다 */
  listHref: string;
  empty: string;
  withDeadline?: boolean;
  className?: string;
}) {
  const state = queryState(query);

  return (
    // 위아래 여백 32 + 제목 24 + 간격 8 + 행 44×5(4 + 「외 N개」) = 284px 를 늘 지킨다 — 건수가 들고 날 때 아래 차트가 밀리지 않게
    <div className={`flex min-h-71 flex-col px-5 py-4 ${className}`}>
      <div className='flex h-6 items-baseline gap-2'>
        <h2 className='type-title-md'>{title}</h2>
        {state.status === 'ok' && (
          <span className='tnum type-label-lg text-fg-secondary'>{formatCount(state.data.total)}</span>
        )}
        <Link href={listHref} className='ml-auto type-label-sm text-brand'>
          전체 보기
        </Link>
      </div>

      {state.status === 'loading' && (
        <>
          <ul className='mt-2' aria-hidden='true'>
            {Array.from({ length: BOARD_PREVIEW }, (_, i) => (
              <li key={i} className='flex h-11 items-center px-1'>
                <SkeletonBar className='h-4 w-2/3' />
              </li>
            ))}
          </ul>
          <span className='sr-only'>불러오는 중</span>
        </>
      )}
      {state.status === 'error' && (
        <p className='flex flex-1 items-center justify-center type-body-sm text-fg-muted'>{LOAD_FAILED}</p>
      )}
      {state.status === 'ok' && state.data.items.length === 0 && (
        <p className='flex flex-1 items-center justify-center type-body-sm text-fg-muted'>{empty}</p>
      )}
      {state.status === 'ok' && state.data.items.length > 0 && (
        <BoardRows board={state.data} listHref={listHref} withDeadline={withDeadline} />
      )}
    </div>
  );
}

function BoardRows({
  board,
  listHref,
  withDeadline,
}: {
  board: ApiStudyBoard;
  listHref: string;
  withDeadline: boolean;
}) {
  const rest = board.total - board.items.length;
  return (
    <ul className='mt-2'>
      {board.items.map((item) => (
        <li key={item.studyId}>
          <Link
            href={`/studies/${item.studyId}`}
            title={item.title}
            className='flex h-11 items-center gap-3 rounded-control px-1 transition-colors hover:bg-surface-2'
          >
            {/* 이름만 둔다 — 출석률·회차를 적으면 그 수를 설명할 자리가 없다 (PRD 3-1) */}
            <span className='min-w-0 flex-1 truncate type-label-lg'>{item.title}</span>
            {withDeadline && <DeadlineCell item={item} asOf={board.asOf} timeZone={board.timeZone} />}
          </Link>
        </li>
      ))}
      {rest > 0 && (
        <li>
          <Link
            href={listHref}
            className='flex h-11 items-center justify-center type-label-sm text-fg-muted hover:text-fg-secondary'
          >
            외 {formatCount(rest)}개 스터디
          </Link>
        </li>
      )}
    </ul>
  );
}

/** 마감 칸 — 문구는 서버의 표시 코드로 고르고, 날짜·D-N 은 응답의 시간대로 적는다. */
function DeadlineCell({ item, asOf, timeZone }: { item: ApiStudyBoardItem; asOf: string; timeZone: string }) {
  const { text, tone } = deadlineLabel(item, asOf, timeZone);
  return (
    <span className={`tnum shrink-0 whitespace-nowrap text-right type-label-lg ${DEADLINE_TONE[tone]}`}>
      {text}
    </span>
  );
}
