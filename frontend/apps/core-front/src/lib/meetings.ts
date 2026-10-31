'use client';

import type { Study, StudyMeeting } from '@studyclub/mock';

import { scheduleZoneTitle, zoneAbbreviation, zoneSymbol } from '@/lib/schedule-timezone';
import { formattingZone } from '@/lib/time-zone-rules';

/**
 * 네비게이터가 관리하는 회차 (ERD `STUDY_MEETING`).
 *
 * 회차는 스터디가 아니라 **분반(STUDY_GROUP)** 에 붙는다. 네비게이터 권한도 맡은 분반 안에서만 선다.
 * 추가·삭제는 브라우저에만 남는다 — 저장할 서버가 아직 없다.
 *
 * TODO(api): POST   /api/studies/{id}/groups/{groupId}/meetings — { scheduledAt[](UTC), title? }
 *            DELETE /api/studies/{id}/groups/{groupId}/meetings/{meetingId}
 */

export type ProtoMeeting = StudyMeeting & {
  scheduledAt?: string;
  time?: string;
  title?: string;
  seriesId?: string;
  kind?: 'kickoff';
  presenter1?: string;
  presenter2?: string;
};

export type NavigatorGroup = {
  id: string;
  name: string;
  timeZone: string;
  startAt: string;
  weekdays?: number[];
};

export type ManageRole = 'navigator' | 'captain';
export const MANAGE_ROLE_LABEL: Record<ManageRole, string> = { navigator: '네비게이터', captain: '캡틴' };

export type ScheduleRole = ManageRole | 'crew';
export const SCHEDULE_ROLE_LABEL: Record<ScheduleRole, string> = { ...MANAGE_ROLE_LABEL, crew: '크루' };

const DEFAULT_ZONE = 'Asia/Seoul';

export const TITLE_MAX = 50;
export const REPEAT_SPAN_DAYS = 31;

export function maxUntil(date: string): string {
  return date ? addDaysYmd(date, REPEAT_SPAN_DAYS - 1) : '';
}

/* ── 저장소 ─────────────────────────────────────────────────────────────── */

const ADDED_KEY = 'sc_added_meetings';
const DELETED_KEY = 'sc_deleted_meetings';
const EDITED_KEY = 'sc_edited_meetings';

type Edit = {
  scheduledAt?: string;
  date?: string;
  time?: string;
  title?: string;
  presenter1?: string;
  presenter2?: string;
};

type Stored = Edit & { id: string; seriesId?: string };

function readJSON<T>(key: string): Record<string, T[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Record<string, T[]>) : {};
  } catch {
    return {};
  }
}

function writeJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

export function addMeetings(
  studyId: string,
  input: { dates: string[]; time: string; timeZone: string; title?: string; scheduledAts?: string[] },
): void {
  const store = readJSON<Stored>(ADDED_KEY);
  const title = input.title?.trim() || undefined;
  const stamp = Date.now();
  const seriesId = input.dates.length > 1 ? `r${stamp}` : undefined;
  const rows: Stored[] = input.dates.map((date, i) => ({
    id: `${studyId}-a${stamp}-${i}`,
    scheduledAt: input.scheduledAts?.[i] ?? zonedInstant(date, input.time, input.timeZone).toISOString(),
    title,
    seriesId,
  }));
  store[studyId] = [...(store[studyId] ?? []), ...rows];
  writeJSON(ADDED_KEY, store);
}

function readEdits(): Record<string, Record<string, Edit>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(EDITED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Record<string, Edit>>) : {};
  } catch {
    return {};
  }
}

function withWall<T extends { scheduledAt?: string; date?: string; time?: string }>(row: T, timeZone: string): T {
  const scheduledAt =
    row.scheduledAt ?? (row.date && row.time ? zonedInstant(row.date, row.time, timeZone).toISOString() : undefined);
  if (!scheduledAt) return row;
  return { ...row, scheduledAt, ...wallParts(new Date(scheduledAt), timeZone) };
}

/* ── 킥오프 ─────────────────────────────────────────────────────────────── */

export function isKickoff(m: StudyMeeting): boolean {
  return (
    (m as ProtoMeeting).kind === 'kickoff' ||
    m.no === 0 ||
    (m as { type?: string }).type === 'KICKOFF' ||
    (m as ProtoMeeting).title === '킥오프'
  );
}

export function meetingLabel(m: StudyMeeting): string {
  return isKickoff(m) ? '킥오프' : `${m.no}회차`;
}

function kickoffOf(base: StudyMeeting[], studyId: string): ProtoMeeting | undefined {
  const first = [...base].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!first) return undefined;
  return { id: `${studyId}-kickoff`, no: 0, date: addDaysYmd(first.date, -7), kind: 'kickoff', title: '킥오프' };
}

