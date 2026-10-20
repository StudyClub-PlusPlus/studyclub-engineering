'use client';

import { getStudyCrew, type Study, type StudyMeeting } from '@studyclub/mock';

import { withAdded } from './meetings';

/**
 * 출석 상태 이름 · 색과 회차 목록.
 *
 * 회원 본인 체크인 · 브라우저 출석 기록은 지웠다 — 출석은 서버(GET /api/me/studies · 출석부 API)가 정본이다.
 */

/** 휴가는 회원이 미리 알리는 부재다. 운영자 출석부의 출석/지각/결석과는 별개 축. */
export type MyStatus = 'present' | 'late' | 'absent' | 'excused';

export const STATUS_LABEL: Record<MyStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

export const STATUS_STYLE: Record<MyStatus, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};

export function meetingsOf(study: Study): StudyMeeting[] {
  return withAdded(getStudyCrew(study).meetings, study.id);
}
