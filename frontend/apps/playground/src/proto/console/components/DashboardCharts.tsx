'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { TrendPoint } from '@console/lib/dashboard';
import { MEMBER_REGIONS, type MemberRegion } from '@studyclub/mock';

/**
 * 대시보드 차트.
 *
 * 차트 라이브러리를 넣지 않는다(레포 규칙: 외부 의존 임의 추가 금지). 여기서 필요한 것은
 * **비율 두 가지**뿐이라 SVG 도넛과 가로 막대로 충분하다.
 */

const REGION_COLOR: Record<MemberRegion, string> = {
  KR: 'var(--color-primary-600)',
  NA: 'var(--color-info-500)',
  ETC: 'var(--color-neutral-300)',
};

export function Card({
  title,
  action,
  anno,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  anno?: string;
  children: React.ReactNode;
}) {
  return (
    <section data-anno={anno} className='card px-6 py-5'>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-[15px] font-bold'>{title}</h2>
        {action}
      </div>
      <div className='mt-4'>{children}</div>
    </section>
  );
}

/** 지역 분포 — 도넛. 조각이 셋뿐이라 범례에 수치를 같이 적는다. */
export function RegionDonut({ data }: { data: { key: MemberRegion; count: number }[] }) {
  const total = data.reduce((a, b) => a + b.count, 0) || 1;
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className='flex flex-wrap items-center gap-4'>
      <svg viewBox='0 0 140 140' className='h-[120px] w-[120px] shrink-0 -rotate-90'>
        <circle cx='70' cy='70' r={R} fill='none' stroke='var(--color-surface-2)' strokeWidth='20' />
        {data.map((d) => {
          const len = (d.count / total) * C;
          const el = (
            <circle
              key={d.key}
              cx='70'
              cy='70'
              r={R}
              fill='none'
              stroke={REGION_COLOR[d.key]}
              strokeWidth='20'
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>

      <ul className='flex min-w-0 flex-1 flex-col gap-2.5'>
        {data.map((d) => {
          const meta = MEMBER_REGIONS.find((r) => r.key === d.key);
          const pct = Math.round((d.count / total) * 100);
          return (
            <li key={d.key} className='flex items-center gap-2.5'>
              <span
                className='h-2.5 w-2.5 shrink-0 rounded-full'
                style={{ background: REGION_COLOR[d.key] }}
                aria-hidden='true'
              />
              {/* 지역 이름과 시간대는 한 덩어리다 — 줄여야 할 때는 여백을 먼저 줄이고 이 칸은 지킨다 */}
              <span className='flex-1 whitespace-nowrap text-sm font-medium text-fg'>
                {meta?.label.ko ?? d.key}
                <span className='ml-1.5 text-xs text-fg-muted'>{meta?.tzLabel}</span>
              </span>
              <span className='tnum shrink-0 text-sm font-bold text-fg'>{pct}%</span>
              <span className='tnum w-12 shrink-0 text-right text-xs text-fg-muted'>{d.count}명</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** 주제별 출석률 — 가로 막대. 세로 막대는 주제 이름이 겹쳐 읽히지 않는다. */
export type CategoryCount = { category: string; code: string; running: number; total: number };

/**
 * 주제별 스터디 수.
 *
 * 주제는 **중복해서 달 수 있다.** 그래서 이 카드는 「어느 분야를 얼마나 하고 있나」만 말한다 —
 * 출석률을 여기 얹으면 한 스터디가 여러 줄의 평균에 동시에 들어가 값의 뜻이 흐려진다.
 * 출석률은 전체 평균(KPI)과 추세 차트가 맡는다.
 *
 * **진행중과 누적을 따로 본다.** 지금 굴러가는 분야와 지금까지 많이 해 온 분야는 다른 질문이다.
 */
export function CategoryStudyCard({ data }: { data: CategoryCount[] }) {
  const [scope, setScope] = useState<'running' | 'total'>('running');
  const rows = [...data]
    .map((d) => ({ ...d, count: scope === 'running' ? d.running : d.total }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count);
  const most = Math.max(1, ...rows.map((d) => d.count));

  return (
    <Card
      title='주제별 스터디 수'
      anno='6'
      action={
        <div data-anno='6-1' className='flex gap-1'>
          {(
            [
              ['running', '진행중'],
              ['total', '누적'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type='button'
              aria-pressed={scope === key}
              onClick={() => setScope(key)}
              className={`rounded-pill px-2.5 py-1 text-xs font-semibold transition-colors ${
                scope === key ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:text-fg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
      {rows.length === 0 ? (
        <p className='py-6 text-center text-sm text-fg-muted'>해당하는 스터디가 없습니다.</p>
      ) : (
        <ul className='flex flex-col gap-1'>
          {rows.map((d) => (
            <li key={d.category}>
              {/* 행 전체가 링크다 — 막대만 누르게 하면 어디를 눌러야 하는지 매번 겨냥해야 한다 */}
              <Link
                href={`/proto/console/studies?category=${d.code}`}
                aria-label={`${d.category} ${scope === 'running' ? '진행중' : '누적'} 스터디 ${d.count}개`}
                className='flex items-center gap-3 rounded-control px-1 py-1.5 transition-colors hover:bg-surface-2'
              >
                <span className='w-24 shrink-0 truncate text-[13px] font-medium text-fg-secondary' title={d.category}>
                  {d.category}
                </span>
                <span className='h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-surface-2'>
                  <span
                    className='block h-full rounded-pill'
                    style={{ width: `${(d.count / most) * 100}%`, background: 'var(--color-primary-600)' }}
                  />
                </span>
                <span className='tnum w-10 shrink-0 text-right text-[13px] font-bold text-fg'>{d.count}개</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/**
 * 평균 출석률 추세 — 최근 12주.
 *
 * 세션이 하나도 없던 주는 **선을 끊는다.** 0% 로 찍으면 쉬어간 주가 폭락으로 보이고, 운영자는
 * 없는 문제를 찾게 된다.
 */
export function AttendanceTrend({ points }: { points: TrendPoint[] }) {
  const withData = points.filter((p) => p.rate !== null);
  // 값이 한 주뿐이어도 그 점을 찍는다 — 선이 없을 뿐 「얼마였는지」는 여전히 말할 수 있다.
  if (withData.length === 0) {
    return <p className='py-10 text-center text-sm text-fg-muted'>아직 출석 기록이 없습니다.</p>;
  }

  const W = 320;
  const H = 120;
  const avg = Math.round(withData.reduce((sum, p) => sum + p.rate!, 0) / withData.length);
  const x = (i: number) => (points.length === 1 ? 0 : (i / (points.length - 1)) * W);
  const y = (rate: number) => H - (rate / 100) * H;

  // 빈 주에서 끊어진 선분들
  const segments: { i: number; p: TrendPoint }[][] = [];
  points.forEach((p, i) => {
    if (p.rate === null) {
      segments.push([]);
      return;
    }
    if (segments.length === 0) segments.push([]);
    segments[segments.length - 1]!.push({ i, p });
  });

  return (
    <div>
      {/*
        평균은 제 선 위에 붙인다 — 따로 한 줄을 내주면 차트보다 글자가 자리를 더 먹는다.
        오른쪽에 라벨 자리를 비워 둔다. 선 위에 겹치면 마지막 주의 값을 가린다.
      */}
      <div className='relative pr-16'>
        <span
          className='tnum absolute right-0 -translate-y-1/2 text-[11px] font-bold text-fg-muted'
          style={{ top: `${100 - avg}%` }}
        >
          평균 {avg}%
        </span>
        <svg viewBox={`0 0 ${W} ${H}`} className='h-[140px] w-full' preserveAspectRatio='none'>
          {[0, 50, 100].map((v) => (
            <line key={v} x1='0' x2={W} y1={y(v)} y2={y(v)} stroke='var(--color-border)' strokeWidth='1' />
          ))}
          <line
            data-anno='5-1'
            x1='0'
            x2={W}
            y1={y(avg)}
            y2={y(avg)}
            stroke='var(--color-fg-muted)'
            strokeWidth='1'
            strokeDasharray='4 4'
          />
          {segments
            .filter((seg) => seg.length > 0)
            .map((seg) => (
              <polyline
                key={seg[0]!.i}
                fill='none'
                stroke='var(--color-primary-600)'
                strokeWidth='2'
                strokeLinejoin='round'
                points={seg.map(({ i, p }) => `${x(i)},${y(p.rate!)}`).join(' ')}
              />
            ))}
          {points.map((p, i) =>
            p.rate === null ? null : (
              <circle key={p.weekStart} cx={x(i)} cy={y(p.rate)} r='2.5' fill='var(--color-primary-600)'>
                <title>{`${p.weekStart} 주 · 출석률 ${p.rate}% (출석 ${p.attended} / 대상 ${p.target})`}</title>
              </circle>
            ),
          )}
        </svg>
      </div>

      <div className='mt-1 flex justify-between pr-16 text-[11px] text-fg-muted'>
        {points.map((p, i) => (
          <span key={p.weekStart} className='tnum'>
            {i % 4 === 0 ? p.weekStart.slice(5) : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
