// 미팅 회고 — specs/meeting-retro/spec.md.
// 스터디 상세 회고 탭은 사용자 사이트와 같은 경로를 캡틴(ADMIN)으로 부른다 — 반은 상태 조회의 `studyGroupId`, 목록은 회차가 정한다.
// 회고 모아보기는 캡틴 전용 `/api/admin/retros`.
import {
  apiAdminRetrosSchema,
  apiRetroListSchema,
  apiRetroStatusSchema,
  apiRetroStudyOptionsSchema,
} from '@/features/meeting-retro/response-schema';
import type { AdminRetrosQuery } from '@/features/meeting-retro/types';
import { apiUrl, http, qs } from '@/lib/http';

export function getRetroStatus(studyId: number, studyGroupId: number) {
  return http(`/api/me/studies/${studyId}/retros/status${qs({ studyGroupId })}`, apiRetroStatusSchema);
}

export function getMeetingRetros(studyId: number, meetingId: number) {
  return http(`/api/studies/${studyId}/meetings/${meetingId}/retros`, apiRetroListSchema);
}

function adminRetrosParams(query: Omit<AdminRetrosQuery, 'offset' | 'limit'>) {
  return {
    studyId: query.studyId,
    meetingId: query.meetingId,
    q: query.q,
    section: query.section,
    sections: query.sections?.join(','),
    sort: query.sort,
    likeSort: query.likeSort,
    likeDir: query.likeSort ? query.likeDir : undefined,
  };
}

export function getAdminRetros(query: AdminRetrosQuery) {
  return http(
    `/api/admin/retros${qs({ ...adminRetrosParams(query), offset: query.offset, limit: query.limit })}`,
    apiAdminRetrosSchema,
  );
}

/** 링크로 바로 연다 — 브라우저가 쿠키를 싣고 서버가 첨부 파일로 내려준다. */
export function adminRetrosCsvUrl(query: Omit<AdminRetrosQuery, 'offset' | 'limit'>) {
  return apiUrl(`/api/admin/retros/export.csv${qs(adminRetrosParams(query))}`);
}

/** 모아보기는 진행 중인 스터디의 회고만 준다 — 고를 수 있는 스터디도 진행 중인 것만. 목록 API 의 한 번 최대(100건). */
export function getRetroStudyOptions() {
  return http(
    `/api/admin/studies${qs({ status: 'ONGOING', sort: 'TITLE_ASC', offset: 0, limit: 100 })}`,
    apiRetroStudyOptionsSchema,
  );
}
