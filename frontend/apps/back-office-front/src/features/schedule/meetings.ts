import { addDaysYmd, dayLabel, dowOf, DOW_LABEL, type StudyTz, tzAbbr, zonedInstant } from './time';

/**
 * 반(STUDY_GROUP)과 회차(STUDY_MEETING).
 *
 * 회차는 스터디가 아니라 **반**에 붙는다. 표·회차 추가 창·검사 규칙은 사용자 사이트 스터디 일정과 같다
 * (01-planning/stories/navigator-register-sessions/PRD.md). 다른 점은 백오피스가 반을 골라 본다는 것뿐이다.
 *
 * 킥오프는 반마다 하나, 0회차다. 지우지 않고, 발표자가 없고, 출석률에 넣지 않는다.
 * 정규 회차 번호는 저장값이 아니라 일정순이다.
 */

/** 반의 스터디 시간. 요일이 비어 있으면 아직 정하지 않은 반이다. 기간은 갖지 않는다 — 첫 회차 ~ 마지막 회차다. */
export type GroupTime = {
  /** 0=일 … 6=토. 주 2회 스터디가 있어 복수다. */
  weekdays: number[];
  /** HH:mm — 아래 시간대의 벽시계. */
  time: string;
  tz: StudyTz;
};

export type ScheduleGroup = {
  id: string;
  title: string;
  time: GroupTime;
};

export type Meeting = {
  id: string;
  /** 킥오프 0, 정규 회차는 일정순으로 1부터. */
  no: number;
  kind?: 'kickoff';
  /** 저장값 — UTC ISO. */
  scheduledAt: string;
  /** 반 시간대로 계산한 일자·시각. */
  date: string;
  time: string;
  title: string;
  /** 발표자 — 그 반 참가자 ID. 비었으면 ''. */
  presenter1: string;
  presenter2: string;
  /** 서버가 판정한 「시작한 회차」 — 시각이 지났거나 디스코드에서 일찍 시작했다. 없으면 시각으로만 본다. */
  started?: boolean;
};

/** 발표자로 고를 수 있는 그 반 참가자. */
export type Person = { id: string; name: string };

export const TITLE_MAX = 50;
/** 반복으로 한 번에 만들 수 있는 기간(시작 일자 포함 일수). */
export const REPEAT_SPAN_DAYS = 31;
export const RULES_MAX = 500;
export const DEFAULT_TIME = '20:00';

export function hasTime(group: ScheduleGroup): boolean {
  return group.time.weekdays.length > 0;
}

/** 정보 카드의 「스터디 시간」 — 「매주 금요일 19:00 PDT」. */
export function groupTimeLabel(time: GroupTime): string {
  const days = time.weekdays.map((d) => `${DOW_LABEL[d]}요일`).join(' · ');
  if (!days) return '미정';
  return `매주 ${days}${time.time ? ` ${time.time} ${tzAbbr(time.tz)}` : ''}`;
}

export function isKickoff(m: Pick<Meeting, 'kind'>): boolean {
  return m.kind === 'kickoff';
}

/** 「킥오프」 또는 「3회차」. */
export function meetingLabel(m: Pick<Meeting, 'kind' | 'no'>): string {
  return isKickoff(m) ? '킥오프' : `${m.no}회차`;
}

export function maxUntil(date: string): string {
  return date ? addDaysYmd(date, REPEAT_SPAN_DAYS - 1) : '';
}

/* ── 초안 → 계획 ─────────────────────────────────────────────────────────── */

export type Repeat = 'none' | 'daily' | 'weekly';

export type MeetingDraft = {
  date: string;
  time: string;
  title: string;
  repeat: Repeat;
  until: string;
  /** 매주 반복의 요일. 0 = 일 … 6 = 토. */
  weekdays: number[];
};

export type DraftErrors = Partial<Record<keyof MeetingDraft | 'form', string>>;

export type MeetingPlan = {
  /** 실제로 만들어질 날짜들. */
  dates: string[];
  /** 반복 중 건너뛴 날짜와 이유. */
  skipped: { date: string; reason: string }[];
};

type Dated = Pick<Meeting, 'id' | 'date' | 'no' | 'kind'>;

function expand(draft: MeetingDraft): string[] {
  if (draft.repeat === 'none' || !draft.until) return [draft.date];
  const out: string[] = [];
  for (let d = draft.date; d <= draft.until; d = addDaysYmd(d, 1)) {
    if (draft.repeat === 'daily' || draft.weekdays.includes(dowOf(d))) out.push(d);
  }
  return out;
}

/**
 * 초안을 검사하고 만들 날짜를 정한다.
 *
 * 한 번만 만들 때는 겹치는 날이 곧 오류다. 반복일 때는 겹치는 날만 건너뛰고 나머지를 만든다 —
 * 휴일 하나 때문에 반복 전체가 막히지 않게.
 */
