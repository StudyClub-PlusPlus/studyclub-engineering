// 알림 템플릿 조회 — 키·fetcher·훅을 한곳에.
import { useQuery } from '@tanstack/react-query';

import type { NotificationTemplate } from '@/features/notification-templates/types';
import { http } from '@/lib/http';

export const notificationTemplateKeys = {
  all: ['notification-templates'] as const,
  list: () => [...notificationTemplateKeys.all, 'list'] as const,
};

function fetchNotificationTemplates(): Promise<NotificationTemplate[]> {
  return http<NotificationTemplate[]>('/api/admin/notification-templates');
}

export function useNotificationTemplates() {
  return useQuery({
    queryKey: notificationTemplateKeys.list(),
    queryFn: fetchNotificationTemplates,
  });
}

/**
 * 상세 — 단건 조회 API 가 아직 없어 목록에서 고른다. 템플릿은 이벤트당 한 건이라 목록이 짧다.
 * 같은 `queryKey` 를 쓰므로 목록 화면에서 들어오면 **요청이 한 번 더 나가지 않는다.**
 * 단건 API 가 생기면 이 훅의 queryKey·queryFn 만 바꾼다.
 */
export function useNotificationTemplate(id: number) {
  return useQuery({
    queryKey: notificationTemplateKeys.list(),
    queryFn: fetchNotificationTemplates,
    select: (list) => list.find((t) => t.id === id) ?? null,
  });
}
