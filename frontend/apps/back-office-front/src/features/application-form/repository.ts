import { applicationFormResponseSchema } from '@/features/application-form/response-schema';
import { toPayload } from '@/features/application-form/schema';
import { http } from '@/lib/http';

export function applicationForm(studyId: number, signal: AbortSignal) {
  return http(`/api/admin/studies/${studyId}/application-form`, applicationFormResponseSchema, { signal });
}

export function saveApplicationForm(
  studyId: number,
  values: {
    title: string;
    description: string;
    questions: {
      id: string;
      label: string;
      type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'select';
      required: boolean;
      description?: string | undefined;
      placeholder?: string | undefined;
      options?: string[] | undefined;
      allowOther?: boolean | undefined;
    }[];
  },
) {
  return http(`/api/admin/studies/${studyId}/application-form`, applicationFormResponseSchema, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toPayload(values)),
    signal: AbortSignal.timeout(30_000),
  });
}
