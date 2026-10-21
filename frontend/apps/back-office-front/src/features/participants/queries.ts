import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import type { GroupAssignmentsResponse, GroupChange, ParticipantsResponse } from './types';
import { studyKeys } from '@/features/studies/queries';
import { ApiError, http } from '@/lib/http';

export const participantKeys = {
  list: (studyId: number) => [...studyKeys.detail(studyId), 'participants'] as const,
};

async function handleParticipantError(client: QueryClient, studyId: number, error: Error) {
  if (!(error instanceof ApiError) || error.status !== 403) return;
  await client.cancelQueries({ queryKey: participantKeys.list(studyId) });
  client.setQueryData(participantKeys.list(studyId), null);
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
    mutationKey: participantKeys.list(studyId),
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
      return client.invalidateQueries({ queryKey: studyKeys.all });
    },
  });
}

export function useEditGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.list(studyId),
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
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.all }),
  });
}

export function useDeleteGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.list(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: (groupId: number) =>
      http<null>(`/api/admin/studies/${studyId}/groups/${groupId}`, { method: 'DELETE' }),
    onSettled: (_, error) => {
      if (error instanceof ApiError && error.status === 403) return;
      return client.invalidateQueries({ queryKey: studyKeys.all });
    },
  });
}
