import { attendanceRate } from '@studyclub/utils';

import type { AttendanceBook, AttendanceStatus } from '@/features/schedule/store';

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '휴가',
};

export function cloneBook(book: AttendanceBook): AttendanceBook {
  return Object.fromEntries(Object.entries(book).map(([id, row]) => [id, { ...row }]));
}

/** 미체크 → 출석 → 지각 → 결석 → 휴가 → 미체크. 잘못 누른 것을 되돌릴 수 있어야 한다. */
export function nextStatus(cur: AttendanceStatus | undefined): AttendanceStatus | undefined {
  if (cur === undefined) return 'present';
  if (cur === 'present') return 'late';
  if (cur === 'late') return 'absent';
  if (cur === 'absent') return 'excused';
  return undefined;
}

/** 두 출석부에서 값이 다른 칸 수 — 지금 열(회차)만 센다. 지운 회차의 칸은 저장값에 남아도 세지 않는다. */
export function changedCount(a: AttendanceBook, b: AttendanceBook, columnIds: string[]): number {
  let n = 0;
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    for (const col of columnIds) {
      if (a[id]?.[col] !== b[id]?.[col]) n += 1;
    }
  }
  return n;
}

/**
 * 한 사람의 출석률(정수 %). 체크된 칸이 없으면 undefined.
 * 넣을 회차만 센다 — 킥오프 · 중단 뒤 회차 · 지운 회차는 빠진다. 휴가는 분모에서 빠지고 지각은 0.5 (attendance spec 산식).
 */
export function attendanceRateOf(
  row: Record<string, AttendanceStatus> | undefined,
  counted: string[],
): number | undefined {
  if (!row) return undefined;
  return attendanceRate(Object.fromEntries(counted.filter((id) => row[id]).map((id) => [id, row[id]])));
}
