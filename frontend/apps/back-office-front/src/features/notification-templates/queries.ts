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

function fetchNotificationTemplates({ signal }: { signal: AbortSignal }): Promise<NotificationTemplate[]> {
  return http<NotificationTemplate[]>(BASE, { signal });
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: notificationTemplateKeys.list(),
    queryFn: fetchNotificationTemplates,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** 편집 시작 때마다 서버에서 읽는다. 단건 API가 없어 목록에서 해당 ID를 찾는다. */
export function useNotificationTemplateForEdit(id?: number) {
  return useQuery({
    queryKey: ['notification-template-editor', id],
    queryFn: async ({ signal }) => {
      const list = await fetchNotificationTemplates({ signal });
      return list.find((template) => template.id === id) ?? null;
    },
    enabled: id !== undefined,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

/** 저장은 조회를 기다리지 않는다. 이전 응답을 취소한 뒤 저장 이후의 목록을 새로 요청한다. */
export function useInvalidateTemplates() {
  const queryClient = useQueryClient();
  return () => {
    void (async () => {
      await queryClient.cancelQueries({ queryKey: notificationTemplateKeys.all });
      await queryClient.invalidateQueries({ queryKey: notificationTemplateKeys.all });
    })();
  };
}

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
