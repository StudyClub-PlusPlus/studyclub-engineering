
import type { SubmitApplicationPayload } from './types';
import { apiStudyApplicationFormSchema } from '@/features/applications/response-schema';
import { apiMyApplicationSchema } from '@/features/applications/response-schema';
import { emptyResponseSchema } from '@/lib/http';
import { http } from '@/lib/http';

export const getApplicationForm = (studyId: number) =>
  http(`/api/studies/${studyId}/application-form`, apiStudyApplicationFormSchema);

export const getMyApplication = (studyId: number) =>
  http(`/api/studies/${studyId}/applications/me`, apiMyApplicationSchema);

export function submitApplication(studyId: number, payload: SubmitApplicationPayload) {
  return http(`/api/studies/${studyId}/applications`, emptyResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
