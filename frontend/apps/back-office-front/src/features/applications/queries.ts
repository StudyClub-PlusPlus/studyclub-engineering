import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ApplicationDecisionPayload, ApplicationsResponse } from './types';
import { studyKeys } from '@/features/studies/queries';
import { ApiError, http } from '@/lib/http';

export const applicationKeys = {
  list: (studyId: number) => [...studyKeys.detail(studyId), 'applications'] as const,
};

/** 모집 회차를 생략하면 서버가 진행 중인 회차, 없으면 최근 회차를 선택한다. */
export function useApplications(studyId: number, enabled = true) {
  return useQuery({
    queryKey: applicationKeys.list(studyId),
    queryFn: ({ signal }) => http<ApplicationsResponse>(`/api/admin/studies/${studyId}/applications`, { signal }),
    enabled,
  });
}

export function useDecideApplications(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: ApplicationDecisionPayload) =>
      http<null>(`/api/admin/studies/${studyId}/applications/decisions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: studyKeys.all }),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) return;
      if (error instanceof ApiError && error.status === 403) {
        client.removeQueries({ queryKey: applicationKeys.list(studyId) });
      } else {
        return client.invalidateQueries({ queryKey: applicationKeys.list(studyId) });
      }
    },
  });
}
