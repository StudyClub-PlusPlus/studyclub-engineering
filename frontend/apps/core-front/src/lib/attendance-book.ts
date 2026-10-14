'use client';

import { attendancePoint, type Study, type StudyMeeting } from '@studyclub/mock';

import { getMyAttendance, meetingsOf, resolveStatus, type MyStatus } from '@/lib/attendance';

export type BookStatus = MyStatus;

export type MyAttendanceBook = {
  meetings: StudyMeeting[];
  cells: Record<string, BookStatus | undefined>;
};

export function myAttendanceBook(study: Study): MyAttendanceBook {
  const meetings = meetingsOf(study);
  const stored = getMyAttendance(study.id);
  const cells = Object.fromEntries(meetings.map((m) => [m.id, resolveStatus(study, m, stored)]));
  return { meetings, cells };
}

/** 완주 점수판. 출석·지각 횟수 / 대상 회차. 휴가는 분모에서 뺀다. */
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

export function attendanceRate(book: MyAttendanceBook): number | undefined {
  const target = Object.values(book.cells).filter((v): v is BookStatus => v !== undefined && v !== 'excused');
  if (target.length === 0) return undefined;
  const score = target.reduce((sum, v) => sum + attendancePoint(v), 0);
  return Math.round((score / target.length) * 100);
}
