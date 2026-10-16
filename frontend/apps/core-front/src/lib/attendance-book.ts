'use client';

import type { AttendanceMark, JoinedMeeting, JoinedStudy } from '@/features/my-studies/queries';

export type MyAttendanceBook = {
  meetings: JoinedMeeting[];
  cells: Record<string, AttendanceMark | undefined>;
};

/** 내 출석부 — GET /api/me/studies 가 준 회차별 내 출석. */
export function myAttendanceBook(study: JoinedStudy): MyAttendanceBook {
  return { meetings: study.meetings, cells: study.myAttendance };
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
