import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { withLikeCount, withLiked } from '@/features/meeting-retro/model';
import {
  getMeetingRetros,
  getRetroStatus,
  getRetroViewer,
  saveMyRetro,
  setRetroLike,
} from '@/features/meeting-retro/repository';
import type { ApiRetroList, ApiRetroViewer, RetroAnswers, RetroSectionKey } from '@/features/meeting-retro/types';

export const retroKeys = {
  all: ['meeting-retros'] as const,
  status: (studyId: number, groupId: number) => [...retroKeys.all, 'status', studyId, groupId] as const,
  meeting: (studyId: number, meetingId: number) => [...retroKeys.all, 'meeting', studyId, meetingId] as const,
  list: (studyId: number, meetingId: number) => [...retroKeys.meeting(studyId, meetingId), 'list'] as const,
  viewer: (studyId: number, meetingId: number) => [...retroKeys.meeting(studyId, meetingId), 'viewer'] as const,
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

export function useRetroViewer(studyId: number, meetingId: number | undefined) {
  return useQuery({
    queryKey: retroKeys.viewer(studyId, meetingId ?? 0),
    queryFn: () => getRetroViewer(studyId, meetingId!),
    enabled: valid(studyId, meetingId),
    retry: false,
  });
}

/** 저장 뒤 그 회차 목록과 회차별 상태(탭 옆 점 · 버튼 문구)를 다시 받는다. */
export function useSaveMyRetro(studyId: number, meetingId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RetroAnswers) => saveMyRetro(studyId, meetingId, body),
    // 다시 받기를 기다리지 않는다 — 기다리면 저장 성공을 알리고 화면을 옮기는 일이 그만큼 늦는다
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: retroKeys.all });
    },
  });
}

/**
 * 👍 는 누르는 즉시 그린다(낙관적). 실패하면 그 칸을 되돌리고, 성공하면 서버가 준 수로 맞춘다.
 * 다른 👍 요청이 남아 있는 동안에는 다시 받지 않는다 — 받은 값이 아직 안 끝난 누름을 덮어 깜빡인다.
 */
export function useToggleRetroLike(studyId: number, meetingId: number) {
  const queryClient = useQueryClient();
  const listKey = retroKeys.list(studyId, meetingId);
  const viewerKey = retroKeys.viewer(studyId, meetingId);
  const mutationKey = [...retroKeys.meeting(studyId, meetingId), 'like'];
  const apply = (retroId: number, section: RetroSectionKey, liked: boolean) => {
    queryClient.setQueryData<ApiRetroList>(listKey, (list) =>
      list ? withLikeCount(list, retroId, section, liked) : list,
    );
    queryClient.setQueryData<ApiRetroViewer>(viewerKey, (viewer) =>
      viewer ? withLiked(viewer, retroId, section, liked) : viewer,
    );
  };
  return useMutation({
    mutationKey,
    mutationFn: (v: { retroId: number; section: RetroSectionKey; liked: boolean }) =>
      setRetroLike(studyId, meetingId, v.retroId, v.section, v.liked),
    onMutate: async (v) => {
      await queryClient.cancelQueries({ queryKey: retroKeys.meeting(studyId, meetingId) });
      apply(v.retroId, v.section, v.liked);
    },
    // 그 칸만 되돌린다 — 통째로 복원하면 그 사이 누른 다른 칸까지 지운다
    onError: (_error, v) => apply(v.retroId, v.section, !v.liked),
    onSuccess: (res, v) => {
      queryClient.setQueryData<ApiRetroList>(listKey, (list) =>
        list ? withLikeCount(list, v.retroId, v.section, res.liked, res.count) : list,
      );
      queryClient.setQueryData<ApiRetroViewer>(viewerKey, (viewer) =>
        viewer ? withLiked(viewer, v.retroId, v.section, res.liked) : viewer,
      );
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey }) > 1) return;
      return queryClient.invalidateQueries({ queryKey: retroKeys.meeting(studyId, meetingId) });
    },
  });
}
