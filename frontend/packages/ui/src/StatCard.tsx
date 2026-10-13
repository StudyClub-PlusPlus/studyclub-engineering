import type { ReactNode } from 'react';

import { Card } from './Card';
import { cx } from './cx';

/**
 * design-system.md §9-7 Dashboard Stat Card.
 * 라벨(sm/text-muted) → 값(3xl~4xl/700, tabular-nums) → 델타(success-fg ▲ / danger-fg ▼)
 */
export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** 값 아래 보조 설명 (예: "전체 코호트"). */
  sub?: string;
  /** 양수면 ▲(success), 음수면 ▼(error). 0/undefined 면 표시하지 않는다. */
  delta?: number;
  /** 델타 뒤 단위 (예: "건", "%p"). deltaUnit 과 동일. */
  deltaSuffix?: string;
  /** deltaSuffix 의 별칭. */
  deltaUnit?: string;
  /** 델타의 기준 기간 (예: "지난달 대비"). */
  deltaLabel?: string;
  /** 내려가는 것이 나쁜 값인가. 기본 true. false 로 바꾸면 ▼이 초록, ▲이 빨강. */
  downIsBad?: boolean;
  /** 라벨 앞 주제 아이콘. */
  leadingIcon?: ReactNode;
  /** 우측 상단 보조 아이콘. */
  icon?: ReactNode;
  /** 카드 전체를 링크로 감쌀 때 사용. */
  href?: string;
  /** data-anno 어노테이션 (PRD 스펙용). */
  anno?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
  deltaUnit,
  deltaLabel,
  downIsBad = true,
  leadingIcon,
  icon,
  href,
  anno,
  className,
}: StatCardProps) {
  const unit = deltaUnit ?? deltaSuffix ?? '';
  const hasDelta = typeof delta === 'number';
  const up = hasDelta && delta > 0;
  const good = hasDelta && (downIsBad ? delta > 0 : delta < 0);

  const body = (
    <Card
      data-anno={anno}
      className={cx(
        'flex flex-col gap-1',
        href && 'transition-[border-color,box-shadow] duration-fast ease-out group-hover:border-border-strong group-hover:shadow-sm',
        className,
      )}
    >
      <div className='flex items-center justify-between gap-2'>
        <span className='flex items-center gap-1.5 text-sm text-fg-muted'>
          {leadingIcon}
          {label}
        </span>
        {icon && <span className='text-fg-placeholder'>{icon}</span>}
      </div>
      <span className='stat-value text-3xl font-bold tracking-tight text-ink'>{value}</span>
      {hasDelta && delta !== 0 && (
        <span className='flex items-baseline gap-1.5 text-sm'>
          <span className={cx('tnum font-medium', good ? 'text-success-fg' : 'text-danger-fg')}>
            {up ? '▲' : '▼'} {Math.abs(delta)}{unit}
          </span>
          {deltaLabel && <span className='text-xs text-fg-placeholder'>{deltaLabel}</span>}
        </span>
      )}
      {sub && <span className='text-xs text-fg-placeholder'>{sub}</span>}
    </Card>
  );

  if (href) {
    return <a href={href} className='group'>{body}</a>;
  }
  return body;
}

/** §9-6 출석률 임계 색: ≥80 success / 60–79 warning / <60 error. */
export function rateToneClass(rate: number): string {
  if (rate >= 80) return 'text-success-fg';
  if (rate >= 60) return 'text-warning-fg';
  return 'text-danger-fg';
}
