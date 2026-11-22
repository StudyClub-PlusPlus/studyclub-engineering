import {
  emailRevealSchema,
  eventDetailSchema,
  eventMailDetailSchema,
  eventMailPageSchema,
  eventMailPreviewSchema,
  eventPageSchema,
  eventRegistrationDetailSchema,
  eventRegistrationPageSchema,
  eventRegistrationRowSchema,
} from '@/features/events/response-schema';
import type { EventPayload, EventStatusTarget, MailAudience, MailType, RegistrationTarget } from '@/features/events/types';
import { http, qs } from '@/lib/http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function json(method: string, body: unknown, headers: Record<string, string> = {}): RequestInit {
  return { method, headers: { ...JSON_HEADERS, ...headers }, body: JSON.stringify(body) };
}

export function eventsPath(offset: number, limit: number): string {
  return `/api/admin/events${qs({ offset: offset || undefined, limit })}`;
}

export const events = (offset: number, limit: number) => http(eventsPath(offset, limit), eventPageSchema);

export const eventDetail = (eventId: number) => http(`/api/admin/events/${eventId}`, eventDetailSchema);

/** 같은 제출의 재시도는 같은 `idempotencyKey` 를 보낸다 — 서버가 행사를 두 번 만들지 않는다. */
export const createEvent = (payload: EventPayload, idempotencyKey: string) =>
  http('/api/admin/events', eventDetailSchema, json('POST', payload, { 'Idempotency-Key': idempotencyKey }));

/** 전체 교체다. `version` 은 상세에서 받은 값을 그대로 보낸다. */
export const updateEvent = (eventId: number, payload: EventPayload & { version: number }) =>
  http(`/api/admin/events/${eventId}`, eventDetailSchema, json('PUT', payload));

export const changeEventStatus = (eventId: number, status: EventStatusTarget, version: number) =>
  http(`/api/admin/events/${eventId}/status`, eventDetailSchema, json('PATCH', { status, version }));

export const eventRegistrations = (eventId: number, offset: number, limit: number) =>
  http(
    `/api/admin/events/${eventId}/registrations${qs({ offset: offset || undefined, limit })}`,
    eventRegistrationPageSchema,
  );

export const eventRegistration = (eventId: number, registrationId: number) =>
  http(`/api/admin/events/${eventId}/registrations/${registrationId}`, eventRegistrationDetailSchema);

/** 볼 때마다 서버가 감사 로그를 남긴다. 응답은 캐시하지 않는다. */
export const revealRegistrationEmail = (eventId: number, registrationId: number) =>
  http(`/api/admin/events/${eventId}/registrations/${registrationId}/email-reveals`, emailRevealSchema, {
    method: 'POST',
  });

export const decideRegistration = (eventId: number, registrationId: number, status: RegistrationTarget) =>
  http(
    `/api/admin/events/${eventId}/registrations/${registrationId}`,
    eventRegistrationRowSchema,
    json('PATCH', { status }),
  );

export type MailDraft = {
  type: MailType;
  audience: MailAudience;
  notice: string;
  displayTimeZone?: string;
};

export const previewEventMail = (eventId: number, draft: MailDraft) =>
  http(`/api/admin/events/${eventId}/mails/preview`, eventMailPreviewSchema, json('POST', draft));

export const sendEventMail = (eventId: number, draft: MailDraft & { templateId?: number }, idempotencyKey: string) =>
  http(`/api/admin/events/${eventId}/mails`, eventMailDetailSchema, json('POST', draft, { 'Idempotency-Key': idempotencyKey }));

export const eventMails = (eventId: number, offset: number, limit: number) =>
  http(`/api/admin/events/${eventId}/mails${qs({ offset: offset || undefined, limit })}`, eventMailPageSchema);

export const eventMail = (eventId: number, mailId: number) =>
  http(`/api/admin/events/${eventId}/mails/${mailId}`, eventMailDetailSchema);
