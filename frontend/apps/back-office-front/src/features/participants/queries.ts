import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { GroupAssignmentsResponse, GroupChange, ParticipantsResponse } from './types';
import { studyKeys } from '@/features/studies/queries';
import { ApiError, http } from '@/lib/http';

export const participantKeys = {
  list: (studyId: number) => [...studyKeys.detail(studyId), 'participants'] as const,
  // 반 배정 저장만 따로 센다 — 반 이름 저장 중에는 이동을 막지 않는다.
  assignments: (studyId: number) => [...participantKeys.list(studyId), 'assignments'] as const,
  groups: (studyId: number) => [...participantKeys.list(studyId), 'groups'] as const,
};

async function handleParticipantError(client: QueryClient, studyId: number, error: Error) {
  // 401 은 앱 공통 처리(query-client)가 로그인 화면으로 보낸다.
  if (!(error instanceof ApiError) || error.status === 401) return;
  if (error.status === 403) {
    await client.cancelQueries({ queryKey: participantKeys.list(studyId) });
    client.setQueryData(participantKeys.list(studyId), null);
  } else if (error.status >= 400 && error.status < 500) {
    await client.invalidateQueries({ queryKey: participantKeys.list(studyId) });
  }
}

export function useParticipants(studyId: number, enabled = true) {
  return useQuery({
    queryKey: participantKeys.list(studyId),
    queryFn: ({ signal }) =>
      http<ParticipantsResponse | null>(`/api/admin/studies/${studyId}/participants`, { signal }),
    enabled,
  });
}

export function useSaveGroupAssignments(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.assignments(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: (changes: GroupChange[]) =>
      http<GroupAssignmentsResponse>(`/api/admin/studies/${studyId}/participants`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
      }),
    onSuccess: (result) => {
      client.setQueryData<ParticipantsResponse>(
        participantKeys.list(studyId),
        (current) =>
          current && {
            ...current,
            participants: current.participants.map((participant) => ({
              ...participant,
              ...result.participants.find((updated) => updated.participantId === participant.participantId),
            })),
          },
      );
      return client.invalidateQueries({ queryKey: studyKeys.detail(studyId) });
    },
  });
}

export function useEditGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.groups(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: ({ groupId, name }: { groupId?: number; name: string }) =>
      http<{ groupId: number; name: string }>(
        `/api/admin/studies/${studyId}/groups${groupId == null ? '' : `/${groupId}`}`,
        {
          method: groupId == null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.detail(studyId) }),
  });
}

export function useDeleteGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.groups(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: (groupId: number) =>
      http<null>(`/api/admin/studies/${studyId}/groups/${groupId}`, { method: 'DELETE' }),
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.detail(studyId) }),
  });
}
