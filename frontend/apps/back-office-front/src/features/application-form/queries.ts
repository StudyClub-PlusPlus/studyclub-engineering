import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { applicationForm, saveApplicationForm } from '@/features/application-form/repository';
import { type ApplicationFormValues } from '@/features/application-form/schema';
import { applicationResultKeys } from '@/features/application-results/queries';
import { studyKeys } from '@/features/studies/queries';

export const applicationFormKeys = {
  detail: (studyId: number) => [...studyKeys.detail(studyId), 'application-form'] as const,
};

export function useApplicationForm(studyId: number) {
  return useQuery({
    queryKey: applicationFormKeys.detail(studyId),
    queryFn: ({ signal }) => applicationForm(studyId, signal),
  });
}

export function useSaveApplicationForm(studyId: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (values: ApplicationFormValues) => saveApplicationForm(studyId, values),
    onSuccess: (data) => {
      client.setQueryData(applicationFormKeys.detail(studyId), data);
      return client.invalidateQueries({ queryKey: applicationResultKeys.all(studyId) });
    },
  });
}
