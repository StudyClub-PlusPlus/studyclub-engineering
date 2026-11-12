// 백오피스 문의·오류 신고 — 목록·상세·처리(상태·회신·메모)의 키·훅. 서버 호출은 repository.ts.
import { toast } from '@studyclub/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { COPY } from '@/features/feedbacks/labels';
import { fetchFeedback, fetchFeedbacks, patchFeedback } from '@/features/feedbacks/repository';
import type { ApiAdminFeedbackDetail, FeedbackFilter, FeedbackStatus } from '@/features/feedbacks/types';
import { ApiError } from '@/lib/http';

/** 키는 넓은 것에서 좁은 것으로 쌓는다 — `['feedbacks']` 를 무효화하면 목록·상세가 전부 딸려 간다. */
export const feedbackKeys = {
  all: ['feedbacks'] as const,
  lists: () => [...feedbackKeys.all, 'list'] as const,
  list: (filter: FeedbackFilter) => [...feedbackKeys.lists(), filter] as const,
  detail: (id: number) => [...feedbackKeys.all, 'detail', id] as const,
};

export function useFeedbacks(filter: FeedbackFilter) {
  return useQuery({
    queryKey: feedbackKeys.list(filter),
    queryFn: () => fetchFeedbacks(filter),
    // 조건·페이지를 바꾸는 동안 이전 결과를 지우지 않는다 — 표가 깜빡이면 보던 자리를 잃는다.
    placeholderData: keepPreviousData,
  });
}

export function useFeedback(id: number, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: feedbackKeys.detail(id),
    queryFn: () => fetchFeedback(id),
    enabled: options.enabled ?? true,
  });
}

/**
 * 처리 결과를 반영하는 공통 길. PATCH 응답이 바뀐 뒤의 상세 전체라서 **다시 읽지 않고** 상세 캐시를 그 값으로 바꾼다
 * (상태 뱃지 · `selectableStatuses` · 완료 처리자 · 회신 칸이 함께 바뀐다). 목록은 상태·완료 처리자가 달라졌을 수 있어
 * 오래된 것으로만 표시해 둔다 — 지금 화면에 없으니 돌아갈 때 다시 읽는다.
 */
function useApplyDetail(id: number) {
  const queryClient = useQueryClient();
  return (detail: ApiAdminFeedbackDetail) => {
    queryClient.setQueryData(feedbackKeys.detail(id), detail);
    void queryClient.invalidateQueries({ queryKey: feedbackKeys.lists(), refetchType: 'none' });
  };
}

/**
 * 상태 변경 — 고르면 바로 저장(확인 창 없음).
 *
 * 응답 전에는 고른 값(`variables`)을 뱃지에 보이고, 실패하면 `isPending` 이 풀리며 캐시의 이전 값으로 돌아간다 —
 * 따로 되돌리는 코드를 두지 않는다. 409 는 `selectableStatuses` 로 미리 막으므로 다른 캡틴과 동시에 처리했을 때만 나온다:
 * 서버 문구를 그대로 띄우고 상세를 다시 읽어 지금 모습(완료됨 · 잠김)으로 맞춘다.
 */
export function useChangeFeedbackStatus(id: number) {
  const queryClient = useQueryClient();
  const apply = useApplyDetail(id);
  return useMutation({
    mutationFn: (status: FeedbackStatus) => patchFeedback(id, { status }),
    onSuccess: (detail) => {
      apply(detail);
      toast.success(COPY.statusChanged);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(err.message || COPY.statusFailed);
        return queryClient.invalidateQueries({ queryKey: feedbackKeys.detail(id) });
      }
      toast.error(COPY.statusFailed);
    },
  });
}

/**
 * 회신 전송 · 수정. 첫 회신이면 서버가 상태를 완료로 바꾸고 완료 처리자를 남긴다 — 화면은 응답을 그린다.
 * 수정은 새 회신이 아니다(보낸 시각 · 상태 그대로). `first` 는 안내 문구를 고르는 데만 쓴다.
 * 실패해도 입력은 남는다 — 입력칸은 호출한 화면의 state 라 여기서 비우지 않는다.
 */
export function useReplyFeedback(id: number) {
  const apply = useApplyDetail(id);
  return useMutation({
    mutationFn: ({ reply }: { reply: string; first: boolean }) => patchFeedback(id, { reply }),
    onSuccess: (detail, { first }) => {
      apply(detail);
      toast.success(first ? COPY.replySent : COPY.replyEdited);
    },
    onError: (_err, { first }) => toast.error(first ? COPY.replyFailed : COPY.replyEditFailed),
  });
}

/** 캡틴 전용 메모 저장. 빈 문자열이면 서버가 메모를 지운다(null). */
export function useSaveFeedbackMemo(id: number) {
  const apply = useApplyDetail(id);
  return useMutation({
    mutationFn: (adminMemo: string) => patchFeedback(id, { adminMemo }),
    onSuccess: (detail) => {
      apply(detail);
      toast.success(COPY.memoSaved);
    },
    onError: () => toast.error(COPY.memoFailed),
  });
}
