'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { StatCard } from '@studyclub/ui';
import type { UseQueryResult } from '@tanstack/react-query';

import { LOAD_FAILED, SkeletonBar } from '@/features/dashboard/components/DashboardSection';
import { formatCount, formatDelta, formatPerCrew, formatRate } from '@/features/dashboard/format';
import type { AggregateKey, ApiAttendanceComparison, ApiDashboardSummary } from '@/features/dashboard/types';

type Field<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; value: T | null };

/**
 * 요약 응답에서 카드 하나의 값을 꺼낸다. 실패는 **`errors` 로만** 가른다 — 실패한 묶음은 필드가 빠지는데,
 * 성공했는데 값이 없는(분모 0) 필드도 빠질 수 있어서다. `errors` 에 없는데 빠진 필드는 null(대상 없음)이다.
 * `errors` 에 묶음이 있으면 필드가 와 있어도 쓰지 않는다 (spec 4.2 — 오류와 데이터가 어긋나면 정상 값으로 보정하지 않는다).
 */
function fieldOf<T>(
  query: Pick<UseQueryResult<ApiDashboardSummary>, 'data' | 'isError'>,
  group: AggregateKey,
  pick: (summary: ApiDashboardSummary) => T | null | undefined,
): Field<T> {
  if (query.isError) return { status: 'error' };
  if (query.data === undefined) return { status: 'loading' };
  if (query.data.errors?.[group]) return { status: 'error' };
  return { status: 'ok', value: pick(query.data) ?? null };
}

/** 값 자리. 로딩은 회색 막대, 실패는 문구 — 실패를 0 으로 보이지 않는다 (PRD 7). */
function valueOf<T>(field: Field<T>, format: (value: T) => ReactNode): ReactNode {
  if (field.status === 'loading') {
    return (
      <>
        <SkeletonBar className='h-9 w-20' />
        <span className='sr-only'>불러오는 중</span>
      </>
    );
  }
  if (field.status === 'error') return <span className='type-label-lg text-fg-muted'>{LOAD_FAILED}</span>;
  return field.value === null ? '—' : format(field.value);
}

/** 보조 문구 — 대상이 없을 때만 빈 상태 문구로 바꾼다. 실패·로딩 때는 무엇을 세는 카드인지 그대로 알린다. */
function subOf<T>(field: Field<T>, normal: string, empty: string): string {
  return field.status === 'ok' && field.value === null ? empty : normal;
}

/**
 * 전주 대비 (2-2-1). 지난주나 이번 주 값이 없으면 **아예 그리지 않는다** — 「–」 를 두면 「변화 없음」으로 읽힌다 (PRD).
 * 출석률은 내림이 나쁜 변화다. 색과 함께 화살표를 둔다 — 색만으로 가르지 않는다.
 */
function AttendanceDelta({ comparison }: { comparison: ApiAttendanceComparison | undefined }) {
  const pp = comparison?.deltaPercentagePoints;
  if (pp === null || pp === undefined) return null;
  const { text, tone } = formatDelta(pp);
  const color = tone === 'up' ? 'text-success-fg' : tone === 'down' ? 'text-danger-fg' : 'text-fg-muted';
  const word = tone === 'up' ? '상승' : tone === 'down' ? '하락' : '변화 없음';
  return (
    <span className={`tnum type-label-lg ${color}`} title='전주 대비'>
      <span aria-hidden='true'>{text}</span>
      <span className='sr-only'>
        전주 대비 {text.replace(/[▲▼–]/g, '')} {word}
      </span>
    </span>
  );
}

const CARD_CLASS = 'h-full';
const LINK_CARD_CLASS =
  'h-full transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-interactive group-hover:shadow-sm';

/**
 * KPI 네 장 (화면 2). 같은 비중으로 둔다 — 하나를 경고처럼 드러내지 않는다.
 * 실패 범위는 요약 응답의 묶음을 따른다: participation → 활성 크루·1인당, attendance → 출석률·전주 대비,
 * communityMembers → 커뮤니티 멤버. 요약 요청 전체가 실패하면 넷 다 실패다.
 */
export function KpiCards({ summary }: { summary: Pick<UseQueryResult<ApiDashboardSummary>, 'data' | 'isError'> }) {
  const activeCrew = fieldOf(summary, 'participation', (s) => s.activeCrew);
  const studiesPerCrew = fieldOf(summary, 'participation', (s) => s.studiesPerCrew);
  const attendanceRate = fieldOf(summary, 'attendance', (s) => s.attendanceRate);
  const comparison = fieldOf(summary, 'attendance', (s) => s.attendanceComparison);
  const communityMembers = fieldOf(summary, 'communityMembers', (s) => s.communityMembers);

  return (
    <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
      {/*
        활성 크루는 누를 수 없다 — 유저 목록은 가입자 전체라 이 수와 모수가 다르다.
        눌러서 간 곳의 수가 다르면 어느 쪽이 맞는지 되묻게 된다 (PRD 2-1).
      */}
      <StatCard
        anno='2-1'
        label='활성 크루'
        value={valueOf(activeCrew, formatCount)}
        sub='진행 중 스터디 기준'
        className={CARD_CLASS}
      />
      <StatCard
        anno='2-2'
        label='평균 출석률'
        value={
          <span className='inline-flex items-baseline gap-2'>
            {valueOf(attendanceRate, formatRate)}
            {attendanceRate.status === 'ok' && comparison.status === 'ok' && (
              <AttendanceDelta comparison={comparison.value ?? undefined} />
            )}
          </span>
        }
        sub={subOf(attendanceRate, '전 스터디 · 지각 포함', '아직 출석 기록이 없습니다.')}
        className={CARD_CLASS}
      />
      <StatCard
        anno='2-3'
        label='크루 1인당 참여 스터디'
        value={valueOf(studiesPerCrew, formatPerCrew)}
        sub={subOf(studiesPerCrew, '진행 중 스터디 기준', '활성 크루가 없습니다.')}
        className={CARD_CLASS}
      />
      {/* 가입 전체 수 — 유저 메뉴와 같은 전체 목록으로 간다. 필터를 걸지 않는다 (spec 2-4) */}
      <Link href='/users' className='group'>
        <StatCard
          anno='2-4'
          label='커뮤니티 멤버'
          value={valueOf(communityMembers, formatCount)}
          sub='온보딩 완료 회원'
          className={LINK_CARD_CLASS}
        />
      </Link>
    </div>
  );
}
