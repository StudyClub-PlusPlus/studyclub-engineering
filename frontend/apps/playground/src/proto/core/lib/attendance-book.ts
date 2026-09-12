'use client';

import {
  STATUS_LABEL,
  STATUS_STYLE,
  getMyAttendance,
  meetingsOf,
  resolveStatus,
  type MyStatus,
} from '@core/lib/attendance';
import { attendancePoint, type Study, type StudyMeeting } from '@studyclub/mock';

/**
 * 크루가 보는 출석 기록 — **본인 기록만**.
 *
 * 출석 확정은 반장 디스코드 명령. 이 화면은 조회·휴가.
 *
 * TODO(api): GET /api/studies/{id}/attendance/me
 */

export type BookStatus = MyStatus;

export const BOOK_LABEL = STATUS_LABEL;
export const BOOK_STYLE = STATUS_STYLE;

export type MyAttendanceBook = {
  meetings: StudyMeeting[];
  cells: Record<string, BookStatus | undefined>;
  rate: number | undefined;
};

/** 화면에 보이는 칸만 센다. 빈 칸(시작 전 결석)·휴가는 분모에서 뺀다. 출석률 = (present + late × 0.5) / 대상 회차. */
function rateFromCells(cells: MyAttendanceBook['cells']): number | undefined {
  const target = Object.values(cells).filter((v): v is BookStatus => v !== undefined && v !== 'excused');
  if (target.length === 0) return undefined;
  const score = target.reduce((sum, v) => sum + attendancePoint(v), 0);
  return Math.round((score / target.length) * 100);
}

export function myAttendanceBook(study: Study): MyAttendanceBook {
  const meetings = meetingsOf(study);
  const stored = getMyAttendance(study.id);
  const cells = Object.fromEntries(meetings.map((m) => [m.id, resolveStatus(study, m, stored)]));
  return { meetings, cells, rate: rateFromCells(cells) };
}

/** 완주 점수판. 출석·지각 횟수 / 대상 회차. 출석률의 지각 가중치(0.5)와는 다르다. */
export function bookScore(book: MyAttendanceBook): { attended: number; total: number } {
  const target = book.meetings.filter((m) => {
    const st = book.cells[m.id];
    return st !== undefined && st !== 'excused';
  });
  const attended = target.filter((m) => {
    const st = book.cells[m.id];
    return st === 'present' || st === 'late';
  }).length;
  return { attended, total: target.length };
}

export function rateTone(rate: number): string {
  if (rate >= 80) return 'text-success-700';
  if (rate >= 60) return 'text-fg';
  return 'text-error-700';
}

export const MEETING_COLS = 10;

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

/** yyyy-mm-dd → M/D(요일). 앞의 0은 뺀다. */
export function meetingDayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}(${dow})`;
}

export function chunkMeetings<T>(items: T[], size = MEETING_COLS): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
