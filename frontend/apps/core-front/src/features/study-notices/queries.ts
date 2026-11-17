// 스터디 공지 — 키 · fetcher · 훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { NOTICE_PAGE, nextNoticeOffset, nextRefetchDelay } from './model';
import { getNoticeCompose, getNotices, sendNotice } from '@/features/study-notices/repository';
import type { ApiNoticeSendRequest } from '@/features/study-notices/types';


export const noticeKeys = {
  all: ['study-notices'] as const,
  compose: (studyId: number, groupId: number) => [...noticeKeys.all, 'compose', studyId, groupId] as const,
  list: (studyId: number, groupId: number) => [...noticeKeys.all, 'list', studyId, groupId] as const,
};

const valid = (studyId: number, groupId: number) =>
  Number.isFinite(studyId) && studyId > 0 && Number.isFinite(groupId) && groupId > 0;

/**
 * 보내기 화면 값. 한도는 시각이 흐르면 바뀌므로 오래 캐시하지 않고, 쿨다운이 끝나는 때에 맞춰 다시 받는다 (그러지 않으면 시각이 지나도 버튼이 안 풀린다).
 */
export function useNoticeCompose(studyId: number, groupId: number) {
  return useQuery({
    queryKey: noticeKeys.compose(studyId, groupId),
    queryFn: () => getNoticeCompose(studyId, groupId),
    enabled: valid(studyId, groupId),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (query.state.data ? nextRefetchDelay(query.state.data) : false),
  });
}

/**
 * 보낸 공지 기록. 「더 보기」는 offset 으로 다음 쪽을 이어 붙인다. 메일 대기가 완료로 넘어가는 것을 보이도록,
 * 대기 중인 것이 있으면 가끔 불러온 쪽 전부를 다시 받는다.
 */
export function useNotices(studyId: number, groupId: number) {
  return useInfiniteQuery({
    queryKey: noticeKeys.list(studyId, groupId),
    queryFn: ({ pageParam }) => getNotices(studyId, groupId, pageParam, NOTICE_PAGE),
    initialPageParam: 0,
    getNextPageParam: (_last, pages) => nextNoticeOffset(pages),
    enabled: valid(studyId, groupId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.pages.some((p) => p.items.some((n) => n.email.pending > 0 || n.discord.status === 'PENDING'))
        ? 10_000
        : false,
  });
}

/** 보낸 뒤 화면 값(한도)과 기록을 다시 받는다. 두 번 눌러 두 번 나가지 않도록 호출하는 쪽이 진행 중에는 막는다. */
export function useSendNotice(studyId: number, groupId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ApiNoticeSendRequest) => sendNotice(studyId, groupId, body),
    onSettled: () => queryClient.invalidateQueries({ queryKey: noticeKeys.all }),
  });
}
