// 알림 템플릿 — 키·fetcher·훅을 한곳에.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { NotificationTemplate, TemplateDraft } from '@/features/notification-templates/types';
import { http } from '@/lib/http';

export const notificationTemplateKeys = {
  all: ['notification-templates'] as const,
  list: () => [...notificationTemplateKeys.all, 'list'] as const,
};

const BASE = '/api/admin/notification-templates';
const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * 저장·삭제 요청의 제한 시간. 팝업은 요청 중에 닫히지 않으므로, 응답이 끝내 오지 않으면 닫을 길이 없어진다.
 * 시간이 지나면 요청을 끊고 실패로 알려 팝업을 닫을 수 있게 한다.
 */
export const TEMPLATE_REQUEST_TIMEOUT_MS = 15_000;
const timeout = () => AbortSignal.timeout(TEMPLATE_REQUEST_TIMEOUT_MS);

function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  return http<NotificationTemplate[]>(BASE);
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: notificationTemplateKeys.list(),
    queryFn: fetchNotificationTemplates,
  });
}

/** 저장이 끝나면 목록을 다시 읽는다 — 마지막 수정 시각과 순서는 서버가 정한 값을 그린다. */
export function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  // promise 를 돌려주지 않는다 — 저장은 이미 끝났는데 목록 재조회가 끝날 때까지 팝업이 열려 있게 된다
  return () => {
    void queryClient.invalidateQueries({ queryKey: notificationTemplateKeys.all });
  };
}

// TODO(api): POST·PUT·DELETE /api/admin/notification-templates — 백엔드 구현 전이라 계약은 기획 PRD 의 API 표 기준이다.
export function useCreateNotificationTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (draft: TemplateDraft) =>
      http<NotificationTemplate>(BASE, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(draft),
        signal: timeout(),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateNotificationTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: TemplateDraft }) =>
      http<NotificationTemplate>(`${BASE}/${id}`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify(draft),
        signal: timeout(),
      }),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteNotificationTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: number) => http<null>(`${BASE}/${id}`, { method: 'DELETE', signal: timeout() }),
    onSuccess: () => invalidate(),
  });
}
