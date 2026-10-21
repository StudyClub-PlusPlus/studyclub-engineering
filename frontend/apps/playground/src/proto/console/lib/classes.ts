import { WEEKDAY_LABELS, tzAbbr, wallToInstant, type ScheduleRule } from '@console/lib/schedule';

/**
 * 반 (ERD `STUDY_GROUP`).
 *
 * **스터디를 만들면 「기본반」이 하나 생기고, 신청한 크루는 모두 거기 들어온다.** 반을 더 나눌지는 신청자를 보고 캡틴이 정한다.
 * 더 만드는 반은 신청자 탭에서 **제목 하나로** 태어나고, 스터디 시간(요일·시각·시간대)은 일정 탭에서 그 반에 붙인다.
 * 기본반은 첫 반이다 — 이름은 바꿀 수 있고 지울 수는 없다.
 * 기간은 저장하지 않는다 — 회차가 정본이고, 기간은 첫 회차 ~ 마지막 회차다.
 * 회차와 출석부도 반에 붙는다 — 반이 다르면 모이는 날이 다르기 때문이다.
 *
 * TODO(api): POST /api/admin/studies/{id}/groups · PATCH /api/admin/studies/{id}/groups/{groupId}
 */
export type StudyClass = {
  id: string;
  /** 반 제목 — 「A반」 「미국 금요일반」. 캡틴이 짓는다. */
  title: string;
  /** 스터디 시간(요일 · 시각 · 시간대). 반을 막 만들었으면 비어 있다(EMPTY_RULE) — 일정 탭에서 채운다. 시작일 · 종료일 칸은 쓰지 않는다. */
  rule: ScheduleRule;
};

/** 반 제목 최대 길이. */
export const CLASS_TITLE_MAX = 20;

/** 반 이름 — 캡틴이 지은 제목. 일정은 따로 적는다(`classTime`). */
export function classLabel(cls: { title: string }): string {
  return cls.title.trim() || '이름 없는 반';
}

/**
 * 스터디 시간(요일)이 정해졌는가. 기간은 반이 갖지 않는다 — 첫 회차 ~ 마지막 회차로 계산한다.
 * 회차는 일정 표의 「회차 추가」로만 만든다.
 */
export function hasSchedule(cls: StudyClass): boolean {
  return cls.rule.weekdays.length > 0;
}

/**
 * 정보 카드의 「스터디 시간」 — 「매주 금요일 19:00 PDT」. 사용자 사이트 정보 카드와 같은 말투.
 */
export function classTime(rule: ScheduleRule): string {
  const days = rule.weekdays.map((d) => `${WEEKDAY_LABELS[d]}요일`).join(' · ');
  if (!days) return '미정';
  const at = rule.startDate ? wallToInstant(rule.startDate, rule.time, rule.tz) : new Date();
  return `매주 ${days}${rule.time ? ` ${rule.time} ${tzAbbr(rule.tz, at)}` : ''}`;
}
