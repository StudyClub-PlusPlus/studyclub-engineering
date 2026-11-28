import { cx } from './cx';

/**
 * design-system.md §9-5 정원 진행바.
 * 트랙 disabled-bg · 채움 primary · 80%↑ 이면 채움 warning-fg (= "마감임박" 승격 신호).
 */
export const CAPACITY_WARN_THRESHOLD = 80;

export function capacityPercent(taken: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((taken / total) * 100));
}

/** 정원이 임박(80%↑)했는지 — 상태 pill 을 closingsoon 으로 승격할지 판단할 때 쓴다. */
export function isClosingSoon(taken: number, total: number): boolean {
  return capacityPercent(taken, total) >= CAPACITY_WARN_THRESHOLD;
}

export interface CapacityBarProps {
  taken: number;
  total: number;
  /** 진행바 아래 "정원 75%" 라벨 노출 여부. */
  showLabel?: boolean;
  label?: string;
  /**
   * `capacity`(기본) — 정원. 80% 를 넘으면 경고색.
   * `goal` — 목표 대비 진행. 경고색 없이 primary, 목표를 채우면(100%) success. 100% 를 넘어도 막대는 가득 찬 데서 멈춘다.
   */
  variant?: 'capacity' | 'goal';
  className?: string;
}

export function CapacityBar({ taken, total, showLabel = false, label, variant = 'capacity', className }: CapacityBarProps) {
  const pct = capacityPercent(taken, total);
  const goal = variant === 'goal';
  const warn = !goal && pct >= CAPACITY_WARN_THRESHOLD;
  const done = goal && pct >= 100;
  const fallback = goal ? `목표 ${pct}%` : `정원 ${pct}%`;
  return (
    <div className={cx('flex flex-col gap-1', className)}>
      <div
        className='h-1.5 w-full overflow-hidden rounded-pill bg-surface-3'
        role='progressbar'
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? fallback}
      >
        <div
          className={cx(
            'h-full rounded-pill transition-[width] duration-base ease-out',
            warn ? 'bg-warning-fg' : done ? 'bg-success-fg' : 'bg-primary',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className='tnum type-label-sm text-fg-placeholder'>{label ?? fallback}</span>}
    </div>
  );
}
