import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import {
  changeOwnerCaptain,
  deleteGroup,
  editGroup,
  participants,
  saveGroupAssignments,
} from '@/features/participants/repository';
import type { GroupChange, ParticipantsResponse } from '@/features/participants/types';
import { studyKeys } from '@/features/studies/queries';
import { userKeys } from '@/features/users/queries';
import { ApiError } from '@/lib/http';

export const participantKeys = {
  list: (studyId: number) => [...studyKeys.detail(studyId), 'participants'] as const,
  // 반 배정 저장만 따로 센다 — 반 이름 저장 중에는 이동을 막지 않는다.
  assignments: (studyId: number) => [...participantKeys.list(studyId), 'assignments'] as const,
  groups: (studyId: number) => [...participantKeys.list(studyId), 'groups'] as const,
  ownerCaptain: (studyId: number) => [...participantKeys.list(studyId), 'owner-captain'] as const,
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
    queryFn: ({ signal }) => participants(studyId, signal),
    enabled,
  });
}

export function useSaveGroupAssignments(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.assignments(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: (changes: GroupChange[]) => saveGroupAssignments(studyId, changes),
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

/** 담당 캡틴 바꾸기. 저장된 뒤에 명단을 다시 받아 칸과 「캡틴」 표시를 맞춘다. */
export function useChangeOwnerCaptain(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.ownerCaptain(studyId),
    onError: async (error) => {
      // 후보가 그새 캡틴이 아니게 됐을 수 있다(409 OWNER_CAPTAIN_NOT_ADMIN · 404) — 후보 목록도 다시 받는다
      if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 401) {
        await client.invalidateQueries({ queryKey: userKeys.all });
      }
      return handleParticipantError(client, studyId, error);
    },
    mutationFn: (accountId: number) => changeOwnerCaptain(studyId, accountId),
    // 옛 · 새 담당 캡틴의 권한 잠금(OWNS_STUDY)이 바뀌므로 유저 목록도 다시 받는다
    onSuccess: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: participantKeys.list(studyId) }),
        client.invalidateQueries({ queryKey: userKeys.all }),
      ]),
  });
}

export function useEditGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.groups(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: ({ groupId, name }: { groupId?: number; name: string }) => editGroup(studyId, groupId, name),
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.detail(studyId) }),
  });
}

export function useDeleteGroup(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationKey: participantKeys.groups(studyId),
    onError: (error) => handleParticipantError(client, studyId, error),
    mutationFn: (groupId: number) => deleteGroup(studyId, groupId),
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.detail(studyId) }),
  });
}
