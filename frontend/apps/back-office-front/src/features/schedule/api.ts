// 일정 탭의 서버 API — 반 회차 목록 · 킥오프 정하기 (specs/study-meeting/spec.md 「반 회차 목록 (백오피스)」 · 「킥오프 정하기 (백오피스)」).
//
// 둘 다 서버의 반 ID(`groupId`, Long)를 경로에 받는다. 백오피스는 아직 그 ID 를 모른다 — 반 목록 API
// (`GET /api/admin/studies/{id}/participants`)가 스펙 작성 중이다. 그래서 화면은 아직 `store.ts` 를 쓰고,
// 반 목록이 오면 `ScheduleTab` 이 이 훅으로 바꾼다.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Meeting, Person } from './meetings';
import { wallParts } from './time';
import { studyKeys } from '@/features/studies/queries';
import { http } from '@/lib/http';

type ApiPresenter = { participantId: number; name: string; active?: boolean };

type ApiMeeting = {
  id: number;
  type: 'KICKOFF' | 'REGULAR';
  /** 킥오프 0, 정규 회차는 일정순으로 1부터 — 서버가 센다. */
  number: number;
  scheduledAt: string;
  title: string | null;
  presenter1: ApiPresenter | null;
  presenter2: ApiPresenter | null;
  started: boolean;
};

/** 사이트 `GET /api/studies/{id}/meetings` 와 같은 응답. 백오피스는 `me` 가 늘 `{ participantId: null, canEdit: true }`. */
export type ApiGroupMeetings = {
  studyGroup: {
    id: number;
    name: string;
    /** IANA. 비어 있으면 서버가 `Asia/Seoul` 로 채운다. */
    timezone: string;
    startTime: string | null;
    navigatorName: string | null;
    rules: string | null;
  };
  me: { participantId: number | null; canEdit: boolean };
  /** 발표자 후보 — 그 반 활성 참여자, 이름순. */
  participants: { participantId: number; name: string }[];
  meetings: ApiMeeting[];
};

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

export const scheduleKeys = {
  meetings: (studyId: number, groupId: number) =>
    [...studyKeys.detail(studyId), 'groups', groupId, 'meetings'] as const,
};

export function useGroupMeetings(studyId: number, groupId: number | undefined) {
  return useQuery({
    queryKey: scheduleKeys.meetings(studyId, groupId ?? 0),
    queryFn: ({ signal }) =>
      http<ApiGroupMeetings>(`/api/admin/studies/${studyId}/groups/${groupId}/meetings`, { signal }),
    enabled: groupId !== undefined,
  });
}

/**
 * 킥오프를 정하거나 옮긴다 — 없으면 만들고 있으면 시각만 바꾼다. 204.
 * 400 은 1회차 날이나 그 뒤, 409 `MEETING_DATE_CONFLICT` 는 다른 회차와 같은 날 — 둘 다 `validateKickoff` 가 먼저 막는다.
 */
export function useSetKickoff(studyId: number, groupId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (scheduledAt: string) =>
      http<null>(`/api/admin/studies/${studyId}/groups/${groupId}/kickoff`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledAt }),
      }),
    onSettled: () => client.invalidateQueries({ queryKey: scheduleKeys.meetings(studyId, groupId) }),
  });
}
