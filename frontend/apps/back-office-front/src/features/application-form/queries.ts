import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toPayload, type ApplicationFormValues } from './schema';
import type { ApplicationFormResponse } from './types';
import { studyKeys } from '@/features/studies/queries';
import { http } from '@/lib/http';

export const applicationFormKeys = {
  detail: (studyId: number) => [...studyKeys.detail(studyId), 'application-form'] as const,
};

export function useApplicationForm(studyId: number) {
  return useQuery({
    queryKey: applicationFormKeys.detail(studyId),
    queryFn: ({ signal }) =>
      http<ApplicationFormResponse>(`/api/admin/studies/${studyId}/application-form`, { signal }),
  });
}

export function useSaveApplicationForm(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: ApplicationFormValues) =>
      http<ApplicationFormResponse>(`/api/admin/studies/${studyId}/application-form`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(values)),
        signal: AbortSignal.timeout(30_000),
      }),
    onSuccess: (data) => {
      client.setQueryData(applicationFormKeys.detail(studyId), data);
    },
  });
}