const wallKey = (m: StudyMeeting) => `${m.date} ${(m as ProtoMeeting).time ?? ''}`;

export function withAdded(base: StudyMeeting[], studyId: string, zone = DEFAULT_ZONE): ProtoMeeting[] {
  const added = (readJSON<Stored>(ADDED_KEY)[studyId] ?? []).map(
    (m) => ({ ...withWall(m, zone), no: 0 }) as ProtoMeeting,
  );
  const deleted = new Set(readJSON<string>(DELETED_KEY)[studyId] ?? []);
  const edits = readEdits()[studyId] ?? {};
  const kickoff = kickoffOf(base, studyId);
  const kept: ProtoMeeting[] = [...(kickoff ? [kickoff] : []), ...base]
    .filter((m) => !deleted.has(m.id))
    .map((m) => (edits[m.id] ? ({ ...m, ...withWall(edits[m.id], zone) } as ProtoMeeting) : m));
  const all = [...kept, ...added];
  const regular = all
    .filter((m) => !isKickoff(m))
    .sort((a, b) => wallKey(a).localeCompare(wallKey(b)))
    .map((m, i) => ({ ...m, no: i + 1 }));
  return [...all.filter(isKickoff).map((m) => ({ ...m, no: 0 })), ...regular];
}

/* ── 날짜·시각 ───────────────────────────────────────────────────────────── */

