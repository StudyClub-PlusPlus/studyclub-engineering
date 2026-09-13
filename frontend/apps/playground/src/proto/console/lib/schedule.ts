import type { Study, StudyMeeting } from '@studyclub/mock';

/**
 * 진행 일정 규칙 → 회차.
 *
 * 회차는 **스터디가 만들어질 때 정해지지 않는다.** 요일·시간은 크루가 모인 뒤 물어서 정하기 때문에,
 * 등록 시점에는 비어 있고 정보 탭에서 나중에 채워진다. 그 규칙이 채워지는 순간 출석부의 가로축이 생긴다.
 *
 * 규칙이 낳지 못하는 예외(이번 주만 목요일·휴강·보강)는 출석 탭에서 회차를 직접 손본다.
 * 여기는 규칙만 다룬다.
 */

/**
 * 스터디가 도는 시간대.
 *
 * **약어(PST/PDT)를 값으로 쓰지 않는다.** PST 는 겨울(−8), PDT 는 여름(−7)이라 서머타임 전환 주에
 * 한 시간이 어긋난다. 저장은 지역 ID 로 하고, 화면에 붙는 이름만 그날 기준으로 찍는다.
 *
 * 선택지는 둘뿐이다 — 모이는 권역이 한국과 미국 서부 두 곳이고, 동부를 쓰는 스터디가 하나도 없다.
 */
export type StudyTz = 'Asia/Seoul' | 'America/Los_Angeles';

export const STUDY_TZS: { key: StudyTz; label: string }[] = [
  { key: 'Asia/Seoul', label: '한국' },
  { key: 'America/Los_Angeles', label: '미국 서부' },
];

export type ScheduleRule = {
  /** 시작일 · 종료일 (yyyy-mm-dd). 회차가 놓일 구간. */
  startDate: string;
  endDate: string;
  /** 모이는 요일. 0=일 … 6=토. 주 2회 스터디가 있어 복수다. */
  weekdays: number[];
  /** 모이는 시각 (HH:mm). **아래 시간대의 벽시계**다. */
  time: string;
  /** 요일·시각을 읽는 기준 시간대. */
  tz: StudyTz;
};

