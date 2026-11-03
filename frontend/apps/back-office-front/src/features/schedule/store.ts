import { z } from 'zod';

import type { ScheduleGroup } from '@/features/schedule/meetings';

/**
 * 일정 탭의 브라우저 저장소 — **반의 스터디 시간(요일 · 시각)만** 남는다.
 *
 * 반 · 회차 · 킥오프 · 규칙 · 출석은 서버가 정본이다 (`api.ts` · `features/attendance/api.ts`).
 * 스터디 시간 중 weekdays(요일 배열) 만 여기에 남는다 — 참여 명단 GET 응답에 포함되지 않기 때문이다.
 * startTime · timezone 은 서버 반 회차 조회 응답(`studyGroup.startTime · .timezone`)으로 읽는다.
 * TODO(api): 참여 명단 GET 이 daysOfWeek 를 반환하면 이 파일을 지운다.
 */

/** 출석 칸 값. 칸이 없으면 미체크. */
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

/** 그 반의 출석부 — 참가자 ID → 회차 ID → 상태. */
export type AttendanceBook = Record<string, Record<string, AttendanceStatus>>;

/** 회차 한 줄에서 바꾸는 값. 넘긴 것만 바꾼다. 발표자 `null` 은 비우기. 일자·시각은 반 시간대 벽시계. */
export type MeetingPatch = {
  date: string;
  time: string;
  title: string;
  presenter1?: string | null;
  presenter2?: string | null;
};

const storedTimeSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)),
});
type StoredTime = z.infer<typeof storedTimeSchema>;
const storedTimesSchema = z.record(z.string(), storedTimeSchema);

const keyOf = (studyId: number) => `bo_schedule_time:${studyId}`;

function read(studyId: number): Record<string, StoredTime> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(keyOf(studyId));
    return raw ? storedTimesSchema.parse(JSON.parse(raw)) : {};
  } catch {
    return {};
  }
}

/**
 * 서버 반(참여 명단 `groups[]`)에 저장소의 요일을 얹는다. 반 ID 는 서버 반 ID 그대로(문자열)다.
 * startTime · timezone 은 회차 목록(`withServerTz`)에서 덮는다.
 */
export function groupsFromServer(studyId: number, server: { groupId: number; name: string }[]): ScheduleGroup[] {
  const local = read(studyId);
  return server.map((g) => {
    const id = String(g.groupId);
    const weekdays = local[id]?.weekdays ?? [];
    return { id, title: g.name, time: { weekdays, time: '', tz: 'Asia/Seoul' } };
  });
}

/** 요일만 저장한다. startTime · timezone 은 서버가 정본이다. */
export function saveGroupWeekdays(studyId: number, groupId: string, weekdays: number[]) {
  try {
    const all = read(studyId);
    all[groupId] = { weekdays };
    localStorage.setItem(keyOf(studyId), JSON.stringify(all));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}
