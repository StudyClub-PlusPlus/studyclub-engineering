'use client';

import type { Study, StudyMeeting } from '@studyclub/mock';

/**
 * 네비게이터가 관리하는 회차 (ERD `STUDY_MEETING`).
 *
 * 회차는 스터디가 아니라 **분반(STUDY_GROUP)** 에 붙는다. 네비게이터 권한도 맡은 분반 안에서만 선다.
 * 추가·삭제는 브라우저에만 남는다 — 저장할 서버가 아직 없다.
 *
 * 저장값은 서버와 같이 UTC 예정 시각(`scheduledAt`) 하나다. 화면의 일자·시각은 분반 시간대로 바꿔 계산한 값이다.
 *
 * TODO(api): POST   /api/studies/{id}/groups/{groupId}/meetings — { scheduledAt[](UTC), title? }
 *            DELETE /api/studies/{id}/groups/{groupId}/meetings/{meetingId}
 */

/**
 * 예정 시각·제목·반복 묶음·발표자가 붙은 회차.
 * `scheduledAt`(UTC)이 저장값이고, `date`·`time` 은 분반 시간대로 계산한 값이다.
 * 기존 mock 회차는 `scheduledAt` 이 없어 시각을 스터디 일정 문구(KST)에서 뽑는다.
 * 킥오프는 `kind: 'kickoff'` — 분반마다 하나, 번호 0, 출석률에서 뺀다.
 */
export type ProtoMeeting = StudyMeeting & {
  scheduledAt?: string;
  time?: string;
  title?: string;
  seriesId?: string;
  kind?: 'kickoff';
  /** 발표자 — 분반 참가자 ID. */
  presenter1?: string;
  presenter2?: string;
};

export type NavigatorGroup = {
  id: string;
  name: string;
  /** IANA (STUDY_GROUP.TIMEZONE). 회차 시각은 이 시간대 벽시계로 받고 보인다. */
  timeZone: string;
  /** 분반 정규 시작 시각 (STUDY_GROUP.START_AT). 새 회차의 기본값. */
  startAt: string;
};

/** 이 스터디를 고칠 수 있는 역할. 둘 다 사용자 사이트 스터디 일정에서 고친다. */
export type ManageRole = 'navigator' | 'captain';

export type ManageAccess = { role: ManageRole; group: NavigatorGroup };

export const MANAGE_ROLE_LABEL: Record<ManageRole, string> = { navigator: '네비게이터', captain: '캡틴' };

/** 스터디 일정 화면의 역할. 크루는 조회하고, 빈 발표자 칸에 자기 이름만 넣고 뺄 수 있다. */
export type ScheduleRole = ManageRole | 'crew';

export const SCHEDULE_ROLE_LABEL: Record<ScheduleRole, string> = { ...MANAGE_ROLE_LABEL, crew: '크루' };

export type ScheduleAccess = { role: ScheduleRole; group: NavigatorGroup; canEdit: boolean };

/**
 * 프로토 가정 — 로그인 회원은
 * - DDIA 2판 수요일반의 네비게이터
 * - AI 논문 스터디의 담당 캡틴 (그 스터디를 생성한 캡틴)
 * TODO(api): GET /api/me/participations — 네비게이터 = STUDY_PARTICIPANT.PARTICIPANT_ROLE = LEADER,
 *            담당 캡틴 = ACCOUNT.SYSTEM_ROLE = ADMIN 이면서 그 스터디를 생성한 캡틴 (생성 시 명부에 들어간다)
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

/** 일정 문구에 시간대가 없는 mock 스터디는 KST 로 본다. */
const DEFAULT_ZONE = 'Asia/Seoul';

/**
 * 스터디 일정 화면에 들어온 참가자의 역할과 분반. 참가자 누구나 들어온다.
 * 캡틴·네비게이터는 고치고, 크루는 본다.
 * TODO(api): GET /api/studies/{id}/meetings 응답의 분반 정보 · 내 역할
 */
