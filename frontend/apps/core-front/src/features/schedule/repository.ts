import { apiMeetingListSchema } from '@/features/schedule/response-schema';
import { emptyResponseSchema } from '@/lib/http';
import { http } from '@/lib/http';

export function getStudyMeetings(studyId: number, studyGroupId?: number) {
  const qs = studyGroupId != null ? `?studyGroupId=${studyGroupId}` : '';
  return http(`/api/studies/${studyId}/meetings${qs}`, apiMeetingListSchema);
}

export function createStudyMeetings(
  studyId: number,
  body: { studyGroupId: number; scheduledAts: string[]; title?: string },
) {
  return http(`/api/studies/${studyId}/meetings`, emptyResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateStudyMeeting(
  studyId: number,
  meetingId: number,
  body: {
    scheduledAt: string;
    title?: string;
    presenter1ParticipantId?: number | null;
    presenter2ParticipantId?: number | null;
  },
) {
  return http(`/api/studies/${studyId}/meetings/${meetingId}`, emptyResponseSchema, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** 한 분반의 회차 여럿을 한 번에 지운다 — 전부 지우거나 하나도 안 지운다 (시작한 회차 · 킥오프가 섞이면 409). */
export function deleteStudyMeetings(studyId: number, studyGroupId: number, meetingIds: number[]) {
  return http(`/api/studies/${studyId}/meetings`, emptyResponseSchema, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studyGroupId, meetingIds }),
  });
}

export function saveStudyRules(studyId: number, groupId: number, rules: string) {
  return http(`/api/studies/${studyId}/groups/${groupId}/rules`, emptyResponseSchema, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rules }),
  });
}

export function registerPresenter(studyId: number, meetingId: number, slot: 1 | 2) {
  return http(`/api/studies/${studyId}/meetings/${meetingId}/presenters/${slot}/me`, emptyResponseSchema, { method: 'PUT' });
}

export function unregisterPresenter(studyId: number, meetingId: number, slot: 1 | 2) {
  return http(`/api/studies/${studyId}/meetings/${meetingId}/presenters/${slot}/me`, emptyResponseSchema, { method: 'DELETE' });
}
