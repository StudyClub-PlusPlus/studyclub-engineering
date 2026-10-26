// 문의·오류 신고 화면의 이름표와 문구. 서버 값(DB enum)을 화면 이름으로 바꾸는 곳은 여기 한 곳이다.
import type { BadgeTone } from '@studyclub/ui';

import type { ApiFeedbackPerson, ApiAdminFeedbackDetail, FeedbackStatus, FeedbackType } from '@/features/feedbacks/types';

/** 고르는 순서 — 문의 · 개선 의견 · 오류 신고 (프로토 `FEEDBACK_TYPES`). */
export const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: 'QUESTION', label: '문의' },
  { value: 'IDEA', label: '개선 의견' },
  { value: 'BUG', label: '오류 신고' },
];

export const TYPE_LABEL: Record<FeedbackType, string> = { QUESTION: '문의', IDEA: '개선 의견', BUG: '오류 신고' };

export const TYPE_TONE: Record<FeedbackType, BadgeTone> = { QUESTION: 'neutral', IDEA: 'recruiting', BUG: 'error' };

export const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: 'NEW', label: '미확인' },
  { value: 'SEEN', label: '확인' },
  { value: 'DONE', label: '완료' },
];

export const STATUS_LABEL: Record<FeedbackStatus, string> = { NEW: '미확인', SEEN: '확인', DONE: '완료' };

/** 미확인 회색 · 확인 파랑 · 완료 초록. 색만으로 가르지 않는다 — 문구를 늘 붙인다. */
export const STATUS_CLASS: Record<FeedbackStatus, string> = {
  NEW: 'bg-surface-2 text-fg-secondary',
  SEEN: 'bg-primary-500/15 text-primary-600',
  DONE: 'bg-success-50 text-success-700',
};

/**
 * 고를 수 없는 상태 옆에 붙이는 이유. 막을지는 서버의 `selectableStatuses` 가 정하고, 여기는 문구만 준다.
 * 완료는 회신으로만 된다(스펙 「상태: 회신과 묶는다」).
 */
export const STATUS_DISABLED_HINT: Partial<Record<FeedbackStatus, string>> = {
  DONE: '답변을 작성한 후 완료할 수 있어요.',
};

/** 드롭다운이 잠겼을 때(고를 수 있는 상태가 없다) 보이는 이유 — 서버 `FEEDBACK_ALREADY_ANSWERED` 기본 문구와 같다. */
export const STATUS_LOCKED_HINT = '답변한 문의는 상태를 바꿀 수 없어요.';

export const LEFT_USER = '탈퇴한 사용자';

/** 닉네임이 null 이면 탈퇴한 계정이다. */
export function personLabel(person: ApiFeedbackPerson): string {
  return person.nickname ?? LEFT_USER;
}

/** 표·상세에서 값이 없을 때. */
export const EMPTY_VALUE = '—';

/** 화면 크기 — 「390 × 844」. 화면이 안 보냈으면 빈 값. */
export function viewportLabel(viewport: ApiAdminFeedbackDetail['viewport']): string {
  return viewport ? `${viewport.width} × ${viewport.height}` : EMPTY_VALUE;
}

/**
 * 보는 사람의 시간대로, 24시간제 — 「26.10.18 14:02」 (프로토 `stamp`).
 * 읽을 수 없는 값이면 원문을 그대로 둔다 — 비우면 값이 없는 것으로 읽힌다.
 */
export function formatStamp(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${String(at.getFullYear()).slice(2)}.${p(at.getMonth() + 1)}.${p(at.getDate())} ${p(at.getHours())}:${p(at.getMinutes())}`;
}

// ── 안내 문구 (PRD 「상태별 화면」)
export const COPY = {
  listEmpty: '접수된 문의·오류 신고가 없습니다.',
  listFilteredEmpty: '조건에 맞는 문의·오류 신고가 없습니다.',
  listError: '불러오지 못했습니다. 다시 시도해 주세요.',
  notFound: '삭제되었거나 없는 문의·오류 신고입니다.',
  statusChanged: '상태를 변경했습니다.',
  statusFailed: '상태를 변경하지 못했습니다. 다시 시도해 주세요.',
  replySent: '회신을 보냈습니다.',
  replyEdited: '회신을 고쳤습니다.',
  replyFailed: '회신을 보내지 못했습니다. 다시 시도해 주세요.',
  replyEditFailed: '회신을 고치지 못했습니다. 다시 시도해 주세요.',
  memoSaved: '저장했습니다.',
  memoFailed: '저장하지 못했습니다. 다시 시도해 주세요.',
  /** 줄표를 쓰지 않는다(ui-copy.md) — 프로토의 「내부용 — …」 를 쌍점으로. */
  memoPlaceholder: '내부용: 제출자에게 보이지 않습니다',
} as const;