export function planDraft(
  draft: MeetingDraft,
  existing: Dated[],
  timeZone: string,
  now = new Date(),
): { errors: DraftErrors; plan?: MeetingPlan } {
  const errors: DraftErrors = {};
  if (!draft.date) errors.date = '일자를 정해 주세요.';
  if (!draft.time) errors.time = '시작 시각을 정해 주세요.';
  if (draft.title.trim().length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자까지 쓸 수 있습니다.`;
  if (draft.repeat === 'weekly' && draft.weekdays.length === 0)
    errors.weekdays = '반복할 요일을 하나 이상 골라 주세요.';
  if (draft.repeat !== 'none') {
    if (!draft.until) errors.until = '반복 종료일을 정해 주세요.';
    else if (draft.date && draft.until < draft.date) errors.until = '종료일은 시작 일자보다 뒤여야 합니다.';
    else if (draft.date && draft.until > maxUntil(draft.date))
      errors.until = `반복은 시작 일자부터 ${REPEAT_SPAN_DAYS}일 안에서만 만들 수 있습니다 (${dayLabel(maxUntil(draft.date))}까지).`;
  }
  if (errors.date || errors.time || errors.until || errors.weekdays) return { errors };

  const dates = expand(draft);
  if (dates.length === 0) {
    errors.form = '고른 기간에 반복할 요일이 없습니다. 요일이나 종료일을 바꿔 주세요.';
    return { errors };
  }

  const byDate = new Map(existing.map((m) => [m.date, m]));
  const past = (d: string) => zonedInstant(d, draft.time, timeZone).getTime() <= now.getTime();
  // 정규 회차는 킥오프 다음에 온다 — 킥오프에서 일정을 정하기 때문이다.
  const kickoff = existing.find(isKickoff);
  if (kickoff && dates[0] <= kickoff.date) {
    errors.date = `킥오프(${dayLabel(kickoff.date)}) 뒤로만 회차를 만들 수 있습니다.`;
    return { errors };
  }

  if (draft.repeat === 'none') {
    const same = byDate.get(draft.date);
    // 하루에 회차 하나 — 출석·주간 일정이 날짜로 회차를 찾는다.
    if (same) errors.date = `이 날에는 이미 ${meetingLabel(same)}가 있습니다.`;
    else if (past(draft.date)) errors.time = '지난 시각으로는 회차를 만들 수 없습니다.';
    if (Object.keys(errors).length) return { errors };
    return { errors, plan: { dates, skipped: [] } };
  }

  if (past(dates[0])) {
    errors.time = '첫 회차가 지난 시각입니다. 시작 일자나 시각을 바꿔 주세요.';
    return { errors };
  }
  const skipped: MeetingPlan['skipped'] = [];
  const keep: string[] = [];
  for (const d of dates) {
    const same = byDate.get(d);
    if (same) skipped.push({ date: d, reason: `이미 ${meetingLabel(same)}` });
    else keep.push(d);
  }
  if (keep.length === 0) {
    errors.form = '고른 기간의 모든 날에 이미 회차가 있습니다.';
    return { errors };
  }
  return { errors, plan: { dates: keep, skipped } };
}

/** 회차 한 줄을 고칠 때의 검사. 자기 자신과는 겹침을 따지지 않는다. 킥오프는 표에서 고치지 않는다 — `validateKickoff`. */
export function validateEdit(
  edit: { date: string; time: string; title: string },
  selfId: string,
  existing: Dated[],
  timeZone: string,
  now = new Date(),
): DraftErrors {
  const others = existing.filter((m) => m.id !== selfId);
  return planDraft({ ...edit, repeat: 'none', until: '', weekdays: [] }, others, timeZone, now).errors;
}

/**
 * 「킥오프 정하기 · 수정」 검사. 지난 날도 받는다 — 운영 중인 반의 킥오프를 나중에 적는다.
 * 1회차 날이나 그 뒤면 막고(서버 400), 다른 회차와 같은 날이면 막는다(서버 409 MEETING_DATE_CONFLICT).
 */
export function validateKickoff(input: { date: string; time: string }, existing: Dated[]): DraftErrors {
  const errors: DraftErrors = {};
  if (!input.date) errors.date = '일자를 정해 주세요.';
  if (!input.time) errors.time = '시작 시각을 정해 주세요.';
  if (errors.date) return errors;
  const regular = existing.filter((m) => !isKickoff(m));
  const firstRegular = regular.map((m) => m.date).sort()[0];
  const same = regular.find((m) => m.date === input.date);
  if (same) errors.date = `이 날에는 이미 ${meetingLabel(same)}가 있습니다.`;
  else if (firstRegular && input.date >= firstRegular)
    errors.date = `킥오프는 1회차(${dayLabel(firstRegular)})보다 앞이어야 합니다.`;
  return errors;
}

/** 새 회차들이 몇 회차부터 몇 회차가 되는지, 뒤 회차 몇 개가 밀리는지, 기간이 늘어나는지. */
export function previewOf(plan: MeetingPlan, all: Dated[]) {
  const existing = all
    .filter((m) => !isKickoff(m))
    .map((m) => m.date)
    .sort();
  const merged = [...existing, ...plan.dates].sort();
  const nos = plan.dates.map((d) => merged.indexOf(d) + 1);
  const first = plan.dates[0];
  const lastNew = plan.dates[plan.dates.length - 1];
  const lastOld = existing[existing.length - 1];
  return {
    from: Math.min(...nos),
    to: Math.max(...nos),
    shifted: existing.filter((d) => d > first).length,
    extendsTo: lastOld && lastNew > lastOld ? lastNew : undefined,
  };
}

/** 기본 날짜 — 마지막 회차 다음 주 같은 요일. 그게 지났으면 오늘 이후 첫 같은 요일. */
export function defaultDate(existing: Dated[], today: string): string {
  const last = existing
    .filter((m) => !isKickoff(m))
    .map((m) => m.date)
    .sort()
    .at(-1);
  if (!last) return addDaysYmd(today, 7);
  let next = addDaysYmd(last, 7);
  while (next <= today) next = addDaysYmd(next, 7);
  return next;
}

/** 반복을 켰을 때의 기본 종료일 — 매주는 4주 뒤(5회), 매일은 2주. 둘 다 31일 안이다. */
export function defaultUntil(date: string, repeat: Repeat): string {
  if (!date || repeat === 'none') return '';
  return addDaysYmd(date, repeat === 'weekly' ? 28 : 13);
}
