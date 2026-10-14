'use client';

import type { Study, StudyMeeting } from '@studyclub/mock';

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
};

export type ManageRole = 'navigator' | 'captain';
export type ManageAccess = { role: ManageRole; group: NavigatorGroup };
export const MANAGE_ROLE_LABEL: Record<ManageRole, string> = { navigator: '네비게이터', captain: '캡틴' };

export type ScheduleRole = ManageRole | 'crew';
export const SCHEDULE_ROLE_LABEL: Record<ScheduleRole, string> = { ...MANAGE_ROLE_LABEL, crew: '크루' };

export type ScheduleAccess = { role: ScheduleRole; group: NavigatorGroup; canEdit: boolean };

/**
 * 프로토 가정 — 로그인 회원은
 * - 11 (ddia-2nd) 의 네비게이터
 * - 1  (ai-paper-study) 의 담당 캡틴
 * TODO(api): GET /api/me/participations
 */
const MANAGE_OF: Record<string, ManageAccess> = {
  '11': {
    role: 'navigator',
    group: { id: '11-wed', name: '수요일반', timeZone: 'Asia/Seoul', startAt: '20:30' },
  },
  '1': {
    role: 'captain',
    group: { id: '1-thu', name: '목요일반', timeZone: 'Asia/Seoul', startAt: '20:00' },
  },
};

export function manageAccessOf(studyId: string): ManageAccess | undefined {
  return MANAGE_OF[studyId];
}

const DEFAULT_ZONE = 'Asia/Seoul';

export function scheduleAccessOf(study: Study): ScheduleAccess {
  const managed = manageAccessOf(study.id);
  if (managed) return { ...managed, canEdit: true };
  const clock = (study.schedule?.ko ?? '').match(/(\d{1,2}):(\d{2})/);
  const startAt = clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : '20:00';
  return {
    role: 'crew',
    group: { id: `${study.id}-main`, name: '참여 분반', timeZone: DEFAULT_ZONE, startAt },
    canEdit: false,
  };
}

export function zoneOfStudy(studyId: string): string {
  return manageAccessOf(studyId)?.group.timeZone ?? DEFAULT_ZONE;
}

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
  input: { dates: string[]; time: string; timeZone: string; title?: string },
): void {
  const store = readJSON<Stored>(ADDED_KEY);
  const title = input.title?.trim() || undefined;
  const stamp = Date.now();
  const seriesId = input.dates.length > 1 ? `r${stamp}` : undefined;
  const rows: Stored[] = input.dates.map((date, i) => ({
    id: `${studyId}-a${stamp}-${i}`,
    scheduledAt: zonedInstant(date, input.time, input.timeZone).toISOString(),
    title,
    seriesId,
  }));
  store[studyId] = [...(store[studyId] ?? []), ...rows];
  writeJSON(ADDED_KEY, store);
}

export function deleteMeetings(studyId: string, ids: string[]): void {
  const added = readJSON<Stored>(ADDED_KEY);
  const mine = added[studyId] ?? [];
  const addedIds = new Set(mine.map((m) => m.id));
  added[studyId] = mine.filter((m) => !ids.includes(m.id));
  writeJSON(ADDED_KEY, added);

  const deleted = readJSON<string>(DELETED_KEY);
  deleted[studyId] = [...(deleted[studyId] ?? []), ...ids.filter((id) => !addedIds.has(id))];
  writeJSON(DELETED_KEY, deleted);
}

export type MeetingPatch = {
  date?: string;
  time?: string;
  title?: string;
  presenter1?: string | null;
  presenter2?: string | null;
};

