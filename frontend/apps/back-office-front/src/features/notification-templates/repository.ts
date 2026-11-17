import { emptyResponseSchema, notificationTemplateSchema } from '@/features/notification-templates/response-schema';
import type { NotificationTemplate, TemplateDraft } from '@/features/notification-templates/types';
import { http } from '@/lib/http';

export function fetchNotificationTemplates({ signal }: { signal: AbortSignal }): Promise<NotificationTemplate[]> {
  return http(BASE, notificationTemplateSchema.array(), { signal });
}

export const BASE = '/api/admin/notification-templates';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const timeout = () => AbortSignal.timeout(TEMPLATE_REQUEST_TIMEOUT_MS);

export const TEMPLATE_REQUEST_TIMEOUT_MS = 15_000;

export function createNotificationTemplate(draft: TemplateDraft) {
  return http(BASE, notificationTemplateSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(draft),
    signal: timeout(),
  });
}

export function updateNotificationTemplate(id: number, draft: TemplateDraft) {
  return http(`${BASE}/${id}`, notificationTemplateSchema, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(draft),
    signal: timeout(),
  });
}

export function deleteNotificationTemplate(id: number) {
  return http(`${BASE}/${id}`, emptyResponseSchema, { method: 'DELETE', signal: timeout() });
}
