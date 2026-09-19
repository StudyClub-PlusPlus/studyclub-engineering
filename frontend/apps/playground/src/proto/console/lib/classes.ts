import {
  EMPTY_RULE,
  WEEKDAY_LABELS,
  tzAbbr,
  wallToInstant,
  type ScheduleRule,
  type StudyTz,
} from '@console/lib/schedule';
import type { Crew } from '@studyclub/mock';

/**
 * 반 (ERD `STUDY_CLASS`).
 *
 * **반은 모집 전에 만들 수 없다.** 신청자가 낸 가능한 시간을 모아야 몇 시로 몇 개를 열지 정해진다.
 * 그래서 반은 크루 탭에서 태어나고, 요일·시간·시간대는 스터디가 아니라 **반**이 갖는다.
 * 회차와 출석부도 반에 붙는다 — 반이 다르면 모이는 날이 다르기 때문이다.
 *
 * TODO(api): POST /api/studies/{id}/classes · PATCH /api/classes/{id}
 */
export type StudyClass = {
  id: string;
  rule: ScheduleRule;
};

/** 가능한 시간 격자의 축. 신청 팝업이 받는 값과 같은 키를 쓴다 — 받은 그대로 세야 한다. */
export const AVAIL_DAYS = [
  { key: 'sun', label: '일', weekday: 0 },
  { key: 'mon', label: '월', weekday: 1 },
  { key: 'tue', label: '화', weekday: 2 },
  { key: 'wed', label: '수', weekday: 3 },
  { key: 'thu', label: '목', weekday: 4 },
  { key: 'fri', label: '금', weekday: 5 },
  { key: 'sat', label: '토', weekday: 6 },
] as const;

export const AVAIL_SLOTS = [
  { key: 'morning', label: '오전', time: '10:00' },
  { key: 'afternoon', label: '오후', time: '14:00' },
  { key: 'evening', label: '저녁', time: '20:00' },
] as const;

/**
 * 크루가 낸 가능한 시간.
 *
 * 프로토에는 신청 응답이 없어 크루 id 로 만들어 둔다. 사람마다 고정이라 새로고침해도 집계가 흔들리지 않는다.
 * TODO(api): STUDY_APPLICATION.FORM_ANSWER 의 가능 시간 응답으로 교체
 */
export function availabilityOf(crew: Crew): string[] {
  let seed = 0;
  for (let i = 0; i < crew.id.length; i++) seed = (seed * 31 + crew.id.charCodeAt(i)) % 100_000;
  // 저녁이 가장 흔하다 — 직장인이 대부분이라 실제 응답도 그렇게 몰린다.
  const slots = ['evening', 'evening', 'afternoon', 'evening', 'morning'];
  const picks = 2 + (seed % 3);
  const out = new Set<string>();
  for (let i = 0; i < picks; i++) {
    const day = AVAIL_DAYS[(seed + i * 3) % AVAIL_DAYS.length]!.key;
    const slot = slots[(seed + i * 5) % slots.length]!;
    out.add(`${day}-${slot}`);
  }
  return [...out];
}

/** 칸마다 몇 명이 가능한가. 겹치는 시간을 눈으로 찾기 위한 표다. */
export function tallyAvailability(crew: Crew[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of crew) {
    for (const cell of availabilityOf(c)) out[cell] = (out[cell] ?? 0) + 1;
  }
  return out;
}

/** 그 칸이 되는 사람들. 반을 만들 때 누가 들어올지 미리 보여 준다. */
export function crewOnCell(crew: Crew[], cell: string): Crew[] {
  return crew.filter((c) => availabilityOf(c).includes(cell));
}

/**
 * 반 이름 = **그 반의 일정**. 「수 20:00 KST」
 *
 * 이름을 따로 받지 않는다. 반을 가르는 것이 곧 시간이라 이름을 따로 지으면 둘이 어긋난다 —
 * 「목요일반」이 수요일로 옮겨가는 순간 이름이 거짓말이 된다.
 */
export function classLabel(cls: { rule: ScheduleRule }): string {
  const days = cls.rule.weekdays.map((d) => WEEKDAY_LABELS[d]).join('·');
  if (!days) return '일정 미정';
  const at = cls.rule.startDate ? wallToInstant(cls.rule.startDate, cls.rule.time, cls.rule.tz) : new Date();
  return `${days} ${cls.rule.time || ''} ${tzAbbr(cls.rule.tz, at)}`.replace(/\s+/g, ' ').trim();
}

/** 가능 시간 칸 하나를 반의 규칙으로 옮긴다. 시간대는 고르는 사람이 정한다. */
export function ruleFromCell(cell: string, tz: StudyTz): ScheduleRule {
  const [dayKey, slotKey] = cell.split('-');
  const day = AVAIL_DAYS.find((d) => d.key === dayKey);
  const slot = AVAIL_SLOTS.find((s) => s.key === slotKey);
  return {
    ...EMPTY_RULE,
    weekdays: day ? [day.weekday] : [],
    time: slot?.time ?? '',
    tz,
  };
}

/** 반의 구간 — 「2026-10-05 ~ 2026-11-09」. 이름(일정)이 말하지 않는 나머지다. */
export function classPeriod(cls: StudyClass): string {
  if (!cls.rule.startDate || !cls.rule.endDate) return '';
  return `${cls.rule.startDate} ~ ${cls.rule.endDate}`;
}
