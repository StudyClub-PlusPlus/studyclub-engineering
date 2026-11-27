import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query';

import { retroMeetingOptions } from '@/features/meeting-retro/model';
import {
  getAdminRetros,
  getMeetingRetros,
  getRetroStatus,
  getRetroStudyOptions,
} from '@/features/meeting-retro/repository';
import type { AdminRetrosQuery } from '@/features/meeting-retro/types';
import { useParticipants } from '@/features/participants/queries';
import { scheduleKeys } from '@/features/schedule/api';
import scheduleRepository from '@/features/schedule/repository';

export const retroKeys = {
  all: ['meeting-retros'] as const,
  status: (studyId: number, groupId: number) => [...retroKeys.all, 'status', studyId, groupId] as const,
  list: (studyId: number, meetingId: number) => [...retroKeys.all, 'list', studyId, meetingId] as const,
  admin: (query: AdminRetrosQuery) => [...retroKeys.all, 'admin', query] as const,
  studyOptions: () => [...retroKeys.all, 'study-options'] as const,
};

const valid = (a: number, b: number | undefined): b is number =>
  Number.isFinite(a) && a > 0 && b != null && Number.isFinite(b) && b > 0;

export function useRetroStatus(studyId: number, groupId: number | undefined) {
  return useQuery({
    queryKey: retroKeys.status(studyId, groupId ?? 0),
    queryFn: () => getRetroStatus(studyId, groupId!),
    enabled: valid(studyId, groupId),
    retry: false,
  });
}

export function useMeetingRetros(studyId: number, meetingId: number | undefined) {
  return useQuery({
    queryKey: retroKeys.list(studyId, meetingId ?? 0),
    queryFn: () => getMeetingRetros(studyId, meetingId!),
    enabled: valid(studyId, meetingId),
    retry: false,
  });
}

/** 조건을 바꾸는 동안 앞 결과를 남긴다 — 페이지 · 정렬을 바꿀 때 목록이 비었다 채워지며 튀지 않게. */
export function useAdminRetros(query: AdminRetrosQuery) {
  return useQuery({
    queryKey: retroKeys.admin(query),
    queryFn: () => getAdminRetros(query),
    placeholderData: keepPreviousData,
  });
}

export function useRetroStudyOptions() {
  return useQuery({
    queryKey: retroKeys.studyOptions(),
    queryFn: getRetroStudyOptions,
    select: (data) => data.items.map((s) => ({ value: String(s.studyId), label: s.title })),
  });
}

/** 회차 고르기의 목록 — 스터디를 골랐을 때만 그 스터디의 반 · 반별 회차를 읽는다(일정 탭과 같은 캐시). */
export function useRetroMeetingOptions(studyId: number | undefined) {
  const enabled = studyId !== undefined;
  const participants = useParticipants(studyId ?? 0, enabled);
  const groups = participants.data?.groups ?? [];
  const meetings = useQueries({
    queries: groups.map((g) => ({
      queryKey: scheduleKeys.meetings(studyId ?? 0, g.groupId),
      queryFn: ({ signal }: { signal: AbortSignal }) => scheduleRepository.fetchMeetings(studyId!, g.groupId, signal),
      enabled,
    })),
  });
  if (!enabled) return [];
  return retroMeetingOptions(
    groups.map((g, i) => ({ groupId: g.groupId, name: g.name, meetings: meetings[i]?.data?.meetings })),
  );
}
