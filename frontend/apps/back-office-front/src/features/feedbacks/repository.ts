import { apiAdminFeedbackDetailSchema, apiAdminFeedbackPageSchema } from '@/features/feedbacks/response-schema';
import type { FeedbackFilter, FeedbackPatch } from '@/features/feedbacks/types';
import { http, qs } from '@/lib/http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/** 목록 요청 경로. 값이 없는 조건은 넣지 않는다 — 「전체」일 때 유형·상태를 서버에 보내지 않는다. */
export function feedbacksPath(filter: FeedbackFilter): string {
  return `/api/admin/feedbacks${qs({
    type: filter.type,
    status: filter.status,
    q: filter.q?.trim(),
    offset: filter.offset,
    limit: filter.limit,
  })}`;
}

export function fetchFeedbacks(filter: FeedbackFilter) {
  return http(feedbacksPath(filter), apiAdminFeedbackPageSchema);
}

export function fetchFeedback(id: number) {
  return http(`/api/admin/feedbacks/${id}`, apiAdminFeedbackDetailSchema);
}

export function patchFeedback(id: number, body: FeedbackPatch) {
  return http(`/api/admin/feedbacks/${id}`, apiAdminFeedbackDetailSchema, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  });
}
