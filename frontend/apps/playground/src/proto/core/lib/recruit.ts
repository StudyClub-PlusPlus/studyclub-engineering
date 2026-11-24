/** 모집 문구와 D-day. 실제 순간 판정은 recruitment-deadline.ts를 코어·콘솔이 공유한다. */

import type { Locale, Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { type RecruitState } from '@studyclub/types';
import { toISODate } from '@studyclub/utils';

import { recruitState, recruitmentDeadlineLabel, recruitmentDaysLeft } from '@/proto/lib/recruitment-deadline';

export { recruitState, toISODate };
export type { RecruitState };

/** 카드 CTA 문구 — 행동을 지시한다. */
const CTA_LABEL: Record<RecruitState, { ko: string; en: string }> = {
  apply: { ko: '신청하기', en: 'Apply' },
  closed: { ko: '모집 마감', en: 'Closed' },
};

/** 목록 탭 문구 — 상태를 분류한다. CTA와 달리 명사형. */
const TAB_LABEL: Record<RecruitState, { ko: string; en: string }> = {
  apply: { ko: '모집중', en: 'Open' },
  closed: { ko: '모집 마감', en: 'Closed' },
};

export function recruitLabel(state: RecruitState, locale: Locale): string {
  return t(CTA_LABEL[state], locale);
}

export function recruitTabLabel(state: RecruitState, locale: Locale): string {
  return t(TAB_LABEL[state], locale);
}

/**
 * 모집 마감일 표기. 마감일이 없으면 **아무것도 표기하지 않는다** —
 * 마감 없이 계속 모집하는 것도 결국 "모집중"이며, 그 사실은 탭과 CTA 가 이미 말해준다.
 */
export function recruitDeadline(study: Study, locale: Locale, zone = 'Asia/Seoul'): string | undefined {
  const d = recruitmentDeadlineLabel(study, zone);
  if (!d) return undefined;
  return locale === 'ko' ? `마감 ${d}` : `Due ${d}`;
}

/** 시작일 표시값 — `STUDY.START_AT` 이 없으면 「미정」. */
export function studyStartValue(study: Study, locale: Locale): string {
  return toISODate(study.startAt) ?? t({ ko: '미정', en: 'TBD' }, locale);
}

/**
 * 카드 상단 상태 배지(예: "모집중 (D-3)") — dot 색은 design-system 상태 tone 을 그대로 쓴다.
 * D-day와 임박 색상은 조회자의 달력 기준이며, UTC 마감 판정과 분리한다.
 *
 * 마감일이 없는 경우를 「상시 모집」이라 부르지 않는다 — 상시 모집은 폐지했다(등록 폼에서 마감일은
 * 필수). 여기 걸리는 건 그 결정 이전에 만들어진 옛 시드뿐이라 「미정」으로만 표시한다.
 */
export function recruitBadge(study: Study, locale: Locale, zone = 'Asia/Seoul', now = Date.now()): { label: string; dotClass: string } {
  if (study.status === 'ongoing') {
    return { label: t({ ko: '진행중', en: 'Ongoing' }, locale), dotClass: 'bg-inprogress-dot' };
  }
  if (recruitState(study, now) === 'closed') {
    return { label: t({ ko: '모집 마감', en: 'Closed' }, locale), dotClass: 'bg-closed-dot' };
  }
  const days = recruitmentDaysLeft(study, zone, now);
  if (days === undefined) {
    return { label: t({ ko: '모집중 (미정)', en: 'Open (TBD)' }, locale), dotClass: 'bg-recruiting-dot' };
  }
  const dLabel = days <= 0 ? 'D-DAY' : `D-${days}`;
  const closingSoon = days <= 3;
  return {
    label: t({ ko: `모집중 (${dLabel})`, en: `Open (${dLabel})` }, locale),
    dotClass: closingSoon ? 'bg-closingsoon-dot' : 'bg-recruiting-dot',
  };
}
