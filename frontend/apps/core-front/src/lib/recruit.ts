/**
 * 모집 상태의 **문구**만 담당한다. 판정 자체는 `@studyclub/mock` 이 정본 —
 * 운영자 콘솔과 사용자 사이트가 같은 함수를 써야 표기가 어긋나지 않는다.
 *
 * 신청은 외부 폼이 아니라 **사이트 자체**에서 받으므로 신청 링크 유무로 판정하지 않는다.
 * 판정 축은 **모집 마감일 하나**다.
 * - apply  : 모집 중 + (마감일이 남았거나 · 마감일이 없음=상시 모집)
 * - closed : 진행중·종료·마감일 경과
 *
 * 마감일을 비우면 마감 없이 계속 모집하는 것으로 본다(= 모집중). 스터디 종류를 따로 나누지
 * 않고 마감일 유무로만 표현하므로, 등록 폼에서 마감일은 선택 입력이다.
 */

import { recruitState, todayISO, toISODate, type RecruitState } from '@studyclub/mock';

import type { Locale, Study } from '@/lib/content';
import { t } from '@/lib/i18n';

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
export function recruitDeadline(study: Study, locale: Locale): string | undefined {
  const d = toISODate(study.recruitment?.deadline);
  if (!d) return undefined;
  return locale === 'ko' ? `마감 ${d}` : `Due ${d}`;
}

/** 시작일 표시값 — `STUDY.START_AT` 이 없으면 `미정`. */
export function studyStartValue(study: Study, locale: Locale): string {
  return toISODate(study.startAt) ?? t({ ko: '미정', en: 'TBD' }, locale);
}

/**
 * 스터디가 도는 시간대 — 목록 필터·목록/상세 표기가 **같은 판정**을 쓰도록 여기서 단일 정의한다.
 * 일정·킥오프 문구에 표기가 없으면 `both`(동시 모집)로 본다.
 */
export type StudyTimezone = 'KST' | 'PST' | 'both';

export function studyTimezone(study: Study): StudyTimezone {
  const text = [study.schedule?.ko, study.schedule?.en, study.recruitment?.kickoff].filter(Boolean).join(' ');
  if (/PST|PDT/i.test(text)) return 'PST';
  if (/KST/i.test(text)) return 'KST';
  return 'both';
}

const TIMEZONE_LABEL: Record<StudyTimezone, { ko: string; en: string }> = {
  KST: { ko: 'KST', en: 'KST' },
  PST: { ko: 'PST', en: 'PST' },
  both: { ko: '동시 모집(KST·PST)', en: 'Multiple timezones (KST·PST)' },
};

export function studyTimezoneLabel(study: Study, locale: Locale): string {
  return t(TIMEZONE_LABEL[studyTimezone(study)], locale);
}

/**
 * 카드 상단 상태 배지(예: "모집중 (D-3)") — dot 색은 design-system 상태 tone 을 그대로 쓴다.
 * 마감 임박(D-3 이내) 판정은 백엔드 `isClosingSoon()` 과 같은 기준(3일) —
 * [study-recruit-status/spec.md](../../../../specs/study-recruit-status/spec.md#판정-규칙) 참고.
 */
export function recruitBadge(study: Study, locale: Locale): { label: string; dotClass: string } {
  if (study.status === 'ongoing') {
    return { label: t({ ko: '진행중', en: 'Ongoing' }, locale), dotClass: 'bg-inprogress-dot' };
  }
  if (recruitState(study) === 'closed') {
    return { label: t({ ko: '모집 마감', en: 'Closed' }, locale), dotClass: 'bg-closed-dot' };
  }
  const deadline = toISODate(study.recruitment?.deadline);
  if (!deadline) {
    return { label: t({ ko: '상시 모집', en: 'Always open' }, locale), dotClass: 'bg-recruiting-dot' };
  }
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86_400_000);
  const dLabel = days <= 0 ? 'D-DAY' : `D-${days}`;
  const closingSoon = days <= 3;
  return {
    label: t({ ko: `모집중 (${dLabel})`, en: `Open (${dLabel})` }, locale),
    dotClass: closingSoon ? 'bg-closingsoon-dot' : 'bg-recruiting-dot',
  };
}
