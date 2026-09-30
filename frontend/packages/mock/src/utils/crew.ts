import type { AttendanceStatus } from '../types/crew';

/** 지각 가중치. 출석률 = (present + late × W) / 대상 회차. */
export const LATE_WEIGHT = 0.5;

/**
 * 출석률 분자에 넣는 점수. 출석 = 1, 지각 = W, 결석 = 0. 휴가는 분모에서 뺀다.
 */
export function attendancePoint(status: AttendanceStatus): number {
  if (status === "present") return 1;
  if (status === "late") return LATE_WEIGHT;
  return 0;
}

/**
 * 출석률(%).
 * - 분모: 대상 회차 — 휴가 제외. 아직 시작하지 않은 회차(키 없음)는 넣지 않는다
 * - 분자: present + late × W. W = 0.5
 */
export function attendanceRate(row: Record<string, AttendanceStatus> | undefined): number | undefined {
  if (!row) return undefined;
  const target = Object.values(row).filter((v) => v !== "excused");
  if (target.length === 0) return undefined;
  const score = target.reduce((sum, v) => sum + attendancePoint(v), 0);
  return Math.round((score / target.length) * 100);
}