export function scheduleAccessOf(study: Study): ScheduleAccess {
  const managed = manageAccessOf(study.id);
  if (managed) return { ...managed, canEdit: true };
  // 프로토 가정 — 크루로 들어온 스터디는 분반 정보가 없어 KST · 일정 문구의 시각으로 둔다. 서버는 내 분반을 준다.
  const clock = (study.schedule?.ko ?? '').match(/(\d{1,2}):(\d{2})/);
  const startAt = clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : '20:00';
  return {
    role: 'crew',
    group: { id: `${study.id}-main`, name: '참여 분반', timeZone: DEFAULT_ZONE, startAt },
    canEdit: false,
  };
}

/** 이 스터디 회차 시각의 기준 시간대 — 관리하는 분반이 있으면 그 분반 시간대. */
export function zoneOfStudy(studyId: string): string {
  return manageAccessOf(studyId)?.group.timeZone ?? DEFAULT_ZONE;
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

/** 원래 있던 회차에 얹는 수정값. 예전 저장분은 `date`·`time`(분반 벽시계)만 있다. */
type Edit = {
  scheduledAt?: string;
  date?: string;
  time?: string;
  title?: string;
  presenter1?: string;
  presenter2?: string;
};

/** 추가한 회차. 예전 저장분은 `scheduledAt` 대신 `date`·`time` 을 갖는다. */
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
  // 반복으로 한꺼번에 만든 회차는 같은 묶음 ID 를 남긴다 — 지금 화면은 쓰지 않지만, 반복 단위 수정·삭제를 붙일 때 쓴다.
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

/** 회차 한 줄에서 바꾸는 값. 넘긴 것만 바꾼다. 발표자 `null` 은 비우기. */
export type MeetingPatch = {
  date?: string;
  time?: string;
  title?: string;
  presenter1?: string | null;
  presenter2?: string | null;
};

/**
 * 회차 한 줄을 고친다. **ID 는 그대로다.** 일자·시각은 분반 벽시계로 받아 UTC 로 바꿔 저장한다.
 * 추가한 회차는 행을 고치고, 원래 있던 회차(킥오프 포함)는 고친 값을 따로 얹는다.
 */
export function patchMeeting(studyId: string, id: string, patch: MeetingPatch, timeZone: string): void {
  const next: Edit = {};
  if (patch.date && patch.time) next.scheduledAt = zonedInstant(patch.date, patch.time, timeZone).toISOString();
  if (patch.title !== undefined) next.title = patch.title.trim() || undefined;
  if (patch.presenter1 !== undefined) next.presenter1 = patch.presenter1 ?? undefined;
  if (patch.presenter2 !== undefined) next.presenter2 = patch.presenter2 ?? undefined;
  // 저장값을 UTC 로 바꿨으면 예전 벽시계 값은 버린다 — 둘이 남으면 어느 쪽이 맞는지 모른다.
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

/** 저장값(UTC)에 분반 시간대로 계산한 일자·시각을 붙인다. 예전 저장분은 벽시계 값을 UTC 로 올린다. */
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

/** 「킥오프」 또는 「3회차」. */
export function meetingLabel(m: StudyMeeting): string {
  return isKickoff(m) ? '킥오프' : `${m.no}회차`;
}

/**
 * 분반마다 하나 있는 킥오프(0회차). 규칙·일정·발표자를 정하는 첫 모임이다.
 * mock 에는 킥오프가 없어 첫 회차 한 주 전에 하나 둔다. 지우지 않고, 일자·시각·제목만 고친다.
 * TODO(api): 분반을 만들 때 서버가 킥오프 회차(`MEETING_TYPE = KICKOFF`)를 함께 만든다.
 */
function kickoffOf(base: StudyMeeting[], studyId: string): ProtoMeeting | undefined {
  const first = [...base].sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!first) return undefined;
  return { id: `${studyId}-kickoff`, no: 0, date: addDaysYmd(first.date, -7), kind: 'kickoff', title: '킥오프' };
}

const wallKey = (m: StudyMeeting) => `${m.date} ${(m as ProtoMeeting).time ?? ''}`;

/**
 * 킥오프를 맨 앞에 두고, 기존 회차에서 지운 것을 빼고, 고친 값을 얹고, 추가한 것을 붙인다.
 * 정규 회차는 일정순으로 1부터, 킥오프는 0. 회차 번호는 저장값이 아니라 순서다.
 */
export function withAdded(base: StudyMeeting[], studyId: string): ProtoMeeting[] {
  const zone = zoneOfStudy(studyId);
  const added = (readJSON<Stored>(ADDED_KEY)[studyId] ?? []).map((m) => ({ ...withWall(m, zone), no: 0 }) as ProtoMeeting);
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

/** 그 시간대에서 본 순간의 벽시계 부품. */
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

/** 그 순간 시간대의 UTC 오프셋(ms). 서머타임이 있으면 날짜마다 다르다. */
function offsetMs(instant: Date, iana: string): number {
  const p = zonedParts(instant, iana);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return asUtc - Math.floor(instant.getTime() / 60_000) * 60_000;
}

/** 분반 시간대의 벽시계(일자 `yyyy-MM-dd` · 시각 `HH:mm`) → 순간(UTC). 서버에 보낼 값이다. */
export function zonedInstant(date: string, time: string, iana: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // 오프셋을 한 번 더 잰다 — 서머타임 경계를 넘는 날도 맞추기 위해.
  const first = guess - offsetMs(new Date(guess), iana);
  return new Date(guess - offsetMs(new Date(first), iana));
}

/** 순간(UTC) → 그 시간대의 일자·시각. 화면에 보이는 값이다. */
export function wallParts(instant: Date, iana: string): { date: string; time: string } {
  const p = zonedParts(instant, iana);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
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

/** `2026-09-30 20:30` — 고른 시간대의 벽시계로. 회차 목록·미리보기의 일정 형식. */
export function scheduleLabel(instant: Date, iana: string): string {
  const { date, time } = wallParts(instant, iana);
  return `${date} ${time}`;
}

/** 일정 표에서 고를 수 있는 시간대. 표의 일자·시각은 고른 시간대로 보이고 그 시간대로 고친다. 회차 추가 창은 분반 시간대. */
export const DISPLAY_ZONES = [
  { iana: 'Asia/Seoul', label: 'KST', name: '한국 시간' },
  { iana: 'America/Los_Angeles', label: 'PDT', name: '미국 서부 시간' },
] as const;

/** 시간대 약칭 (`KST`). 표시 목록에 없으면 브라우저가 주는 약칭 (`GMT+1` 등). */
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

/** 「한국 시간(KST)」 — 관리 화면 머리와 회차 추가 창이 쓰는 기준 시간대 이름. */
export function zoneTitle(iana: string): string {
  const name = DISPLAY_ZONES.find((z) => z.iana === iana)?.name ?? iana;
  return `${name}(${zoneLabel(iana)})`;
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
  timeZone: string,
  now = new Date(),
): { errors: DraftErrors; plan?: MeetingPlan } {
  const errors: DraftErrors = {};
  if (!draft.date) errors.date = '일자를 정해 주세요.';
  if (!draft.time) errors.time = '시작 시각을 정해 주세요.';
  if (draft.title.trim().length > TITLE_MAX) errors.title = `제목은 ${TITLE_MAX}자까지 쓸 수 있습니다.`;
  if (draft.repeat === 'weekly' && draft.weekdays.length === 0) errors.weekdays = '반복할 요일을 하나 이상 골라 주세요.';
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
    // 하루에 회차 하나 — 출석 버튼·주간 일정이 날짜로 회차를 찾는다.
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

/** 회차 하나를 고칠 때의 검사. 자기 자신과는 겹침을 따지지 않는다. */
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

/** 새 회차들이 몇 회차부터 몇 회차가 되는지, 뒤 회차 몇 개가 밀리는지, 기간이 늘어나는지. */
export function previewOf(plan: MeetingPlan, all_: StudyMeeting[]) {
  // 킥오프는 번호(0)를 따로 갖는다 — 정규 회차 번호만 센다.
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