function zonedParts(instant: Date, iana: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: formattingZone(iana, instant),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

function offsetMs(instant: Date, iana: string): number {
  const p = zonedParts(instant, iana);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

export function zonedInstant(date: string, time: string, iana: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMs(new Date(guess), iana);
  return new Date(guess - offsetMs(new Date(first), iana));
}

export function wallParts(instant: Date, iana: string): { date: string; time: string } {
  const p = zonedParts(instant, iana);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

export type WallTimeChoice = { scheduledAt: string; label: string };

/** 같은 날짜·시각에 해당하는 모든 순간을 전환 전후의 시차로 찾는다. */
export function wallTimeChoices(date: string, time: string, zone: string): WallTimeChoice[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const guess = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(guess)) return [];
  const offsets = new Set([-2, -1, 0, 1, 2].map((day) => offsetMs(new Date(guess + day * 86_400_000), zone)));
  const instants = [...offsets]
    .map((offset) => new Date(guess - offset))
    .filter((at) => {
      const wall = wallParts(at, zone);
      return wall.date === date && wall.time === time;
    })
    .sort((a, b) => a.getTime() - b.getTime());
  return instants.map((at, index) => ({
    scheduledAt: at.toISOString(),
    label: `${time} · ${instants.length > 1 ? `시계 전환 ${index === 0 ? '전' : '후'} ` : ''}(${zoneLabel(zone, at)})`,
  }));
}

/** 같은 날짜·시각으로 돌아오면 원래 순간을 유지한다. 새 중복 시각은 사용자가 골라야 한다. */
export function resolveWallInput(
  date: string,
  time: string,
  zone: string,
  preferred: (string | undefined)[] = [],
): { errors: DraftErrors; instant?: Date; choices: WallTimeChoice[] } {
  const choices = wallTimeChoices(date, time, zone);
  if (!date || !time)
    return {
      choices,
      errors: {
        ...(!date && { date: '일자를 정해 주세요.' }),
        ...(!time && { time: '시작 시각을 정해 주세요.' }),
      },
    };
  if (choices.length === 0)
    return {
      choices,
      errors: { time: '올바른 날짜와 시각을 입력해 주세요. 시계 전환으로 사라지는 시각은 선택할 수 없어요.' },
    };
  for (const value of preferred) {
    if (!value) continue;
    const at = new Date(value);
    if (!Number.isFinite(at.getTime())) continue;
    const wall = wallParts(at, zone);
    if (wall.date === date && wall.time === time) return { choices, errors: {}, instant: at };
  }
  if (choices.length > 1)
    return { choices, errors: { time: '같은 시각이 두 번 있어요. 시계 전환 전후 중 하나를 선택해 주세요.' } };
  return { choices, errors: {}, instant: new Date(choices[0].scheduledAt) };
}

export function wallInputErrors(date: string, time: string, zone: string): DraftErrors {
  return resolveWallInput(date, time, zone).errors;
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function scheduleLabel(instant: Date, iana: string): string {
  const { date, time } = wallParts(instant, iana);
  return `${date} ${time}`;
}

export function zoneLabel(iana: string, at?: Date): string {
  return at ? zoneAbbreviation(iana, at) : zoneSymbol(iana);
}

export function zoneTitle(iana: string, at?: Date): string {
  return scheduleZoneTitle(iana, 'ko', at);
}

export function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}(${DOW[dowOf(ymd)]})`;
}

export function dateWithDow(ymd: string): string {
  return `${ymd} (${DOW[dowOf(ymd)]})`;
}

export function dowOf(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const DOW_LABEL = DOW;

export function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/* ── 초안 → 계획 ─────────────────────────────────────────────────────────── */

export type Repeat = 'none' | 'daily' | 'weekly';

export type MeetingDraft = {
  date: string;
  time: string;
  title: string;
  repeat: Repeat;
  until: string;
  weekdays: number[];
  /** 중복되는 현지 시각에서 사용자가 선택한 날짜별 UTC 순간. */
  occurrences?: Record<string, string>;
};

export type DraftErrors = Partial<Record<keyof MeetingDraft | 'form', string>>;

export type Skip = { date: string; reason: string };

export type MeetingPlan = {
  scheduledAts: string[];
  dates: string[];
  skipped: Skip[];
};

function expand(draft: MeetingDraft): string[] {
  if (draft.repeat === 'none' || !draft.until) return [draft.date];
  const out: string[] = [];
  for (let d = draft.date; d <= draft.until; d = addDaysYmd(d, 1)) {
    if (draft.repeat === 'daily' || draft.weekdays.includes(dowOf(d))) out.push(d);
  }
  return out;
}

export function planDraft(
  draft: MeetingDraft,
  existing: StudyMeeting[],
  timeZone: string,
  now = new Date(),
  calendarZone = timeZone,
): { errors: DraftErrors; plan?: MeetingPlan; ambiguousTimes?: { date: string; choices: WallTimeChoice[] }[] } {
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
  if (dates.length === 0)
    return { errors: { form: '고른 기간에 반복할 요일이 없습니다. 요일이나 종료일을 바꿔 주세요.' } };
  const resolved = dates.map((date) => ({
    date,
    ...resolveWallInput(date, draft.time, timeZone, [draft.occurrences?.[date]]),
  }));
  const ambiguousTimes = resolved.filter((r) => r.choices.length > 1).map(({ date, choices }) => ({ date, choices }));
  const invalid = resolved.find((r) => !r.instant);
  if (invalid) return { errors: { ...errors, time: `${invalid.date}: ${invalid.errors.time}` }, ambiguousTimes };
  const instants = new Map(resolved.map((r) => [r.date, r.instant!]));
  const calendarDate = (date: string) => wallParts(instants.get(date)!, calendarZone).date;
  const past = (date: string) => instants.get(date)!.getTime() <= now.getTime();
  const byDate = new Map(existing.map((m) => [m.date, m]));
  const kickoff = existing.find(isKickoff);
  if (kickoff && calendarDate(dates[0]) <= kickoff.date) {
    errors.date = `킥오프(${dayLabel(kickoff.date)}${calendarZone === timeZone ? '' : ` ${zoneTitle(calendarZone)} 기준`}) 뒤로만 회차를 만들 수 있습니다.`;
    return { errors, ambiguousTimes };
  }
  if (past(dates[0])) {
    errors.time = '첫 회차가 지난 시각입니다. 시작 일자나 시각을 바꿔 주세요.';
    return { errors, ambiguousTimes };
  }

  const skipped: Skip[] = [];
  const keep: string[] = [];
  const plannedDays = new Set<string>();
  for (const date of dates) {
    const day = calendarDate(date);
    const same = byDate.get(day);
    if (same && draft.repeat === 'none') {
      errors.date = `이 날에는 이미 ${same.no}회차가 있습니다.`;
      return { errors, ambiguousTimes };
    }
    if (same) skipped.push({ date, reason: `이미 ${same.no}회차` });
    else if (plannedDays.has(day)) skipped.push({ date, reason: '반 기준으로 이번 반복의 다른 회차와 같은 날' });
    else {
      keep.push(date);
      plannedDays.add(day);
    }
  }
  if (keep.length === 0)
    return { errors: { ...errors, form: '고른 기간의 모든 날에 이미 회차가 있습니다.' }, ambiguousTimes };

  // 서버는 생성할 회차의 반 현지 날짜 max-min <= 30일을 검사한다. 입력 지역의 31일과 별개다.
  const calendarDates = keep.map(calendarDate).sort();
  const lastAllowed = maxUntil(calendarDates[0]);
  if (calendarDates[calendarDates.length - 1] > lastAllowed) {
    const inputUntil = keep.filter((date) => calendarDate(date) <= lastAllowed).at(-1)!;
    errors.until = `${zoneTitle(calendarZone)} 기준으로 ${REPEAT_SPAN_DAYS}일 범위를 넘어요. 입력 종료일을 ${inputUntil}까지로 줄여 주세요.`;
    return { errors, ambiguousTimes };
  }
  if (Object.keys(errors).length) return { errors, ambiguousTimes };
  return {
    errors,
    ambiguousTimes,
    plan: { dates: keep, skipped, scheduledAts: keep.map((date) => instants.get(date)!.toISOString()) },
  };
}

/** 회차 하나를 고칠 때의 검사. 자기 자신과는 겹침을 따지지 않는다. */
export function validateEdit(
  edit: { date: string; time: string; title: string; scheduledAt?: string },
  selfId: string,
  existing: StudyMeeting[],
  timeZone: string,
  now = new Date(),
): DraftErrors {
  const others = existing.filter((m) => m.id !== selfId);
  const self = existing.find((m) => m.id === selfId) as ProtoMeeting | undefined;
  const scheduledAt = edit.scheduledAt ?? self?.scheduledAt;
  const errors = planDraft(
    { ...edit, repeat: 'none', until: '', weekdays: [], occurrences: scheduledAt ? { [edit.date]: scheduledAt } : {} },
    others,
    timeZone,
    now,
  ).errors;
  const firstRegular = others.filter((m) => !isKickoff(m))[0];
  if (self && isKickoff(self) && !errors.date && firstRegular && edit.date >= firstRegular.date) {
    errors.date = `킥오프는 1회차(${dayLabel(firstRegular.date)})보다 앞이어야 합니다.`;
  }
  return errors;
}

export function previewOf(plan: Pick<MeetingPlan, 'dates'>, all_: StudyMeeting[]) {
  const existing = all_.filter((m) => !isKickoff(m));
  const all = [...existing.map((m) => m.date), ...plan.dates].sort();
  const nos = plan.dates.map((d) => all.indexOf(d) + 1);
  const first = plan.dates[0];
  const lastNew = plan.dates[plan.dates.length - 1];
  const lastOld = existing[existing.length - 1]?.date;
  return {
    from: Math.min(...nos),
    to: Math.max(...nos),
    shifted: existing.filter((m) => m.date > first).length,
    extendsTo: lastOld && lastNew > lastOld ? lastNew : undefined,
  };
}

export function defaultDate(existing: StudyMeeting[], today: string): string {
  const last = existing[existing.length - 1]?.date;
  if (!last) return addDaysYmd(today, 7);
  let next = addDaysYmd(last, 7);
  while (next <= today) next = addDaysYmd(next, 7);
  return next;
}

export function defaultUntil(date: string, repeat: Repeat): string {
  if (!date || repeat === 'none') return '';
  return addDaysYmd(date, repeat === 'weekly' ? 28 : 13);
}

/* ── 스터디 바로가기 ─────────────────────────────────────────────────────── */

export function canOpenDiscord(study: Study): boolean {
  return Boolean(study.discord_url);
}

export function canOpenDrive(study: Study): boolean {
  return Boolean(study.driveUrl);
}

export function discordUrl(study: Study): string | undefined {
  return study.discord_url ?? undefined;
}

export function driveUrl(study: Study): string | undefined {
  return study.driveUrl ?? undefined;
}

export function initialMeetingDraft(
  group: NavigatorGroup,
  existing: StudyMeeting[],
  inputZone: string,
  now = new Date(),
): MeetingDraft {
  const today = wallParts(now, group.timeZone).date;
  const weekly = !existing.some((m) => !isKickoff(m)) && Boolean(group.weekdays?.length);
  let date = defaultDate(existing, today);
  if (weekly) {
    date = addDaysYmd(today, 1);
    while (!group.weekdays!.includes(dowOf(date))) date = addDaysYmd(date, 1);
  }
  if (!group.startAt)
    return { date: wallParts(now, inputZone).date, time: '', title: '', repeat: 'none', until: '', weekdays: [] };
  const wall = wallParts(zonedInstant(date, group.startAt, group.timeZone), inputZone);
  const weekdays = weekly
    ? [
        ...new Set(
          group.weekdays!.map((day) => {
            const groupDate = addDaysYmd(date, (day - dowOf(date) + 7) % 7);
            return dowOf(wallParts(zonedInstant(groupDate, group.startAt, group.timeZone), inputZone).date);
          }),
        ),
      ].sort()
    : [];
  return {
    ...wall,
    title: '',
    repeat: weekly ? 'weekly' : 'none',
    until: weekly ? defaultUntil(wall.date, 'weekly') : '',
    weekdays,
  };
}
