import {
  apiStudyDetailSchema,
  emptyResponseSchema,
  studyDiscordLinkSchema,
  studyProgramsSchema,
} from '@/features/studies/response-schema';
import type { StudyCreatePayload, StudyUpdatePayload } from '@/features/studies/types';
import { http } from '@/lib/http';

export const JSON_HEADERS = { 'Content-Type': 'application/json' };

export function clubPrograms() {
  return http('/api/admin/study-programs?studyKind=CLUB', studyProgramsSchema);
}

export function studyDetail(studyId: number) {
  return http(`/api/admin/studies/${studyId}`, apiStudyDetailSchema);
}

export function createStudy(payload: StudyCreatePayload) {
  return http('/api/admin/studies', emptyResponseSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function updateStudy(studyId: number, payload: StudyUpdatePayload) {
  return http(`/api/admin/studies/${studyId}`, emptyResponseSchema, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(payload),
  });
}

export function deleteStudy(studyId: number) {
  return http(`/api/admin/studies/${studyId}`, emptyResponseSchema, { method: 'DELETE' });
}

export function linkStudyDiscord(studyId: number, studyName: string) {
  return http(`/api/admin/studies/${studyId}/discord-link`, studyDiscordLinkSchema, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ studyName }),
  });
}

export function publishStudy(studyId: number, publish: boolean) {
  return http(`/api/admin/studies/${studyId}/${publish ? 'publish' : 'unpublish'}`, emptyResponseSchema, {
    method: 'POST',
  });
}
