// 일정 탭의 서버 상태 — 응답을 화면 모양으로 바꾸고(`toMeetings` · `toPeople` · `toUpdateBody`), React Query 로 읽고 쓴다.
// 서버 호출 자체는 `repository.ts` 에 있다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Meeting, Person } from './meetings';
import scheduleRepository, { type ApiGroupMeetings, type MeetingUpdatePayload } from './repository';
import type { MeetingPatch } from './store';
import { wallParts, zonedInstant } from './time';
import { studyKeys } from '@/features/studies/queries';

/** 응답 → 표의 회차. 일자 · 시각은 반 시간대 벽시계로 바꾼다. */
export function toMeetings(res: ApiGroupMeetings): Meeting[] {
  const tz = res.studyGroup.timezone || 'Asia/Seoul';
  return res.meetings.map((m) => ({
    id: String(m.id),
    no: m.number,
    kind: m.type === 'KICKOFF' ? 'kickoff' : undefined,
    scheduledAt: m.scheduledAt,
    ...wallParts(new Date(m.scheduledAt), tz),
    title: m.title ?? '',
    presenter1: m.presenter1 ? String(m.presenter1.participantId) : '',
    presenter2: m.presenter2 ? String(m.presenter2.participantId) : '',
    started: m.started,
  }));
}

/** 발표자 칸에 이름을 적을 사람 — 후보에 더해, 참여를 중단했어도 지난 회차에 이름이 남은 사람. */
export function toPeople(res: ApiGroupMeetings): Person[] {
  const byId = new Map(res.participants.map((p) => [String(p.participantId), p.name]));
  for (const m of res.meetings) {
    for (const p of [m.presenter1, m.presenter2]) {
      if (p && !byId.has(String(p.participantId))) byId.set(String(p.participantId), p.name);
    }
  }
  return [...byId].map(([id, name]) => ({ id, name }));
}

/** 회차를 고친 뒤 — 표와 출석부 열이 같이 바뀐다. */
function useRefetchMeetings(studyId: number, groupId: number) {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: scheduleKeys.group(studyId, groupId) });
}

export const scheduleKeys = {
  /** 반 하나의 회차 · 출석 — 회차를 고치면 출석부 열도 바뀌어 둘을 같이 다시 읽는다. */
  group: (studyId: number, groupId: number) => [...studyKeys.detail(studyId), 'groups', groupId] as const,
  meetings: (studyId: number, groupId: number) => [...scheduleKeys.group(studyId, groupId), 'meetings'] as const,
  attendance: (studyId: number, groupId: number) => [...scheduleKeys.group(studyId, groupId), 'attendance'] as const,
};

export function useGroupMeetings(studyId: number, groupId: number | undefined) {
  return useQuery({
    queryKey: scheduleKeys.meetings(studyId, groupId ?? 0),
    queryFn: ({ signal }) => scheduleRepository.fetchMeetings(studyId, groupId!, signal),
    enabled: groupId !== undefined,
  });
}

/** 킥오프를 정하거나 옮긴다. `scheduledAt` 은 UTC ISO. */
export function useSetKickoff(studyId: number, groupId: number) {
  const refetch = useRefetchMeetings(studyId, groupId);
  return useMutation({
    mutationFn: (scheduledAt: string) => scheduleRepository.setKickoff(studyId, groupId, scheduledAt),
    onSettled: refetch,
  });
}

/** 회차 추가 — 일자 · 시각은 반 시간대 벽시계로 받아 UTC 로 펼쳐 보낸다. */
export function useAddMeetings(studyId: number, groupId: number, tz: string) {
  const refetch = useRefetchMeetings(studyId, groupId);
  return useMutation({
    mutationFn: (input: { dates: string[]; time: string; title?: string }) =>
      scheduleRepository.createMeetings(studyId, groupId, {
        scheduledAts: input.dates.map((d) => zonedInstant(d, input.time, tz).toISOString()),
        title: input.title?.trim() || null,
      }),
    onSettled: refetch,
  });
}

/** 표의 고친 줄 → 수정 본문. 발표자 칸은 넘긴 것만 싣는다 — 그 사이 크루가 신청한 칸을 덮지 않는다. */
export function toUpdateBody(patch: MeetingPatch, tz: string): MeetingUpdatePayload {
  const presenter = (v: string | null) => (v ? Number(v) : null);
  return {
    scheduledAt: zonedInstant(patch.date, patch.time, tz).toISOString(),
    title: patch.title.trim() || null,
    ...(patch.presenter1 !== undefined && { presenter1ParticipantId: presenter(patch.presenter1) }),
    ...(patch.presenter2 !== undefined && { presenter2ParticipantId: presenter(patch.presenter2) }),
  };
}

/** 저장하지 못한 회차가 있다 — `failedIds` 줄의 고침은 표에 남는다. 문구는 첫 실패의 서버 문구다. */
export class MeetingSaveError extends Error {
  readonly failedIds: string[];

  constructor(failedIds: string[], cause: unknown) {
    super(cause instanceof Error ? cause.message : '');
    this.name = 'MeetingSaveError';
    this.failedIds = failedIds;
  }
}

/**
 * 회차 수정 — 서버는 한 번에 한 회차라 고친 줄마다 부른다. **모두 끝난 뒤** 실패한 회차를 모아 던진다 —
 * 첫 실패에서 끝내면 다시 읽기가 늦게 끝난 저장보다 먼저 돌아, 그 회차가 옛 값으로 남는다.
 */
export function useUpdateMeetings(studyId: number, groupId: number, tz: string) {
  const refetch = useRefetchMeetings(studyId, groupId);
  return useMutation({
    mutationFn: async (patches: Record<string, MeetingPatch>) => {
      const entries = Object.entries(patches);
      const results = await Promise.allSettled(
        entries.map(([id, patch]) =>
          scheduleRepository.updateMeeting(studyId, groupId, Number(id), toUpdateBody(patch, tz)),
        ),
      );
      const failed = entries.filter((_, i) => results[i].status === 'rejected').map(([id]) => id);
      const first = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (first) throw new MeetingSaveError(failed, first.reason);
    },
    onSettled: refetch,
  });
}

export function useDeleteMeetings(studyId: number, groupId: number) {
  const refetch = useRefetchMeetings(studyId, groupId);
  return useMutation({
    mutationFn: (ids: string[]) => scheduleRepository.deleteMeetings(studyId, groupId, ids.map(Number)),
    onSettled: refetch,
  });
}

/** 비운 규칙은 null 로 — 서버가 지운다. */
export function useSaveRules(studyId: number, groupId: number) {
  const refetch = useRefetchMeetings(studyId, groupId);
  return useMutation({
    mutationFn: (rules: string) => scheduleRepository.saveRules(studyId, groupId, rules.trim() || null),
    onSettled: refetch,
  });
}
