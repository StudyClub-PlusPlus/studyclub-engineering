// 문의·오류 신고 — 제출 · 내 문의 목록 · 내 문의 상세 (specs/feedback/spec.md). 키·fetcher·훅을 한곳에. 브라우저가 백엔드를 직접 부른다.
// vitest 에 @ 별칭이 없어 상대 경로로 부른다.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  feedbackImageForm,
  PAGE_SIZE,
  type FeedbackStatus,
  type FeedbackSubmitBody,
  type FeedbackType,
} from './feedback';
import { myFeedbackDetailSchema, myFeedbackItemSchema, myFeedbackPageSchema } from './response-schema';
import { http } from '../../lib/http';
import { uploadImage } from '../../lib/upload';

/** 목록 한 줄 · 제출 201 응답. 서버 값을 그대로 쓴다 — 상태(`status`)는 서버가 정한 값이다. */
export type MyFeedbackItem = {
  id: number;
  type: FeedbackType;
  title: string;
  status: FeedbackStatus;
  /** 접수 시각. UTC ISO 8601 */
  createdAt: string;
};

export type MyFeedbackPage = {
  items: MyFeedbackItem[];
  total: number;
  offset: number;
  limit: number;
};

export type MyFeedbackDetail = MyFeedbackItem & {
  /** 평문. HTML 로 해석하지 않는다 */
  content: string;
  images: { url: string }[];
  /** 회신이 없으면 null — 화면은 「답변을 준비하고 있어요」 */
  reply: { content: string; repliedAt: string } | null;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** GET /api/me/feedbacks — 접수 시각 내림차순은 서버가 정한다. `page` 는 1부터. */
export function fetchMyFeedbacks(page: number): Promise<MyFeedbackPage> {
  const offset = (Math.max(1, page) - 1) * PAGE_SIZE;
  return http(`/api/me/feedbacks?offset=${offset}&limit=${PAGE_SIZE}`, myFeedbackPageSchema);
}

/** GET /api/me/feedbacks/{id} — 남의 것 · 없는 번호는 404 */
export function fetchMyFeedback(id: number): Promise<MyFeedbackDetail> {
  return http(`/api/me/feedbacks/${id}`, myFeedbackDetailSchema);
}

/** POST /api/feedbacks — 201 이면 목록 한 줄과 같은 모양 */
export function submitFeedback(body: FeedbackSubmitBody): Promise<MyFeedbackItem> {
  return http('/api/feedbacks', myFeedbackItemSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}

/** POST /api/uploads/images (purpose=FEEDBACK) — 고르는 즉시 올리고 번호를 모아 제출 본문에 싣는다 */
export function uploadFeedbackImage(file: File) {
  return uploadImage(feedbackImageForm(file));
}

/**
 * 방금 보낸 건을 첫 페이지 맨 위에 넣는다 — 다시 조회하지 않는다 (스펙 「제출」 201).
 * 첫 페이지를 아직 받은 적이 없으면 그대로 둔다(열 때 서버가 새로 준다).
 */
export function prependCreated(page: MyFeedbackPage | undefined, created: MyFeedbackItem): MyFeedbackPage | undefined {
  if (!page) return page;
  const rest = page.items.filter((item) => item.id !== created.id);
  return { ...page, items: [created, ...rest].slice(0, page.limit || PAGE_SIZE), total: page.total + 1 };
}

export const feedbackKeys = {
  // 계정을 키에 넣는다 — 같은 브라우저에서 다른 계정으로 다시 로그인해도 앞 사람의 문의가 보이지 않는다
  all: (accountId: number) => ['my-feedbacks', accountId] as const,
  list: (accountId: number, page: number) => [...feedbackKeys.all(accountId), 'list', page] as const,
  lists: (accountId: number) => [...feedbackKeys.all(accountId), 'list'] as const,
  detail: (accountId: number, id: number) => [...feedbackKeys.all(accountId), 'detail', id] as const,
};

export function useMyFeedbacks(accountId: number | undefined, page: number) {
  return useQuery({
    queryKey: feedbackKeys.list(accountId ?? 0, page),
    queryFn: () => fetchMyFeedbacks(page),
    enabled: accountId !== undefined,
    // 페이지를 넘기는 동안 표가 스켈레톤으로 깜빡이지 않게
    placeholderData: keepPreviousData,
  });
}

export function useMyFeedback(accountId: number | undefined, id: number | null) {
  return useQuery({
    queryKey: feedbackKeys.detail(accountId ?? 0, id ?? 0),
    queryFn: () => fetchMyFeedback(id as number),
    enabled: accountId !== undefined && id !== null,
  });
}

export function useSubmitFeedback(accountId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitFeedback,
    onSuccess: (created) => {
      // 다른 페이지는 한 칸씩 밀렸다 — 다음에 열 때 새로 받게만 해 둔다. 첫 페이지는 받은 값으로 바로 고친다
      void queryClient.invalidateQueries({ queryKey: feedbackKeys.lists(accountId), refetchType: 'none' });
      queryClient.setQueryData<MyFeedbackPage>(feedbackKeys.list(accountId, 1), (page) =>
        prependCreated(page, created),
      );
    },
  });
}
