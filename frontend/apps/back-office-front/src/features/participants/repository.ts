import {
  emptyResponseSchema,
  groupAssignmentsResponseSchema,
  groupSchema,
  participantsResponseSchema,
} from '@/features/participants/response-schema';
import type { GroupChange } from '@/features/participants/types';
import { http } from '@/lib/http';

export function participants(studyId: number, signal: AbortSignal) {
  return http(`/api/admin/studies/${studyId}/participants`, participantsResponseSchema, { signal });
}

export function saveGroupAssignments(studyId: number, changes: GroupChange[]) {
  return http(`/api/admin/studies/${studyId}/participants`, groupAssignmentsResponseSchema, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changes }),
  });
}

export function editGroup(studyId: number, groupId: number | undefined, name: string) {
  return http(`/api/admin/studies/${studyId}/groups${groupId == null ? '' : `/${groupId}`}`, groupSchema, {
    method: groupId == null ? 'POST' : 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
}

export function deleteGroup(studyId: number, groupId: number) {
  return http(`/api/admin/studies/${studyId}/groups/${groupId}`, emptyResponseSchema, { method: 'DELETE' });
}
