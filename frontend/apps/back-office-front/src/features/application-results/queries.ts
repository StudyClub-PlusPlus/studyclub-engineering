import { useQuery } from '@tanstack/react-query';

import { applicationResults } from '@/features/application-results/repository';
import { studyKeys } from '@/features/studies/queries';

// 현재 회차는 all 키를 쓰고 회차를 고르면 그 아래에 둬서, all 하나로 모든 회차를 갱신한다.
export const applicationResultKeys = {
  all: (studyId: number) => [...studyKeys.detail(studyId), 'applications'] as const,
  list: (studyId: number, recruitmentId?: string) =>
    recruitmentId
      ? ([...applicationResultKeys.all(studyId), recruitmentId] as const)
      : applicationResultKeys.all(studyId),
};

export function useApplicationResults(studyId: number, recruitmentId?: string, enabled = true) {
  return useQuery({
    queryKey: applicationResultKeys.list(studyId, recruitmentId),
    queryFn: ({ signal }) => applicationResults(studyId, recruitmentId, signal),
    enabled,
  });
}
