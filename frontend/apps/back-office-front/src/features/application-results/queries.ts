import { useQuery } from '@tanstack/react-query';

import type { ApplicationResultsResponse } from './types';
import { applicationKeys } from '@/features/applications/queries';
import { http, qs } from '@/lib/http';

// 신청자 탭과 같은 API 다. 현재 회차는 같은 키를 쓰고 회차를 고르면 그 아래에 둬서, 한쪽을 갱신하면 둘 다 갱신된다.
export const applicationResultKeys = {
  all: (studyId: number) => applicationKeys.list(studyId),
  list: (studyId: number, recruitmentId?: string) =>
    recruitmentId ? ([...applicationKeys.list(studyId), recruitmentId] as const) : applicationKeys.list(studyId),
};

export function useApplicationResults(studyId: number, recruitmentId?: string, enabled = true) {
  return useQuery({
    queryKey: applicationResultKeys.list(studyId, recruitmentId),
    queryFn: ({ signal }) =>
      http<ApplicationResultsResponse>(`/api/admin/studies/${studyId}/applications${qs({ recruitmentId })}`, {
        signal,
      }),
    enabled,
  });
}
