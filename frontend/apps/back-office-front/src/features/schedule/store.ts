import { z } from 'zod';

import type { GroupTime, ScheduleGroup } from '@/features/schedule/meetings';

/**
 * 일정 탭의 브라우저 저장소 — **반의 스터디 시간(요일 · 시각)만** 남는다.
 *
 * 반 · 회차 · 킥오프 · 규칙 · 출석은 서버가 정본이다 (`api.ts` · `features/attendance/api.ts`).
 * 스터디 시간은 서버가 아직 받지 않아(`PATCH /api/admin/studies/{id}/groups/{groupId}` 는 이름만) 여기에 둔다.
 * 시간대는 서버 반의 `timezone` 을 쓴다 — 회차를 그 시간대로 저장 · 검증하기 때문이다.
 * TODO(api): PATCH /api/admin/studies/{studyId}/groups/{groupId} — daysOfWeek · startTime · timezone
 *            (DAYS_OF_WEEK 마이그레이션 뒤). 붙으면 이 파일을 지운다.
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
  time: z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
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
 * 서버 반(참여 명단 `groups[]`)에 이 저장소의 요일 · 시각을 얹는다. 반 ID 는 서버 반 ID 그대로(문자열)다.
 * 시간대는 회차 목록을 받기 전이라 일단 `Asia/Seoul` — 부르는 쪽이 서버 반 시간대로 덮는다.
 */
export function groupsFromServer(studyId: number, server: { groupId: number; name: string }[]): ScheduleGroup[] {
  const local = read(studyId);
  return server.map((g) => {
    const id = String(g.groupId);
    const time = local[id] ?? { weekdays: [], time: '' };
    return { id, title: g.name, time: { ...time, tz: 'Asia/Seoul' } };
  });
}

/** 스터디 시간만 바꾼다. 회차는 더하지도 다시 깔지도 않는다 — 회차는 일정 표의 「회차 추가」로만 만든다. */
export function saveGroupTime(studyId: number, groupId: string, time: GroupTime) {
  try {
    const all = read(studyId);
    all[groupId] = { weekdays: time.weekdays, time: time.time };
    localStorage.setItem(keyOf(studyId), JSON.stringify(all));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}
