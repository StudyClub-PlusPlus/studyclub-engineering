/**
 * 모집 상태의 **문구**만 담당한다. 판정 자체는 `@studyclub/mock` 이 정본 —
 * 운영자 콘솔과 사용자 사이트가 같은 함수를 써야 표기가 어긋나지 않는다.
 *
 * 신청은 외부 폼이 아니라 **사이트 자체**에서 받으므로 신청 링크 유무로 판정하지 않는다.
 * 판정 축은 **모집 마감일 하나**다.
 * - apply  : 모집 중 + 마감일이 남았음
 * - closed : 진행중·종료·마감일 경과
 *
 * **상시 모집은 없다.** 등록 폼에서 마감일은 필수다. 계속 이어지는 참여는 마감일이 아니라 스터디 종류로
 * 표현한다 — 클럽은 같은 프로그램의 새 기수 공고에서 참여가 자동 유지되고, 스터디는 새 신청이 필요하다.
 */

import type { Locale, Study } from '@core/lib/content';
import { t } from '@core/lib/i18n';
import { isValidZone, scheduleZoneTitle } from '@core/lib/schedule-timezone';
import { formattingZone } from '@core/lib/time-zone-rules';
import { recruitState, todayISO, toISODate, type RecruitState } from '@studyclub/mock';

export { recruitState, toISODate };
export type { RecruitState };

/** 확정된 모임의 날짜·시각·원본 시간대가 모두 있어야 변환한다. 날짜만 있는 startAt은 대상이 아니다. */
export function confirmedRecruitSchedule(study: Study, locale: Locale, viewerZone: string) {
  const schedule = study.confirmedSchedule;
  if (!schedule || !isValidZone(schedule.timeZone) || !isValidZone(viewerZone)) return undefined;
  // 오프셋 없는 날짜·시각을 실행 중인 기기의 시간대로 해석하지 않는다.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(schedule.scheduledAt))
    return undefined;
  const at = new Date(schedule.scheduledAt);
  if (!Number.isFinite(at.getTime())) return undefined;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
      timeZone: formattingZone(viewerZone, at),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  return {
    label: `${parts.year}-${parts.month}-${parts.day} (${parts.weekday}) ${parts.hour}:${parts.minute}`,
    zone: scheduleZoneTitle(viewerZone, locale, at),
  };
}

/** 별도 미리보기 주소에서만 쓰는 확정 일정 예시. 공개 시드의 미정 일정을 확정으로 바꾸지 않는다. */
export function withConfirmedScheduleExample(study: Study): Study {
  return study.id === 'ai-paper-study'
    ? {
        ...study,
        confirmedSchedule: { scheduledAt: '2027-01-07T11:00:00Z', timeZone: 'Asia/Seoul' },
      }
    : study;
}

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

/** 시작일 표시값 — `STUDY.START_AT` 이 없으면 「미정」. */
export function studyStartValue(study: Study, locale: Locale): string {
  return toISODate(study.startAt) ?? t({ ko: '미정', en: 'TBD' }, locale);
}

/**
 * 스터디가 도는 시간대 — 목록 필터·목록/상세 표기가 **같은 판정**을 쓰도록 여기서 단일 정의한다.
 *
 * **`STUDY.TIMEZONE` 이 있으면 그 값을 그대로 쓴다** — 등록 폼에서 운영자가 직접 고른 값이라 가장
 * 정확하다. 이 필드가 생기기 전에 만들어진 시드 데이터는 값이 없어서, 그런 행만 일정·킥오프 문구의
 * KST/PST 표기로 추정한다. 표기도 없으면 `both` 버킷으로 묶는다(필터에서 「동시 모집」으로 노출 —
 * 실제로는 "모른다"에 가깝다. 화면 문구는 `studyTimezoneLabel()` 이 「시간대 미정」으로 정직하게 갈아 준다).
 */
export type StudyTimezone = 'KST' | 'PST' | 'both';

export function studyTimezone(study: Study): StudyTimezone {
  if (study.timezone) return study.timezone;
  const text = [study.schedule?.ko, study.schedule?.en, study.recruitment?.kickoff].filter(Boolean).join(' ');
  if (/PST|PDT/i.test(text)) return 'PST';
  if (/KST/i.test(text)) return 'KST';
  return 'both';
}

/**
 * 카드·상세에 보이는 시간대 문구. **명시된 시간대만 사실대로 말한다.**
 *
 * 운영자가 고른 값이면 `BOTH` 도 「동시 진행(KST·PT)」이다. 고른 값 없이 `studyTimezone()` 이 `both` 를 낸 것은
 * "동시에 진행한다"가 아니라 "일정 문구에 표기가 없다"는 뜻이라, 필터 버킷 이름과 달리 「시간대 미정」으로 남긴다.
 */
const TIMEZONE_DISPLAY_LABEL: Record<StudyTimezone, { ko: string; en: string }> = {
  KST: { ko: 'KST', en: 'KST' },
  PST: { ko: 'PT', en: 'PT' },
  both: { ko: '동시 진행(KST·PT)', en: 'Multiple timezones (KST·PT)' },
};

const UNKNOWN_TIMEZONE_LABEL = { ko: '시간대 미정', en: 'Timezone TBD' };

export function studyTimezoneLabel(study: Study, locale: Locale): string {
  const tz = studyTimezone(study);
  if (tz === 'both' && study.timezone !== 'both') return t(UNKNOWN_TIMEZONE_LABEL, locale);
  return t(TIMEZONE_DISPLAY_LABEL[tz], locale);
}

/**
 * 카드 상단 상태 배지(예: "모집중 (D-3)") — dot 색은 design-system 상태 tone 을 그대로 쓴다.
 * 마감 임박(D-3 이내) 판정은 백엔드 `isClosingSoon()` 과 같은 기준(3일) —
 * [study-recruit-status/spec.md](../../../../../../../specs/study-recruit-status/spec.md#판정-규칙) 참고.
 *
 * 마감일이 없는 경우를 「상시 모집」이라 부르지 않는다 — 상시 모집은 폐지했다(등록 폼에서 마감일은
 * 필수). 여기 걸리는 건 그 결정 이전에 만들어진 옛 시드뿐이라 「미정」으로만 표시한다.
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
    return { label: t({ ko: '모집중 (미정)', en: 'Open (TBD)' }, locale), dotClass: 'bg-recruiting-dot' };
  }
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${todayISO()}T00:00:00Z`)) / 86_400_000);
  const dLabel = days <= 0 ? 'D-DAY' : `D-${days}`;
  const closingSoon = days <= 3;
  return {
    label: t({ ko: `모집중 (${dLabel})`, en: `Open (${dLabel})` }, locale),
    dotClass: closingSoon ? 'bg-closingsoon-dot' : 'bg-recruiting-dot',
  };
}
