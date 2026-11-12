import type { ApiNoticeSendRequest } from './types';
import { apiNoticeComposeSchema } from '@/features/study-notices/response-schema';
import { noticeSentSchema } from '@/features/study-notices/response-schema';
import { apiNoticeListSchema } from '@/features/study-notices/response-schema';
// 스터디 공지 보내기 — specs/study-notice/spec.md 의 요청·응답 모양 그대로. 판정(보낼 수 있는가 · 디스코드가 되는가 · 한도)은
// 서버가 내려준다. 화면은 이 값을 그린다 (docs/backend-development-guide/api/endpoint-convention.md 「판정은 서버가 내려준다」).
import { http } from '@/lib/http';


const base = (studyId: number, groupId: number) => `/api/studies/${studyId}/groups/${groupId}/notices`;

export function getNoticeCompose(studyId: number, groupId: number) {
  return http(`${base(studyId, groupId)}/compose`, apiNoticeComposeSchema);
}

/** 접수까지만 응답한다. 메일이 나갔는지·디스코드가 올라갔는지는 기록으로 본다. */
export function sendNotice(studyId: number, groupId: number, body: ApiNoticeSendRequest) {
  return http(base(studyId, groupId), noticeSentSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getNotices(studyId: number, groupId: number, offset: number, limit: number) {
  return http(`${base(studyId, groupId)}?offset=${offset}&limit=${limit}`, apiNoticeListSchema);
}
