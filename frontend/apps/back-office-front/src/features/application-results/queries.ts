import { useQuery } from '@tanstack/react-query';

import type { ApplicationResultsResponse } from './types';
import { studyKeys } from '@/features/studies/queries';
import { http, qs } from '@/lib/http';

export const applicationResultKeys = {
  all: (studyId: number) => [...studyKeys.detail(studyId), 'application-results'] as const,
  list: (studyId: number, recruitmentId?: string) =>
    [...applicationResultKeys.all(studyId), recruitmentId ?? 'current'] as const,
};

export function useApplicationResults(studyId: number, recruitmentId?: string) {
  return useQuery({
    queryKey: applicationResultKeys.list(studyId, recruitmentId),
    queryFn: ({ signal }) =>
      http<ApplicationResultsResponse>(`/api/admin/studies/${studyId}/applications${qs({ recruitmentId })}`, {
        signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]),
      }),
  });
}
