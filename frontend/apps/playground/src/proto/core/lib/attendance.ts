'use client';

import { demoMyAttendance, getStudyCrew, studies, type Study, type StudyMeeting } from '@studyclub/mock';

/**
 * 회원 본인의 출석.
 *
 * **휴가는 크루가 신청한다.** 지금 참석은 디스코드 채널만 연다. 출석 확정은 반장 디스코드 명령.
 *
 * - 지금 참석 버튼은 예정 시작 30분 전부터 활성 — 누르면 디스코드로 간다. 출석으로 저장하지 않는다
 * - 회차 생성 시 전원 ABSENT. 시작 전 화면은 결석을 그리지 않는다
 * - 휴가는 미리 알리는 것이라 언제든 신청 가능
 * - 휴가 취소는 회차 시작 전까지만. 거두면 ABSENT로 돌아가고, 시작 전이면 칸은 비어 보인다
 *
 * TODO(api): POST/DELETE 휴가는 크루. 출석 PRESENT/LATE 는 반장 연동
 */

const KEY = 'sc_my_attendance';

/** 휴가는 회원이 미리 알리는 부재다. 운영자 출석부의 출석/지각/결석과는 별개 축. */
export type MyStatus = 'present' | 'late' | 'absent' | 'excused';

export const STATUS_LABEL: Record<MyStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

export const STATUS_STYLE: Record<MyStatus, string> = {
  present: 'bg-success-100 text-success-700',
  late: 'bg-warning-100 text-warning-700',
  absent: 'bg-error-50 text-error-700',
  excused: 'bg-surface-2 text-fg-secondary',
};

type Store = Record<string, Record<string, MyStatus>>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

export function getMyAttendance(studyId: string): Record<string, MyStatus> {
  return read()[studyId] ?? {};
}

/**
 * 프로토 미리보기용 내 출석. 회차 칸·출석률·완주 점수판이 같은 시드를 본다.
 * 시작전은 비우고, 참여중은 지난 회차만, 완주는 전 회차를 채운다.
 */
export function seedMyAttendance(studyIds: string[]) {
  const store: Store = {};
  const today = new Date().toISOString().slice(0, 10);
  for (const id of studyIds) {
    const study = studies.find((s) => s.id === id);
    if (!study) continue;
    store[id] = demoMyAttendance(study, meetingsOf(study), today);
  }
  write(store);
}

function save(studyId: string, meetingId: string, status: MyStatus) {
  const store = read();
  store[studyId] = { ...(store[studyId] ?? {}), [meetingId]: status };
  write(store);
}

function clear(studyId: string, meetingId: string) {
  const store = read();
  const row = { ...(store[studyId] ?? {}) };
  delete row[meetingId];
  store[studyId] = row;
  write(store);
}

/** 「매주 목 20:00 · 8주 과정」에서 시각을 뽑는다. 없으면 20:00 으로 본다. */
function startHour(study: Study): { h: number; m: number } {
  const raw = study.schedule?.ko ?? '';
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  return m ? { h: Number(m[1]), m: Number(m[2]) } : { h: 20, m: 0 };
}

/** 회차 1회는 2시간으로 본다 — 종료 시각을 넘기면 더 이상 체크인할 수 없다. */
const DURATION_MIN = 120;
/** 이 시간을 넘겨 체크인하면 지각. */
const LATE_AFTER_MIN = 15;
/** 시작 이 시간 전부터 참석 버튼이 켜진다. */
const CHECKIN_OPEN_BEFORE_MIN = 30;

/** 예정 창 (SCHEDULED_AT). 실제 STARTS_AT/ENDS_AT는 반장이 열 때. 프로토는 예정이 곧 창이다. */
export function meetingWindow(study: Study, meeting: StudyMeeting) {
  const { h, m } = startHour(study);
  const start = new Date(`${meeting.date}T00:00:00`);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
  return { start, end };
}

/** 시작 30분 전 ~ 회차 종료(예정). 지금 참석(디스코드) 버튼. 출석으로 저장하지 않는다. */
export function canCheckIn(study: Study, meeting: StudyMeeting, now = new Date()): boolean {
  const { start, end } = meetingWindow(study, meeting);
  const open = start.getTime() - CHECKIN_OPEN_BEFORE_MIN * 60_000;
  const t = now.getTime();
  return t >= open && t <= end.getTime();
}

/**
 * 화면에 보일 상태.
 * 저장값이 있으면 그것. 없으면 회차 생성 시 ABSENT.
 * 회차 시작 전의 결석은 칸에 그리지 않는다.
 */
export function resolveStatus(
  study: Study,
  meeting: StudyMeeting,
  stored: Record<string, MyStatus>,
  now = new Date(),
): MyStatus | undefined {
  const saved = stored[meeting.id];
  const started = now.getTime() >= meetingWindow(study, meeting).start.getTime();
  const raw: MyStatus = saved ?? 'absent';
  if (raw === 'absent' && !started) return undefined;
  return raw;
}

/** 반장이 출석을 찍는 흐름의 프로토 흉내. 내 스터디 지금 참석은 이 함수를 부르지 않는다. */
export function checkIn(study: Study, meeting: StudyMeeting, now = new Date()): MyStatus | undefined {
  if (!canCheckIn(study, meeting, now)) return undefined;
  const { start } = meetingWindow(study, meeting);
  const status: MyStatus = now.getTime() <= start.getTime() + LATE_AFTER_MIN * 60_000 ? 'present' : 'late';
  save(study.id, meeting.id, status);
  return status;
}

export function takeLeave(study: Study, meeting: StudyMeeting): MyStatus {
  save(study.id, meeting.id, 'excused');
  return 'excused';
}

/** 회차가 시작되기 전인지. 시작된 휴가은 거두면 결석이 된다. */
export function canCancelLeave(study: Study, meeting: StudyMeeting, now = new Date()): boolean {
  return now.getTime() < meetingWindow(study, meeting).start.getTime();
}

/** 휴가 신청을 거둔다. 시작 후면 지우지 않는다. 지우면 ABSENT로 돌아가고, 시작 전이면 칸은 비어 보인다. */
export function cancelLeave(study: Study, meeting: StudyMeeting, now = new Date()): boolean {
  if (!canCancelLeave(study, meeting, now)) return false;
  if (getMyAttendance(study.id)[meeting.id] !== 'excused') return false;
  clear(study.id, meeting.id);
  return true;
}

/** 오늘 회차. 없으면 undefined — 오늘 모이지 않는 스터디다. */
export function todayMeeting(study: Study, today = new Date().toISOString().slice(0, 10)): StudyMeeting | undefined {
  return getStudyCrew(study).meetings.find((m) => m.date === today);
}

export function meetingsOf(study: Study): StudyMeeting[] {
  return getStudyCrew(study).meetings;
}

/** 내 출석률(%). 출석률 = 완주율. 출석·지각 = 1. 대상은 시작된 회차 중 휴가가 아닌 것. */
export function myRate(study: Study, stored: Record<string, MyStatus>, now = new Date()): number | undefined {
  const started = meetingsOf(study).filter((m) => now.getTime() >= meetingWindow(study, m).start.getTime());
  if (started.length === 0) return undefined;
  const target = started.filter((m) => (stored[m.id] ?? 'absent') !== 'excused');
  if (target.length === 0) return undefined;
  const score = target.reduce((sum, m) => {
    const v = stored[m.id] ?? 'absent';
    if (v === 'present' || v === 'late') return sum + 1;
    return sum;
  }, 0);
  return Math.round((score / target.length) * 100);
}
