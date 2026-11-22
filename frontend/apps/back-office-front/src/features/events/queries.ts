import { useRef } from 'react';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  changeEventStatus,
  createEvent,
  decideRegistration,
  eventDetail,
  eventMail,
  eventMails,
  eventRegistration,
  eventRegistrations,
  events,
  previewEventMail,
  revealRegistrationEmail,
  sendEventMail,
  updateEvent,
  type MailDraft,
} from '@/features/events/repository';
import {
  EVENT_PAGE_SIZE,
  MAIL_PAGE_SIZE,
  REGISTRATION_PAGE_SIZE,
  type EventDetail,
  type EventPayload,
  type EventStatusTarget,
  type RegistrationTarget,
} from '@/features/events/types';
import { ApiError } from '@/lib/http';

/** 넓은 키에서 좁은 키로 — `['events']` 를 무효화하면 목록·상세·참가자·메일이 모두 딸려 간다. */
export const eventKeys = {
  all: ['events'] as const,
  list: (page: number) => [...eventKeys.all, 'list', page] as const,
  detail: (eventId: number) => [...eventKeys.all, 'detail', eventId] as const,
  registrations: (eventId: number, page?: number) =>
    page === undefined
      ? ([...eventKeys.all, 'registrations', eventId] as const)
      : ([...eventKeys.all, 'registrations', eventId, page] as const),
  registration: (eventId: number, registrationId: number) =>
    [...eventKeys.all, 'registration', eventId, registrationId] as const,
  mails: (eventId: number, page?: number) =>
    page === undefined
      ? ([...eventKeys.all, 'mails', eventId] as const)
      : ([...eventKeys.all, 'mails', eventId, page] as const),
  mail: (eventId: number, mailId: number) => [...eventKeys.all, 'mail', eventId, mailId] as const,
};

export function useEvents(page: number) {
  return useQuery({
    queryKey: eventKeys.list(page),
    queryFn: () => events((page - 1) * EVENT_PAGE_SIZE, EVENT_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useEventDetail(eventId: number) {
  return useQuery({ queryKey: eventKeys.detail(eventId), queryFn: () => eventDetail(eventId), staleTime: 0 });
}

/**
 * 제출 시도마다 키를 하나 만든다. 응답을 못 받아 **같은 내용**을 다시 보낼 때만 같은 키를 쓴다(서버가 한 번만 만든다).
 * 서버는 같은 키면 처음 만든 결과를 돌려주므로, 내용이 바뀌었으면(`fingerprint` 가 다르면) 새 키다.
 * 성공하거나 서버가 요청을 거절(4xx)해도 비운다.
 */
export function useIdempotencyKey() {
  const ref = useRef<{ key: string; fingerprint: string } | null>(null);
  return {
    current(fingerprint: string) {
      if (ref.current?.fingerprint !== fingerprint) ref.current = { key: crypto.randomUUID(), fingerprint };
      return ref.current.key;
    },
    clear() {
      ref.current = null;
    },
  };
}

/** 응답을 받지 못한 실패(네트워크 오류·타임아웃)면 true — 서버가 처리했을 수 있어 키를 유지해야 한다. */
export function isUnknownOutcome(error: unknown): boolean {
  return !(error instanceof ApiError) || error.status >= 500;
}

function putDetail(queryClient: ReturnType<typeof useQueryClient>, detail: EventDetail) {
  queryClient.setQueryData(eventKeys.detail(detail.eventId), detail);
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, key }: { payload: EventPayload; key: string }) => createEvent(payload, key),
    onSuccess: (detail) => {
      putDetail(queryClient, detail);
      // 목록 재조회를 기다리지 않는다. 상세로 이동하는 쪽이 먼저다
      void queryClient.invalidateQueries({ queryKey: [...eventKeys.all, 'list'] });
    },
  });
}

export function useUpdateEvent(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: EventPayload & { version: number }) => updateEvent(eventId, payload),
    onSuccess: (detail) => {
      putDetail(queryClient, detail);
      // 확정 방식을 바꾸면 확인 대기 신청이 확정되므로 참가자·잔여석이 달라진다. 재조회는 기다리지 않는다
      void queryClient.invalidateQueries({ queryKey: eventKeys.registrations(eventId) });
      void queryClient.invalidateQueries({ queryKey: [...eventKeys.all, 'list'] });
    },
  });
}

export function useChangeEventStatus(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ status, version }: { status: EventStatusTarget; version: number }) =>
      changeEventStatus(eventId, status, version),
    onSuccess: (detail) => {
      putDetail(queryClient, detail);
      void queryClient.invalidateQueries({ queryKey: eventKeys.registrations(eventId) });
      void queryClient.invalidateQueries({ queryKey: [...eventKeys.all, 'list'] });
    },
  });
}

export function useEventRegistrations(eventId: number, page: number) {
  return useQuery({
    queryKey: eventKeys.registrations(eventId, page),
    queryFn: () => eventRegistrations(eventId, (page - 1) * REGISTRATION_PAGE_SIZE, REGISTRATION_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

/** 신청서 창을 열 때만 부른다. */
export function useEventRegistration(eventId: number, registrationId: number | null) {
  return useQuery({
    queryKey: eventKeys.registration(eventId, registrationId ?? 0),
    queryFn: () => eventRegistration(eventId, registrationId!),
    enabled: registrationId !== null,
    staleTime: 0,
  });
}

/** 원본 이메일은 쿼리 캐시에 두지 않는다 — 호출한 화면 메모리에서만 들고 있다. */
export function useRevealRegistrationEmail(eventId: number) {
  return useMutation({
    mutationFn: (registrationId: number) => revealRegistrationEmail(eventId, registrationId),
    gcTime: 0,
  });
}

export function useDecideRegistration(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ registrationId, status }: { registrationId: number; status: RegistrationTarget }) =>
      decideRegistration(eventId, registrationId, status),
    // 잔여석·배지·표시 상태가 달라지므로 상세와 목록을 다시 읽는다
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) }),
        queryClient.invalidateQueries({ queryKey: eventKeys.registrations(eventId) }),
      ]),
  });
}

export function useEventMailPreview(eventId: number, draft: MailDraft, enabled: boolean) {
  return useQuery({
    queryKey: [...eventKeys.all, 'mail-preview', eventId, draft],
    queryFn: () => previewEventMail(eventId, draft),
    enabled,
    staleTime: 0,
    gcTime: 0,
    // 대상·탭을 바꾸는 동안 받는 사람 수와 보내기 버튼이 깜빡이지 않게 이전 결과를 둔다
    placeholderData: keepPreviousData,
  });
}

export function useSendEventMail(eventId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, key }: { draft: MailDraft & { templateId?: number }; key: string }) =>
      sendEventMail(eventId, draft, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventKeys.mails(eventId) }),
  });
}

export function useEventMails(eventId: number, page: number) {
  return useQuery({
    queryKey: eventKeys.mails(eventId, page),
    queryFn: () => eventMails(eventId, (page - 1) * MAIL_PAGE_SIZE, MAIL_PAGE_SIZE),
    placeholderData: keepPreviousData,
    staleTime: 0,
  });
}

export function useEventMail(eventId: number, mailId: number | null) {
  return useQuery({
    queryKey: eventKeys.mail(eventId, mailId ?? 0),
    queryFn: () => eventMail(eventId, mailId!),
    enabled: mailId !== null,
  });
}
