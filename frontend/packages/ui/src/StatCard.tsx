import type { ReactNode } from "react";
import { Card } from "./Card";
import { cx } from "./cx";

/**
 * design-system.md §9-7 Dashboard Stat Card.
 * 라벨(sm/neutral-600) → 값(3xl~4xl/700, tabular-nums) → 델타(success-700 ▲ / error-700 ▼)
 */
export interface StatCardProps {
  label: string;
  value: ReactNode;
  /** 값 아래 보조 설명 (예: "전체 코호트"). */
  sub?: string;
  /** 양수면 ▲(success), 음수면 ▼(error). 0/undefined 면 표시하지 않는다. */
  delta?: number;
  /** "12", "3%p" 처럼 델타 뒤에 붙는 단위 표기. */
  deltaSuffix?: string;
  /** 델타의 기준 기간 (예: "올해 신규"). 무엇 대비 증감인지 모호해지지 않게 붙인다. */
  deltaLabel?: string;
  /** 라벨 앞 주제 아이콘. */
  leadingIcon?: ReactNode;
  /** 우측 상단 보조 아이콘 (예: 이동 화살표). */
  icon?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  sub,
  delta,
  deltaSuffix,
  deltaLabel,
  leadingIcon,
  icon,
  className,
}: StatCardProps) {
  const up = typeof delta === "number" && delta > 0;
  const down = typeof delta === "number" && delta < 0;
  return (
    <Card className={cx("flex flex-col gap-1", className)}>
      {/* §9-7 순서: 라벨 → 값 → 델타. 값은 neutral-900 + tabular-nums(.stat-value). */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm text-fg-muted">
          {leadingIcon}
          {label}
        </span>
        {icon && <span className="text-fg-placeholder">{icon}</span>}
      </div>
      <span className="stat-value text-3xl font-bold tracking-tight text-neutral-900">{value}</span>
      {(up || down) && (
        <span className="flex items-baseline gap-1.5 text-sm">
          <span
            className={cx("tnum font-medium", up ? "text-success-700" : "text-error-700")}
          >
            {up ? "▲" : "▼"} {Math.abs(delta as number)}
            {deltaSuffix}
          </span>
          {deltaLabel && <span className="text-xs text-fg-placeholder">{deltaLabel}</span>}
        </span>
      )}
      {sub && <span className="text-xs text-fg-placeholder">{sub}</span>}
    </Card>
  );
}

/** §9-6 출석률 임계 색: ≥80 success / 60–79 warning / <60 error. */
export function rateToneClass(rate: number): string {
  if (rate >= 80) return "text-success-700";
  if (rate >= 60) return "text-warning-700";
  return "text-error-700";
}
