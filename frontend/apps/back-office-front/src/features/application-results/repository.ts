import { applicationResultsResponseSchema } from '@/features/application-results/response-schema';
import { http, qs } from '@/lib/http';

export function applicationResults(studyId: number, recruitmentId: string | undefined, signal: AbortSignal) {
  return http(`/api/admin/studies/${studyId}/applications${qs({ recruitmentId })}`, applicationResultsResponseSchema, {
    signal,
  });
}
