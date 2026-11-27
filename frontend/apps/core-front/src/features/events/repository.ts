import {
  eventDetailSchema,
  eventListSchema,
  eventRegistrationSchema,
  myEventsSchema,
  type ApiEventDetail,
  type ApiEventListItem,
  type ApiEventRegistration,
  type ApiMyEvent,
} from '@/features/events/response-schema';
import { http } from '@/lib/http';

export function fetchEventList() {
  return http('/api/events', eventListSchema);
}

export function fetchEventDetail(eventId: number) {
  return http(`/api/events/${eventId}`, eventDetailSchema);
}

export type SubmitEventRegistrationPayload = {
  channel: 'ONLINE' | 'OFFLINE';
  questionVersion: string;
  answers: Record<string, string[]>;
};

export function submitEventRegistration(eventId: number, payload: SubmitEventRegistrationPayload, idempotencyKey: string) {
  return http(`/api/events/${eventId}/registrations`, eventRegistrationSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
}

export function fetchMyEventRegistration(eventId: number) {
  return http(`/api/events/${eventId}/registrations/me`, eventRegistrationSchema);
}

export function cancelMyEventRegistration(eventId: number, registrationId: number) {
  return http(`/api/events/${eventId}/registrations/me?registrationId=${registrationId}`, eventRegistrationSchema, {
    method: 'DELETE',
  });
}

export function fetchMyEvents() {
  return http('/api/me/events', myEventsSchema);
}

export type { ApiEventDetail, ApiEventListItem, ApiEventRegistration, ApiMyEvent };