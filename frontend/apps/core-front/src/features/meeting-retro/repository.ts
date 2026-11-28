// 미팅 회고 — specs/meeting-retro/spec.md 의 요청·응답 모양 그대로. 쓸 수 있는가 · 기한 · 내가 썼나는 서버가 내려준다.
import {
  apiRetroLikeSchema,
  apiRetroListSchema,
  apiRetroStatusSchema,
  apiRetroViewerSchema,
} from '@/features/meeting-retro/response-schema';
import type { RetroAnswers, RetroSectionKey } from '@/features/meeting-retro/types';
import { emptyResponseSchema, http } from '@/lib/http';

export function getRetroStatus(studyId: number, studyGroupId: number) {
  return http(`/api/me/studies/${studyId}/retros/status?studyGroupId=${studyGroupId}`, apiRetroStatusSchema);
}

export function getMeetingRetros(studyId: number, meetingId: number) {
  return http(`/api/studies/${studyId}/meetings/${meetingId}/retros`, apiRetroListSchema);
}

export function getRetroViewer(studyId: number, meetingId: number) {
  return http(`/api/me/studies/${studyId}/meetings/${meetingId}/retros`, apiRetroViewerSchema);
}

export function saveMyRetro(studyId: number, meetingId: number, body: RetroAnswers) {
  return http(`/api/me/studies/${studyId}/meetings/${meetingId}/retro`, emptyResponseSchema, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function setRetroLike(
  studyId: number,
  meetingId: number,
  retroId: number,
  section: RetroSectionKey,
  liked: boolean,
) {
  return http(
    `/api/studies/${studyId}/meetings/${meetingId}/retros/${retroId}/likes/${section}`,
    apiRetroLikeSchema,
    { method: liked ? 'PUT' : 'DELETE' },
  );
}
