import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import attendanceRepository from './repository';
import {
  type ApiAttendance,
  type ApiAttendanceStatus as ApiStatus,
  type AttendanceSavePayload,
  type AttendanceUpdate,
} from '@/features/attendance/repository';
import { scheduleKeys } from '@/features/schedule/api';
import type { AttendanceBook, AttendanceStatus } from '@/features/schedule/store';
import { studyKeys } from '@/features/studies/queries';

// 출석 탭의 서버 상태 — 명부 응답을 출석부 모양으로 바꾸고(`toBook` · `toUpdates`), React Query 로 읽고 쓴다.
// 서버 호출 자체는 `repository.ts` 에 있다. 열(회차)은 일정 탭과 같은 반 회차 목록(`schedule/api.ts` 의 `useGroupMeetings`)이다.

const FROM_API: Record<ApiStatus, AttendanceStatus> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  EXCUSED: 'excused',
};
const TO_API = Object.fromEntries(Object.entries(FROM_API).map(([k, v]) => [v, k])) as Record<
  AttendanceStatus,
  ApiStatus
>;

/**
 * 응답 → 출석부(참가자 ID → 회차 ID → 상태). ID 는 회차 표와 같이 문자열이다.
 * 미입력(null) 칸과 **시작 전 회차의 결석** 칸은 비운다 — 서버는 회차를 추가할 때 시작 전 회차에도 결석(`ABSENT`)을 미리 만든다.
 */
export function toBook(res: ApiAttendance, now: Date = new Date()): AttendanceBook {
  const upcoming = new Set(res.meetings.filter((m) => Date.parse(m.scheduledAt) > now.getTime()).map((m) => m.id));
  const shown = (a: { meetingId: number; status: ApiStatus | null }) =>
    a.status !== null && !(a.status === 'ABSENT' && upcoming.has(a.meetingId));
  return Object.fromEntries(
    res.participants.map((p) => [
      String(p.participantId),
      Object.fromEntries(
        p.attendances.filter(shown).map((a) => [String(a.meetingId), FROM_API[a.status as ApiStatus]]),
      ),
    ]),
  );
}

/**
 * 저장할 칸 — 지금 열(회차)에서 값이 바뀐 칸만. 서버는 칸을 비우지 못한다(상태는 필수) —
 * 저장된 값을 미체크로 되돌린 칸은 `cleared` 로 따로 센다.
 */
export function toUpdates(
  saved: AttendanceBook,
  next: AttendanceBook,
  columnIds: string[],
): { updates: AttendanceUpdate[]; cleared: number } {
  const updates: AttendanceUpdate[] = [];
  let cleared = 0;
  for (const pid of new Set([...Object.keys(saved), ...Object.keys(next)])) {
    for (const mid of columnIds) {
      const before = saved[pid]?.[mid];
      const after = next[pid]?.[mid];
      if (before === after) continue;
      if (after === undefined) cleared += 1;
      else updates.push({ meetingId: Number(mid), participantId: Number(pid), status: TO_API[after] });
    }
  }
  return { updates, cleared };
}

/** 참여를 중단한 사람까지 — 출석부 맨 아래 흐린 줄로 남는다. */
export function useGroupAttendance(studyId: number, groupId: number | undefined) {
  return useQuery({
    queryKey: scheduleKeys.attendance(studyId, groupId ?? 0),
    queryFn: ({ signal }) => attendanceRepository.fetchBook(studyId, groupId!, signal),
    enabled: groupId !== undefined,
  });
}

/** 출석과 참여 중단을 한 요청으로. */
export function useSaveAttendance(studyId: number, groupId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<AttendanceSavePayload, 'studyGroupId'>) =>
      attendanceRepository.save(studyId, { studyGroupId: groupId, ...body }),
    // 출석만이면 그 반(출석 · 회차)만. 참여 중단은 참여 명단 · 다른 탭 숫자도 바꿔 스터디 아래를 모두 다시 읽는다
    onSettled: (_data, _error, body) =>
      client.invalidateQueries({
        queryKey: body.withdrawals.length > 0 ? studyKeys.detail(studyId) : scheduleKeys.group(studyId, groupId),
      }),
  });
}
