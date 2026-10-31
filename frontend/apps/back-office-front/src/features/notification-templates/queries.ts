import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createNotificationTemplate,
  deleteNotificationTemplate,
  fetchNotificationTemplates,
  updateNotificationTemplate,
} from '@/features/notification-templates/repository';
import type { NotificationTemplate, TemplateDraft } from '@/features/notification-templates/types';

// 알림 템플릿 — 키·fetcher·훅을 한곳에.

export const notificationTemplateKeys = {
  all: ['notification-templates'] as const,
  list: () => [...notificationTemplateKeys.all, 'list'] as const,
  /**
   * 편집 팝업이 열릴 때 읽는 값. `all` 밖에 둔다 — 저장 실패(409·404) 뒤 목록을 다시 읽을 때 열린 팝업의 값까지
   * 취소·재조회되면 팝업이 불러오는 중으로 바뀐다.
   */
  editor: (id?: number) => ['notification-template-editor', id] as const,
};

export function useNotificationTemplates() {
  return useQuery({
    queryKey: notificationTemplateKeys.list(),
    queryFn: fetchNotificationTemplates,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** 편집할 템플릿과, 그 조건(알림 조건)에 있는 템플릿 수(자기 자신 포함). 삭제 확인의 영향 안내를 가르는 재료다. */
export type TemplateForEdit = { template: NotificationTemplate; sameConditionCount: number };

/** 편집 시작 때마다 서버에서 읽는다. 단건 API가 없어 목록에서 해당 ID를 찾고, 같은 조건의 템플릿 수도 그 목록에서 센다. */
export function useNotificationTemplateForEdit(id?: number) {
  return useQuery({
    queryKey: notificationTemplateKeys.editor(id),
    queryFn: async ({ signal }): Promise<TemplateForEdit | null> => {
      const list = await fetchNotificationTemplates({ signal });
      const template = list.find((item) => item.id === id);
      if (!template) return null;
      return { template, sameConditionCount: list.filter((item) => item.eventType === template.eventType).length };
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
    mutationFn: (draft: TemplateDraft) => createNotificationTemplate(draft),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateNotificationTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: ({ id, draft }: { id: number; draft: TemplateDraft }) => updateNotificationTemplate(id, draft),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteNotificationTemplate() {
  const invalidate = useInvalidateTemplates();
  return useMutation({
    mutationFn: (id: number) => deleteNotificationTemplate(id),
    onSuccess: () => invalidate(),
  });
}

export { TEMPLATE_REQUEST_TIMEOUT_MS } from './repository';
