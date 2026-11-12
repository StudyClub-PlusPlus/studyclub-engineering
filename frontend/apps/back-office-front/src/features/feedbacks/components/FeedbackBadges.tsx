import { Badge, cx } from '@studyclub/ui';

import { STATUS_CLASS, STATUS_LABEL, TYPE_LABEL, TYPE_TONE } from '@/features/feedbacks/labels';
import type { FeedbackStatus, FeedbackType } from '@/features/feedbacks/types';

/** 상태 뱃지 — 미확인 회색 · 확인 파랑 · 완료 초록. 색만으로 가르지 않는다: 문구를 늘 붙인다. */
export function FeedbackStatusBadge({ status, className }: { status: FeedbackStatus; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-semibold',
        STATUS_CLASS[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  return <Badge tone={TYPE_TONE[type]}>{TYPE_LABEL[type]}</Badge>;
}
