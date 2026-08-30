'use client';

import { getStudyCrew, type Study, type StudySession } from '@studyclub/mock';

/**
 * 회원 본인의 출석.
 *
 * **출석은 회원이 직접 누른다.** 다만 누른 시각에 따라 상태가 갈리고, 누르지 않은 채 회차가 끝나면
 * 결석이 된다 — 운영자가 매번 확인해 대신 찍어주지 않아도 되도록.
 *
 * - 시작 15분 이내 체크인 → 출석
 * - 그 이후 체크인 → 지각
 * - 종료까지 체크인 없음 → 결석 (저장하지 않는다. 시간이 지나면 저절로 그렇게 읽힌다)
 * - 휴가는 미리 알리는 것이라 언제든 신청 가능
 *
 * TODO(api): POST /api/studies/{id}/sessions/{sessionId}/attendance
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

function save(studyId: string, sessionId: string, status: MyStatus) {
  const store = read();
  store[studyId] = { ...(store[studyId] ?? {}), [sessionId]: status };
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

export function sessionWindow(study: Study, session: StudySession) {
  const { h, m } = startHour(study);
  const start = new Date(`${session.date}T00:00:00`);
  start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + DURATION_MIN * 60_000);
  return { start, end };
}

/**
 * 화면에 보일 상태.
 * 저장된 값이 있으면 그것, 없으면 **종료된 회차는 결석**, 아직 안 끝났으면 미정(undefined).
 */
export function resolveStatus(
  study: Study,
  session: StudySession,
  stored: Record<string, MyStatus>,
  now = new Date(),
): MyStatus | undefined {
  const saved = stored[session.id];
  if (saved) return saved;
  return now > sessionWindow(study, session).end ? 'absent' : undefined;
}

/** 지금 체크인한다. 누른 시각으로 출석·지각이 갈린다. */
export function checkIn(study: Study, session: StudySession, now = new Date()): MyStatus {
  const { start } = sessionWindow(study, session);
  const status: MyStatus = now.getTime() <= start.getTime() + LATE_AFTER_MIN * 60_000 ? 'present' : 'late';
  save(study.id, session.id, status);
  return status;
}

export function takeLeave(study: Study, session: StudySession): MyStatus {
  save(study.id, session.id, 'excused');
  return 'excused';
}

/** 오늘 회차. 없으면 undefined — 오늘 모이지 않는 스터디다. */
export function todaySession(study: Study, today = new Date().toISOString().slice(0, 10)): StudySession | undefined {
  return getStudyCrew(study).sessions.find((s) => s.date === today);
}

export function sessionsOf(study: Study): StudySession[] {
  return getStudyCrew(study).sessions;
}

/** 내 출석률(%). 아직 끝나지 않은 회차는 분모에서 뺀다. 휴가는 결석으로 세지 않는다. */
export function myRate(study: Study, stored: Record<string, MyStatus>, now = new Date()): number | undefined {
  const done = sessionsOf(study).filter((s) => now > sessionWindow(study, s).end);
  if (done.length === 0) return undefined;
  const counted = done.filter((s) => (stored[s.id] ?? 'absent') !== 'excused');
  if (counted.length === 0) return undefined;
  const attended = counted.filter((s) => {
    const v = stored[s.id];
    return v === 'present' || v === 'late';
  }).length;
  return Math.round((attended / counted.length) * 100);
}
