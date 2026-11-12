import { Badge } from '@studyclub/ui';

import { FEEDBACK_STATUS_LABEL, FEEDBACK_TYPE_LABEL, type FeedbackStatus, type FeedbackType } from './feedback';

const TYPE_TONE: Record<FeedbackType, 'neutral' | 'recruiting' | 'error'> = {
  QUESTION: 'neutral',
  IDEA: 'recruiting',
  BUG: 'error',
};

/** 유형 뱃지 — 문의 · 개선 의견 · 오류 신고 */
export function FeedbackTypeBadge({ type }: { type: FeedbackType }) {
  return <Badge tone={TYPE_TONE[type]}>{FEEDBACK_TYPE_LABEL[type]}</Badge>;
}

/** 상태 뱃지 — 접수(회색) · 답변 완료(초록). 값은 서버가 정한 것을 그대로 그린다 */
export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const done = status === 'ANSWERED';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-pill px-2 py-0.5 text-xs font-semibold ${
        done ? 'bg-success-50 text-success-700' : 'bg-surface-2 text-fg-secondary'
      }`}
    >
      {FEEDBACK_STATUS_LABEL[status]}
    </span>
  );
}
