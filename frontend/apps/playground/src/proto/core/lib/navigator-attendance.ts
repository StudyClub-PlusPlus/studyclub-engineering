'use client';

import { getStudyCrew, type AttendanceStatus, type Crew, type Study } from '@studyclub/mock';

/**
 * 네비게이터가 사용자 사이트에서 고치는 출석부 — **맡은 분반의 참여자만**.
 *
 * 백오피스 출석부와 같은 격자·같은 상태값을 쓴다. 다른 점은 범위뿐이다:
 * 사용자 사이트는 소속 분반, 백오피스는 스터디 전체.
 *
 * TODO(api): GET  /api/studies/{id}/groups/{groupId}/attendances
 *            POST /api/studies/{id}/groups/{groupId}/attendances — 바뀐 칸만 updates[] 로
 */

export type AttendanceBook = Record<string, Record<string, AttendanceStatus>>;

const KEY = 'sc_navigator_attendance';

function read(): Record<string, AttendanceBook> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, AttendanceBook>) : {};
  } catch {
    return {};
  }
}

/** 프로토는 분반이 하나라 스터디의 활성 크루 전원이 곧 내 분반이다. */
export function myGroupCrew(study: Study): Crew[] {
  return getStudyCrew(study).crew;
}

export function getGroupAttendance(study: Study): AttendanceBook {
  return read()[study.id] ?? getStudyCrew(study).attendance;
}

export function saveGroupAttendance(study: Study, book: AttendanceBook): void {
  const store = read();
  store[study.id] = book;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}
