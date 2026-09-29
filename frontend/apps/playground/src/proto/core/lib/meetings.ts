'use client';

import type { StudyMeeting } from '@studyclub/mock';

/**
 * 네비게이터가 관리하는 회차 (ERD `STUDY_MEETING`).
 *
 * 회차는 스터디가 아니라 **분반(STUDY_GROUP)** 에 붙는다. 네비게이터 권한도 맡은 분반 안에서만 선다.
 * 추가·삭제는 브라우저에만 남는다 — 저장할 서버가 아직 없다.
 *
 * TODO(api): POST   /api/studies/{id}/groups/{groupId}/meetings — { scheduledAt[](UTC), title? }
 *            DELETE /api/studies/{id}/groups/{groupId}/meetings/{meetingId}
 */

/** 시각(`HH:MM`)·제목·반복 묶음이 붙은 회차. 기존 mock 회차는 시각을 스터디 일정 문구에서 뽑는다. */
export type ProtoMeeting = StudyMeeting & { time?: string; title?: string; seriesId?: string };

export type NavigatorGroup = {
  id: string;
  name: string;
  /** IANA. 회차 시각은 이 시간대 벽시계로 받는다. 프로토는 KST 반만 다룬다. */
  timeZone: 'Asia/Seoul';
  /** 분반 정규 시작 시각 (STUDY_GROUP.START_AT). 새 회차의 기본값. */
  startAt: string;
};

/** 이 스터디를 사용자 사이트에서 관리할 수 있는 역할. 캡틴은 백오피스 출석부(스터디 전체)로도 간다. */
export type ManageRole = 'navigator' | 'captain';

export type ManageAccess = { role: ManageRole; group: NavigatorGroup };

export const MANAGE_ROLE_LABEL: Record<ManageRole, string> = { navigator: '네비게이터', captain: '캡틴' };

/**
 * 프로토 가정 — 로그인 회원은
 * - DDIA 2판 수요일반의 네비게이터
 * - AI 논문 스터디의 캡틴 (목요일반)
 * TODO(api): GET /api/me/participations — 네비게이터 = STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER,
 *            캡틴 = ACCOUNT.SYSTEM_ROLE = ADMIN 이면서 그 스터디를 맡은 운영진
 */
const MANAGE_OF: Record<string, ManageAccess> = {
  'ddia-2nd': {
    role: 'navigator',
    group: { id: 'ddia-2nd-wed', name: '수요일반', timeZone: 'Asia/Seoul', startAt: '20:30' },
  },
  'ai-paper-study': {
    role: 'captain',
    group: { id: 'ai-paper-study-thu', name: '목요일반', timeZone: 'Asia/Seoul', startAt: '20:00' },
  },
};

export function manageAccessOf(studyId: string): ManageAccess | undefined {
  return MANAGE_OF[studyId];
}


export const TITLE_MAX = 50;
/** 반복으로 한 번에 만들 수 있는 기간(시작 날짜 포함 일수). 매일이면 최대 31회차. */
export const REPEAT_SPAN_DAYS = 31;

/** 반복 종료일로 고를 수 있는 마지막 날. */
export function maxUntil(date: string): string {
  return date ? addDaysYmd(date, REPEAT_SPAN_DAYS - 1) : '';
}

/* ── 저장소 ─────────────────────────────────────────────────────────────── */

const ADDED_KEY = 'sc_added_meetings';
const DELETED_KEY = 'sc_deleted_meetings';
const EDITED_KEY = 'sc_edited_meetings';

type Edit = { date: string; time: string; title?: string };

type Stored = { id: string; date: string; time: string; title?: string; seriesId?: string };

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
  input: { dates: string[]; time: string; title?: string },
): void {
  const store = readJSON<Stored>(ADDED_KEY);
  const title = input.title?.trim() || undefined;
  const stamp = Date.now();
  const seriesId = input.dates.length > 1 ? `r${stamp}` : undefined;
  const rows = input.dates.map((date, i) => ({ id: `${studyId}-a${stamp}-${i}`, date, time: input.time, title, seriesId }));
  store[studyId] = [...(store[studyId] ?? []), ...rows];
  writeJSON(ADDED_KEY, store);
}

/** 추가한 회차는 행을 지우고, 원래 있던 회차는 지운 목록에 올린다. */
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

/**
 * 회차의 날짜·시각·제목을 고친다. **ID 는 그대로** — 크루가 이 회차에 낸 휴가 신청이 따라온다.
 * 추가한 회차는 행을 고치고, 원래 있던 회차는 고친 값을 따로 얹는다.
 */
