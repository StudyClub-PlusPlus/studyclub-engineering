'use client';

import type { UseQueryResult } from '@tanstack/react-query';

import {
  CardMessage,
  DashboardSection,
  LOAD_FAILED,
  SkeletonBar,
  queryState,
} from '@/features/dashboard/components/DashboardSection';
import { TIME_ZONE_GROUP_LABEL, formatCount } from '@/features/dashboard/format';
import type { ApiCrewTimezones, CrewTimeZoneGroupCode } from '@/features/dashboard/types';

const GROUP_COLOR: Record<CrewTimeZoneGroupCode, string> = {
  KST: 'var(--color-primary-600)',
  ET: 'var(--color-info-500)',
  PT: 'var(--color-primary-300)',
  UNKNOWN: 'var(--color-neutral-300)',
};

/**
 * 크루 지역 분포 (화면 4). 활성 크루를 각자 **회원 설정 시간대**로 나눈다 — 보는 사람의 시간대와 상관없다.
 * 범례 순서는 KST → ET → PT → 미분류. 미분류가 0명이면 조각·범례를 숨긴다.
 * 비율은 그룹마다 따로 반올림한다 — 합이 100% 가 아니어도 맞추지 않는다 (spec 4).
 */
export function CrewRegionCard({ query }: { query: Pick<UseQueryResult<ApiCrewTimezones>, 'data' | 'isError'> }) {
  const state = queryState(query);
  return (
    <DashboardSection title='크루 지역 분포' note='회원 설정 시간대 기준'>
      {state.status === 'loading' && (
        <div className='flex min-h-32 items-center gap-4'>
          <SkeletonBar className='h-28 w-28 rounded-full' />
          <span className='sr-only'>불러오는 중</span>
        </div>
      )}
      {state.status === 'error' && <CardMessage>{LOAD_FAILED}</CardMessage>}
      {state.status === 'ok' &&
        (state.data.totalCrew === 0 ? (
          <CardMessage>활성 크루가 없습니다.</CardMessage>
        ) : (
          <RegionDonut data={state.data} />
        ))}
    </DashboardSection>
  );
}

function RegionDonut({ data }: { data: ApiCrewTimezones }) {
  const groups = data.timeZoneGroups.filter((g) => g.code !== 'UNKNOWN' || g.count > 0);
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className='flex min-h-32 flex-wrap items-center gap-4'>
      {/* 수치는 범례가 글자로 말한다 — 도넛은 모양만 */}
      <svg viewBox='0 0 140 140' className='h-28 w-28 shrink-0 -rotate-90' aria-hidden='true'>
        <circle cx='70' cy='70' r={R} fill='none' stroke='var(--color-surface-2)' strokeWidth='20' />
        {groups.map((g) => {
          const length = (g.count / data.totalCrew) * C;
          const slice = (
            <circle
              key={g.code}
              cx='70'
              cy='70'
              r={R}
              fill='none'
              stroke={GROUP_COLOR[g.code]}
              strokeWidth='20'
              strokeDasharray={`${length} ${C - length}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return slice;
        })}
      </svg>

      {/* 좁으면 범례를 도넛 아래로 내린다 — 지역 이름·비율·인원 한 줄을 자르지 않는다 */}
      <ul className='flex min-w-48 flex-1 flex-col gap-2.5'>
        {groups.map((g) => {
          const label = TIME_ZONE_GROUP_LABEL[g.code] ?? { region: g.code };
          return (
            <li key={g.code} className='flex items-center gap-2.5'>
              <span
                aria-hidden='true'
                className='h-2.5 w-2.5 shrink-0 rounded-full'
                style={{ background: GROUP_COLOR[g.code] ?? GROUP_COLOR.UNKNOWN }}
              />
              {/* 지역 이름과 시간대는 한 덩어리다 */}
              <span className='flex-1 whitespace-nowrap text-sm font-medium text-fg'>
                {label.region}
                {label.zone && <span className='ml-1.5 text-xs text-fg-muted'>{label.zone}</span>}
              </span>
              <span className='tnum shrink-0 text-sm font-bold text-fg'>
                {g.percentage === null ? '—' : `${Math.round(g.percentage)}%`}
              </span>
              <span className='tnum w-14 shrink-0 text-right text-xs text-fg-muted'>{formatCount(g.count)}명</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
