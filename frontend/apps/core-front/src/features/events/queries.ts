import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  cancelMyEventRegistration,
  fetchEventDetail,
  fetchEventList,
  fetchMyEventRegistration,
  fetchMyEvents,
  submitEventRegistration,
  type SubmitEventRegistrationPayload,
} from '@/features/events/repository';

export const eventKeys = {
  all: ['events'] as const,
  list: () => [...eventKeys.all, 'list'] as const,
  detail: (eventId: number) => [...eventKeys.all, 'detail', eventId] as const,
  myRegistration: (eventId: number) => [...eventKeys.all, 'my-registration', eventId] as const,
  myEvents: () => [...eventKeys.all, 'my-events'] as const,
};

export function useEventList(initial?: Awaited<ReturnType<typeof fetchEventList>>) {
  return useQuery({
    queryKey: eventKeys.list(),
    queryFn: fetchEventList,
    placeholderData: initial,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useEventDetail(eventId: number, initial?: Awaited<ReturnType<typeof fetchEventDetail>>) {
  return useQuery({
    queryKey: eventKeys.detail(eventId),
    queryFn: () => fetchEventDetail(eventId),
    placeholderData: initial,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useMyEventRegistration(eventId: number, enabled = false) {
  return useQuery({
    queryKey: eventKeys.myRegistration(eventId),
    queryFn: () => fetchMyEventRegistration(eventId),
    enabled,
  });
}

export function useMyEvents(enabled: boolean) {
  return useQuery({
    queryKey: eventKeys.myEvents(),
    queryFn: fetchMyEvents,
    enabled,
    staleTime: 30_000,
  });
}

export function useSubmitEventRegistration(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }: { payload: SubmitEventRegistrationPayload; idempotencyKey: string }) =>
      submitEventRegistration(eventId, payload, idempotencyKey),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.list() });
      void qc.invalidateQueries({ queryKey: eventKeys.myEvents() });
    },
  });
}

export function useCancelEventRegistration(eventId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (registrationId: number) => cancelMyEventRegistration(eventId, registrationId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      void qc.invalidateQueries({ queryKey: eventKeys.list() });
      void qc.invalidateQueries({ queryKey: eventKeys.myEvents() });
    },
  });
}