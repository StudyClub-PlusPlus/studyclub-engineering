import { cx } from "./cx";

/**
 * design-system.md §9-5 정원 진행바.
 * 트랙 surface-3 · 채움 brand(600) · 80%↑ 이면 채움 warning-500 (= "마감임박" 승격 신호).
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
  className?: string;
}

export function CapacityBar({
  taken,
  total,
  showLabel = false,
  label,
  className,
}: CapacityBarProps) {
  const pct = capacityPercent(taken, total);
  const warn = pct >= CAPACITY_WARN_THRESHOLD;
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-3"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `정원 ${pct}%`}
      >
        <div
          className={cx(
            "h-full rounded-pill transition-[width] duration-base ease-out",
            warn ? "bg-warning-500" : "bg-brand",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="tnum text-xs text-fg-placeholder">{label ?? `정원 ${pct}%`}</span>}
    </div>
  );
}