export const EMPTY_RULE: ScheduleRule = {
  startDate: '',
  endDate: '',
  weekdays: [],
  time: '',
  tz: 'Asia/Seoul',
};

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 회차를 만들 수 있는 규칙인가. 시각은 없어도 날짜는 나온다 — 회차 생성의 조건이 아니다. */
export function canBuildMeetings(rule: ScheduleRule): boolean {
  return Boolean(rule.startDate && rule.endDate && rule.weekdays.length > 0 && rule.startDate <= rule.endDate);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function weekdayOf(iso: string): number {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

/** 규칙이 낳는 회차 날짜. 시작일부터 종료일까지 고른 요일에 해당하는 날. */
export function ruleDates(rule: ScheduleRule): string[] {
  if (!canBuildMeetings(rule)) return [];
  const days = new Set(rule.weekdays);
  const out: string[] = [];
  // 스터디 기간이 아무리 길어도 한 해를 넘기지 않는다 — 잘못 넣은 종료일로 화면이 멈추면 안 된다.
  for (let d = rule.startDate, guard = 0; d <= rule.endDate && guard < 400; d = addDays(d, 1), guard += 1) {
    if (days.has(weekdayOf(d))) out.push(d);
  }
  return out;
}

/**
 * 규칙을 회차에 반영한다.
 *
 * **지난 회차는 건드리지 않는다.** 출석을 이미 찍었는데 요일을 바꿨다고 기록이 사라지면,
 * 운영자는 규칙을 고치는 것 자체를 겁내게 된다. 오늘 이후 회차만 다시 깐다.
 */
export function applyRule(studyId: string, prev: StudyMeeting[], rule: ScheduleRule, today: string): StudyMeeting[] {
  const kept = prev.filter((m) => m.date < today);
  const keptDates = new Set(kept.map((m) => m.date));
  const added = ruleDates(rule)
    .filter((date) => date >= today && !keptDates.has(date))
    .map((date) => ({ id: `${studyId}-r${date}`, no: 0, date }));

  return [...kept, ...added].sort((a, b) => a.date.localeCompare(b.date)).map((m, i) => ({ ...m, no: i + 1 }));
}

/**
 * 이미 있는 회차에서 규칙을 되읽는다.
 *
 * 프로토는 회차를 mock 으로 들고 있다. 정보 탭을 열었을 때 칸이 비어 있으면 「정한 적 없다」로 읽히므로,
 * 회차가 있으면 그 회차가 서 있는 요일·구간을 규칙으로 되돌려 보여 준다.
 */
export function ruleFromMeetings(study: Study, meetings: StudyMeeting[]): ScheduleRule {
  if (meetings.length === 0) return EMPTY_RULE;
  const dates = meetings.map((m) => m.date).sort();
  const weekdays = [...new Set(dates.map(weekdayOf))].sort((a, b) => a - b);
  // 시각은 회차에 없다. 소개 문구(「매주 화 20:00」)에 적혀 있으면 그걸 쓴다.
  const text = typeof study.schedule === 'string' ? study.schedule : (study.schedule?.ko ?? '');
  const time = text.match(/(\d{1,2}):(\d{2})/);
  return {
    startDate: dates[0]!,
    endDate: dates[dates.length - 1]!,
    weekdays,
    time: time ? `${time[1]!.padStart(2, '0')}:${time[2]}` : '',
    // 기존 일정 문구에 시간대 표기가 없다. 지금까지 한국 시간으로 읽어 왔으므로 그대로 둔다.
    tz: /PST|PDT|PT\b/.test(text) ? 'America/Los_Angeles' : 'Asia/Seoul',
  };
}

/** 그 시각 그 시간대의 이름. 같은 지역도 계절에 따라 달라진다 (PST ↔ PDT). */
export function tzAbbr(tz: StudyTz, at: Date): string {
  if (tz === 'Asia/Seoul') return 'KST';
  // 미국 서부는 −7(여름)이면 PDT, −8(겨울)이면 PST.
  return tzOffsetMs(at, tz) === -7 * 3_600_000 ? 'PDT' : 'PST';
}

/** 어느 시점의 그 시간대 UTC 오프셋(ms). Intl 이 아는 규칙을 그대로 쓴다 — 직접 계산하지 않는다. */
function tzOffsetMs(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - at.getTime();
}

/** 그 시간대의 벽시계(날짜+시각)가 가리키는 실제 시점. */
export function wallToInstant(date: string, time: string, tz: StudyTz): Date {
  const naive = Date.parse(`${date}T${time || '00:00'}:00Z`);
  // 오프셋은 시점에 따라 다르다. 한 번 빼고 그 결과로 다시 확인한다 — 전환일 경계를 넘기기 위해서다.
  const first = tzOffsetMs(new Date(naive), tz);
  const second = tzOffsetMs(new Date(naive - first), tz);
  return new Date(naive - second);
}

/** 같은 시점을 다른 시간대의 벽시계로 읽는다. 예: 「수 05:00 PDT」 */
export function clockIn(at: Date, tz: StudyTz): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at);
  const p: Record<string, string> = {};
  for (const part of parts) p[part.type] = part.value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday ?? '');
  const label = dow === -1 ? '' : WEEKDAY_LABELS[dow];
  return `${label} ${p.hour}:${p.minute} ${tzAbbr(tz, at)}`;
}

/**
 * 다른 시간대에서는 몇 시인가.
 *
 * 「동시」로 모이는 스터디가 대부분이라, 한쪽 시각만 적으면 나머지 절반은 매번 환산해야 한다.
 * 요일까지 함께 적는다 — 목 21:00 KST 는 미국에서 **수요일**이다.
 */
export function otherClock(rule: ScheduleRule): string | undefined {
  if (!rule.time || rule.weekdays.length === 0) return undefined;
  const other: StudyTz = rule.tz === 'Asia/Seoul' ? 'America/Los_Angeles' : 'Asia/Seoul';
  const sample = ruleDates(rule)[0] ?? anyDateOn(rule.weekdays[0]!);
  return clockIn(wallToInstant(sample, rule.time, rule.tz), other);
}

/** 구간이 아직 없을 때 요일만으로 환산해 보이기 위한 임시 날짜. */
function anyDateOn(weekday: number): string {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + ((weekday - base.getUTCDay() + 7) % 7));
  return base.toISOString().slice(0, 10);
}

/** 규칙을 한 줄로 적는다 — 크루에게 보이는 문구와 같은 모양. */
export function ruleSummary(rule: ScheduleRule): string {
  const days = rule.weekdays.map((d) => WEEKDAY_LABELS[d]).join('·');
  if (!days) return '';
  const at = rule.startDate ? wallToInstant(rule.startDate, rule.time, rule.tz) : new Date();
  return `매주 ${days}${rule.time ? ` ${rule.time} ${tzAbbr(rule.tz, at)}` : ''}`;
}