export function patchMeeting(studyId: string, id: string, patch: MeetingPatch, timeZone: string): void {
  const next: Edit = {};
  if (patch.date && patch.time) next.scheduledAt = zonedInstant(patch.date, patch.time, timeZone).toISOString();
  if (patch.title !== undefined) next.title = patch.title.trim() || undefined;
  if (patch.presenter1 !== undefined) next.presenter1 = patch.presenter1 ?? undefined;
  if (patch.presenter2 !== undefined) next.presenter2 = patch.presenter2 ?? undefined;
  const merge = <T extends Edit>(row: T): T => {
    const out = { ...row, ...next };
    if (next.scheduledAt) {
      delete out.date;
      delete out.time;
    }
    return out;
  };

  const added = readJSON<Stored>(ADDED_KEY);
  const mine = added[studyId] ?? [];
  if (mine.some((m) => m.id === id)) {
    added[studyId] = mine.map((m) => (m.id === id ? merge(m) : m));
    writeJSON(ADDED_KEY, added);
    return;
  }
  const edited = readEdits();
  const prev = edited[studyId]?.[id] ?? {};
  edited[studyId] = { ...(edited[studyId] ?? {}), [id]: merge(prev) };
  writeJSON(EDITED_KEY, edited);
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
  return (m as ProtoMeeting).kind === 'kickoff';
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

export function withAdded(base: StudyMeeting[], studyId: string, zone = zoneOfStudy(studyId)): ProtoMeeting[] {
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

export function bookFromSchedule(meetings: ProtoMeeting[]) {
  const byId = new Map(meetings.map((m) => [m.id, m]));
  return {
    presentersOf: (id: string) =>
      [byId.get(id)?.presenter1, byId.get(id)?.presenter2].filter((p): p is string => Boolean(p)),
    notCounted: new Set(meetings.filter(isKickoff).map((m) => m.id)),
    headOf: (m: StudyMeeting) => (isKickoff(m) ? '킥오프' : `${m.no}회`),
  };
}

/* ── 날짜·시각 ───────────────────────────────────────────────────────────── */

function zonedParts(instant: Date, iana: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
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

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export function wallLabel(instant: Date, iana: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: iana,
      month: 'numeric',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((p) => [p.type, p.value]),
  );
  const dow = DOW[['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)];
  return `${parts.month}/${parts.day}(${dow}) ${parts.hour}:${parts.minute}`;
}

export function scheduleLabel(instant: Date, iana: string): string {
  const { date, time } = wallParts(instant, iana);
  return `${date} ${time}`;
}

export const DISPLAY_ZONES = [
  { iana: 'Asia/Seoul', label: 'KST', name: '한국 시간' },
  { iana: 'America/Los_Angeles', label: 'PDT', name: '미국 서부 시간' },
] as const;

export function zoneLabel(iana: string): string {
  const known = DISPLAY_ZONES.find((z) => z.iana === iana)?.label;
  if (known) return known;
  try {
    return (
      new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? iana
    );
  } catch {
    return iana;
  }
}

export function zoneTitle(iana: string): string {
  const name = DISPLAY_ZONES.find((z) => z.iana === iana)?.name ?? iana;
  return `${name}(${zoneLabel(iana)})`;
}

export function dayLabel(ymd: string): string {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}/${d}(${DOW[dowOf(ymd)]})`;
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
};

export type DraftErrors = Partial<Record<keyof MeetingDraft | 'form', string>>;

export type Skip = { date: string; reason: string };

export type MeetingPlan = {
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
  const kickoff = existing.find(isKickoff);
  if (kickoff && dates[0] <= kickoff.date) {
    errors.date = `킥오프(${dayLabel(kickoff.date)}) 뒤로만 회차를 만들 수 있습니다.`;
    return { errors };
  }

  if (draft.repeat === 'none') {
    const same = byDate.get(draft.date);
    if (same) errors.date = `이 날에는 이미 ${same.no}회차가 있습니다.`;
    else if (past(draft.date)) errors.time = '지난 시각으로는 회차를 만들 수 없습니다.';
    if (Object.keys(errors).length) return { errors };
    return { errors, plan: { dates, skipped: [] } };
  }

  if (past(dates[0])) {
    errors.time = '첫 회차가 지난 시각입니다. 시작 일자나 시각을 바꿔 주세요.';
    return { errors };
  }
  const skipped: Skip[] = [];
  const keep: string[] = [];
  for (const d of dates) {
    const same = byDate.get(d);
    if (same) skipped.push({ date: d, reason: `이미 ${same.no}회차` });
    else keep.push(d);
  }
  if (keep.length === 0) {
    errors.form = '고른 기간의 모든 날에 이미 회차가 있습니다.';
    return { errors };
  }
  if (Object.keys(errors).length) return { errors };
  return { errors, plan: { dates: keep, skipped } };
}

export function validateEdit(
  edit: { date: string; time: string; title: string },
  selfId: string,
  existing: StudyMeeting[],
  timeZone: string,
  now = new Date(),
): DraftErrors {
  const others = existing.filter((m) => m.id !== selfId);
  const errors = planDraft({ ...edit, repeat: 'none', until: '', weekdays: [] }, others, timeZone, now).errors;
  const self = existing.find((m) => m.id === selfId);
  const firstRegular = others.filter((m) => !isKickoff(m))[0];
  if (self && isKickoff(self) && !errors.date && firstRegular && edit.date >= firstRegular.date) {
    errors.date = `킥오프는 1회차(${dayLabel(firstRegular.date)})보다 앞이어야 합니다.`;
  }
  return errors;
}

export function previewOf(plan: MeetingPlan, all_: StudyMeeting[]) {
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


