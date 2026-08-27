import type { ReactNode } from 'react';

import { cx } from './cx';

/**
 * design-system.md §9-4 / §2-5.
 * tonal 스타일: bg {semantic}-50 · text {semantic}-700 · 선행 dot {semantic}-500.
 * ⚠️ 색만으로 구분 금지 — 라벨(children)은 항상 필수다.
 *
 * Tailwind v4 는 소스를 정적으로 스캔하므로 클래스명을 동적으로 조립하지 않고
 * 전부 문자열로 나열한다.
 */
export type BadgeTone =
  // 스터디 상태
  | 'recruiting'
  | 'closingsoon'
  | 'inprogress'
  | 'closed'
  | 'ended'
  // 역할
  | 'captain'
  | 'navigator'
  | 'member'
  // 출석
  | 'present'
  | 'late'
  | 'absent'
  | 'leave'
  | 'unchecked'
  // 중립
  | 'neutral';

const TONE: Record<BadgeTone, { chip: string; dot: string }> = {
  recruiting: { chip: 'bg-recruiting-bg text-recruiting-fg', dot: 'bg-recruiting-dot' },
  closingsoon: { chip: 'bg-closingsoon-bg text-closingsoon-fg', dot: 'bg-closingsoon-dot' },
  inprogress: { chip: 'bg-inprogress-bg text-inprogress-fg', dot: 'bg-inprogress-dot' },
  closed: { chip: 'bg-closed-bg text-closed-fg', dot: 'bg-closed-dot' },
  ended: { chip: 'bg-ended-bg text-ended-fg', dot: 'bg-ended-dot' },

  captain: { chip: 'bg-captain-bg text-captain-fg', dot: 'bg-captain-fg' },
  navigator: { chip: 'bg-navigator-bg text-navigator-fg', dot: 'bg-navigator-fg' },
  member: { chip: 'bg-member-bg text-member-fg', dot: 'bg-member-fg' },

  present: { chip: 'bg-present-bg text-present-fg', dot: 'bg-present-fg' },
  late: { chip: 'bg-late-bg text-late-fg', dot: 'bg-late-fg' },
  absent: { chip: 'bg-absent-bg text-absent-fg', dot: 'bg-absent-fg' },
  leave: { chip: 'bg-leave-bg text-leave-fg', dot: 'bg-leave-fg' },
  unchecked: { chip: 'bg-unchecked-bg text-unchecked-fg', dot: 'bg-unchecked-fg' },

  neutral: { chip: 'bg-surface-2 text-fg-muted', dot: 'bg-fg-muted' },
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** 선행 상태 dot (6px). 상태 pill 에 사용, 단순 태그에는 끈다. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-medium',
        t.chip,
        className,
      )}
    >
      {dot && <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} aria-hidden='true' />}
      {children}
    </span>
  );
}
