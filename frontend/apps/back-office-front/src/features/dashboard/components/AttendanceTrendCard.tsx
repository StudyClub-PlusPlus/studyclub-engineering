'use client';

import { useState } from 'react';

import type { UseQueryResult } from '@tanstack/react-query';

import {
  CardMessage,
  DashboardSection,
  LOAD_FAILED,
  SkeletonBar,
  queryState,
} from '@/features/dashboard/components/DashboardSection';
import { formatCount, formatRate } from '@/features/dashboard/format';
import type { ApiAttendanceTrend, ApiTrendPoint } from '@/features/dashboard/types';

const LINE_COLOR = 'var(--color-primary-600)';

/** 환산 출석수 — 지각이 0.5 라 소수 한 자리가 남는다. 버리지 않는다 (spec 5). */
function formatWeighted(n: number): string {
  return n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

/** 한 주의 밑재료 — 「2026-08-24 주 · 출석률 68% (출석 412.5 / 대상 606)」 (PRD 5). */
export function trendPointText(point: ApiTrendPoint, timeZone: string): string {
  const week = `${point.weekStart} 주${point.isCurrentWeek ? '(이번 주)' : ''}`;
  if (point.rate === null) return `${week} · 출석 대상 없음`;
  return `${week} · 출석률 ${formatRate(point.rate)} (출석 ${formatWeighted(point.weightedAttended)} / 대상 ${formatCount(point.eligibleCount)}) · ${timeZone} 기준`;
}

/**
 * 평균 출석률 추세 (화면 5 · 5-1). 최근 12주, 오래된 주부터.
 * 주별 값과 12주 평균은 서버가 계산해 준다 — 화면은 다시 평균내지 않는다.
 */
export function AttendanceTrendCard({
  query,
}: {
  query: Pick<UseQueryResult<ApiAttendanceTrend>, 'data' | 'isError'>;
}) {
  const state = queryState(query);
  return (
    <DashboardSection title='평균 출석률 추세' note='최근 12주'>
      {state.status === 'loading' && (
        <div className='min-h-44'>
          <SkeletonBar className='h-36 w-full' />
          <span className='sr-only'>불러오는 중</span>
        </div>
      )}
      {state.status === 'error' && <CardMessage minHeight='min-h-44'>{LOAD_FAILED}</CardMessage>}
      {state.status === 'ok' &&
        // 값이 하나도 없을 때만 그 사실을 적는다 — 한 주뿐이어도 그 점은 찍는다 (PRD 5)
        (state.data.points.every((p) => p.rate === null) ? (
          <CardMessage minHeight='min-h-44'>아직 출석 기록이 없습니다.</CardMessage>
        ) : (
          <TrendChart trend={state.data} />
        ))}
    </DashboardSection>
  );
}

function TrendChart({ trend }: { trend: ApiAttendanceTrend }) {
  const [active, setActive] = useState<number | null>(null);
  const { points, averageRate, timeZone } = trend;
  const x = (i: number) => (points.length === 1 ? 50 : (i / (points.length - 1)) * 100);
  const y = (rate: number) => 100 - Math.min(100, Math.max(0, rate));

  // 값이 없는 주(분모 0)에서 선을 끊는다 — 0% 로 이으면 쉬어 간 주가 폭락으로 보인다 (PRD 5)
  const segments: { i: number; rate: number }[][] = [[]];
  points.forEach((p, i) => {
    if (p.rate === null) segments.push([]);
    else segments[segments.length - 1]!.push({ i, rate: p.rate });
  });

  const activePoint = active === null ? undefined : points[active];

  return (
    <div className='min-h-44'>
      {/* 오른쪽에 평균 라벨 자리를 비워 둔다 — 선 위에 겹치면 마지막 주 값을 가린다 */}
      <div className='pr-16'>
        <div className='relative h-36'>
          <svg viewBox='0 0 100 100' preserveAspectRatio='none' className='absolute inset-0 h-full w-full' aria-hidden='true'>
            {[0, 50, 100].map((v) => (
              <line
                key={v}
                x1='0'
                x2='100'
                y1={y(v)}
                y2={y(v)}
                stroke='var(--color-border)'
                strokeWidth='1'
                vectorEffect='non-scaling-stroke'
              />
            ))}
            {averageRate !== null && (
              // 5-1 — 평균에 따로 한 줄을 내주지 않고 기준선으로 견준다
              <line
                x1='0'
                x2='100'
                y1={y(averageRate)}
                y2={y(averageRate)}
                stroke='var(--color-fg-muted)'
                strokeWidth='1'
                strokeDasharray='4 4'
                vectorEffect='non-scaling-stroke'
              />
            )}
            {segments
              .filter((segment) => segment.length > 1)
              .map((segment) => (
                <polyline
                  key={segment[0]!.i}
                  fill='none'
                  stroke={LINE_COLOR}
                  strokeWidth='2'
                  strokeLinejoin='round'
                  vectorEffect='non-scaling-stroke'
                  points={segment.map(({ i, rate }) => `${x(i)},${y(rate)}`).join(' ')}
                />
              ))}
          </svg>

          {/* 점은 SVG 밖에 둔다 — 늘어나는 SVG 안에서는 원이 타원이 되고, 버튼이라야 키보드로 한 주씩 짚을 수 있다 */}
          {points.map((p, i) =>
            p.rate === null ? null : (
              <button
                key={p.weekStart}
                type='button'
                aria-label={trendPointText(p, timeZone)}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive((current) => (current === i ? null : current))}
                onFocus={() => setActive(i)}
                onBlur={() => setActive((current) => (current === i ? null : current))}
                onClick={() => setActive(i)}
                className='absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:shadow-(--ring)'
                style={{ left: `${x(i)}%`, top: `${y(p.rate)}%` }}
              >
                <span
                  className={`block rounded-full ${active === i ? 'h-3 w-3' : 'h-2 w-2'}`}
                  style={{ background: LINE_COLOR }}
                />
              </button>
            ),
          )}

          {averageRate !== null && (
            <span
              className='tnum absolute left-full ml-2 -translate-y-1/2 whitespace-nowrap text-xs font-bold text-fg-muted'
              style={{ top: `${y(averageRate)}%` }}
            >
              평균 {formatRate(averageRate)}
            </span>
          )}
        </div>

        <div className='relative mt-1 h-4 text-xs text-fg-muted'>
          {points.map((p, i) =>
            i % 4 === 0 || i === points.length - 1 ? (
              <span
                key={p.weekStart}
                // 양 끝 라벨은 안쪽으로 붙인다 — 가운데 맞춤이면 카드 여백 밖으로 삐져나간다
                className={`tnum absolute whitespace-nowrap ${
                  i === 0 ? '' : i === points.length - 1 ? '-translate-x-full' : '-translate-x-1/2'
                }`}
                style={{ left: `${x(i)}%` }}
              >
                {p.weekStart.slice(5)}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* 짚은 주의 출석률과 밑재료. 자리를 늘 비워 둬 짚을 때 카드가 들썩이지 않게 한다.
          화면 읽기 프로그램은 점(버튼)의 이름으로 같은 문장을 읽으므로 여기는 숨긴다 */}
      <p className='tnum mt-3 min-h-5 text-xs text-fg-secondary' aria-hidden='true'>
        {activePoint ? trendPointText(activePoint, timeZone) : ''}
      </p>
    </div>
  );
}