export function updateMeeting(studyId: string, id: string, edit: { date: string; time: string; title: string }): void {
  const title = edit.title.trim() || undefined;
  const added = readJSON<Stored>(ADDED_KEY);
  const mine = added[studyId] ?? [];
  if (mine.some((m) => m.id === id)) {
    added[studyId] = mine.map((m) => (m.id === id ? { ...m, date: edit.date, time: edit.time, title } : m));
    writeJSON(ADDED_KEY, added);
    return;
  }
  const edited = readEdits();
  edited[studyId] = { ...(edited[studyId] ?? {}), [id]: { date: edit.date, time: edit.time, title } };
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

/** 기존 회차에서 지운 것을 빼고, 고친 값을 얹고, 추가한 것을 붙여 날짜순으로 번호를 다시 매긴다. 회차 번호는 저장값이 아니라 순서다. */
export function withAdded(base: StudyMeeting[], studyId: string): ProtoMeeting[] {
  const added = (readJSON<Stored>(ADDED_KEY)[studyId] ?? []).map((m) => ({ ...m, no: 0 }));
  const deleted = new Set(readJSON<string>(DELETED_KEY)[studyId] ?? []);
  const edits = readEdits()[studyId] ?? {};
  if (added.length === 0 && deleted.size === 0 && Object.keys(edits).length === 0) return base;
  const kept: ProtoMeeting[] = base.filter((m) => !deleted.has(m.id)).map((m) => (edits[m.id] ? { ...m, ...edits[m.id] } : m));
  return [...kept, ...added]
    .sort((a, b) =>
      `${a.date} ${(a as ProtoMeeting).time ?? ''}`.localeCompare(`${b.date} ${(b as ProtoMeeting).time ?? ''}`),
    )
    .map((m, i) => ({ ...m, no: i + 1 }));
}

/* ── 날짜·시각 ───────────────────────────────────────────────────────────── */

/** KST 벽시계 → 순간. 한국은 서머타임이 없어 +9 고정이다. */
export function kstInstant(date: string, time: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, 0));
}

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** `9/30(수) 20:30` — 고른 시간대의 벽시계로. */
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

/** `9/30(수)` */
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

/** 캘린더 반복과 같다. 매주는 고른 요일(여럿 가능)마다 돈다. */
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

export type Skip = { date: string; reason: string };

export type MeetingPlan = {
  /** 실제로 만들어질 날짜들. */
  dates: string[];
  /** 반복 중 건너뛴 날짜와 이유. */
  skipped: Skip[];
};

/** 반복 규칙대로 펼친 날짜들. 종료일은 검사를 통과한 뒤라 31일 안이다. */
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
 * 캘린더에서 반복 일정을 넣을 때 휴일 하나 때문에 전체가 막히지 않는 것과 같다.
 */
export function planDraft(
  draft: MeetingDraft,
  existing: StudyMeeting[],
  now = new Date(),
): { errors: DraftErrors; plan?: MeetingPlan } {
  const errors: DraftErrors = {};
  if (!draft.date) errors.date = '날짜를 정해 주세요.';
  if (!draft.time) errors.time = '시작 시각을 정해 주세요.';
  if (draft.title.trim().length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자까지 쓸 수 있습니다.`;
  if (draft.repeat === 'weekly' && draft.weekdays.length === 0) errors.weekdays = '반복할 요일을 하나 이상 골라 주세요.';
  if (draft.repeat !== 'none') {
    if (!draft.until) errors.until = '반복 종료일을 정해 주세요.';
    else if (draft.date && draft.until < draft.date) errors.until = '종료일은 시작 날짜보다 뒤여야 합니다.';
    else if (draft.date && draft.until > maxUntil(draft.date))
      errors.until = `반복은 시작 날짜부터 ${REPEAT_SPAN_DAYS}일 안에서만 만들 수 있습니다 (${dayLabel(maxUntil(draft.date))}까지).`;
  }
  if (errors.date || errors.time || errors.until || errors.weekdays) return { errors };

  const dates = expand(draft);
  if (dates.length === 0) {
    errors.form = '고른 기간에 반복할 요일이 없습니다. 요일이나 종료일을 바꿔 주세요.';
    return { errors };
  }

  const byDate = new Map(existing.map((m) => [m.date, m]));
  const past = (d: string) => kstInstant(d, draft.time).getTime() <= now.getTime();

  if (draft.repeat === 'none') {
    const same = byDate.get(draft.date);
    // 하루에 회차 하나 — 출석 버튼·주간 일정이 날짜로 회차를 찾는다.
    if (same) errors.date = `이 날에는 이미 ${same.no}회차가 있습니다.`;
    else if (past(draft.date)) errors.time = '지난 시각으로는 회차를 만들 수 없습니다.';
    if (Object.keys(errors).length) return { errors };
    return { errors, plan: { dates, skipped: [] } };
  }

  if (past(dates[0])) {
    errors.time = '첫 회차가 지난 시각입니다. 시작 날짜나 시각을 바꿔 주세요.';
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

/** 회차 하나를 고칠 때의 검사. 자기 자신과는 겹침을 따지지 않는다. */
export function validateEdit(
  edit: { date: string; time: string; title: string },
  selfId: string,
  existing: StudyMeeting[],
  now = new Date(),
): DraftErrors {
  const others = existing.filter((m) => m.id !== selfId);
  return planDraft({ ...edit, repeat: 'none', until: '', weekdays: [] }, others, now).errors;
}

/** 새 회차들이 몇 회차부터 몇 회차가 되는지, 뒤 회차 몇 개가 밀리는지, 기간이 늘어나는지. */
export function previewOf(plan: MeetingPlan, existing: StudyMeeting[]) {
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

/** 기본 날짜 — 마지막 회차 다음 주 같은 요일. 그게 지났으면 오늘 이후 첫 같은 요일. */
export function defaultDate(existing: StudyMeeting[], today: string): string {
  const last = existing[existing.length - 1]?.date;
  if (!last) return addDaysYmd(today, 7);
  let next = addDaysYmd(last, 7);
  while (next <= today) next = addDaysYmd(next, 7);
  return next;
}

/** 반복을 켰을 때의 기본 종료일 — 매주는 5회(4주 뒤), 매일은 2주. 둘 다 31일 안이다. */
export function defaultUntil(date: string, repeat: Repeat): string {
  if (!date || repeat === 'none') return '';
  return addDaysYmd(date, repeat === 'weekly' ? 28 : 13);
}
