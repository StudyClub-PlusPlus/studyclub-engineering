import type { ApplicationFormResponse } from '../../../src/features/application-form/types';
import type { ApiStudyDetail } from '../../../src/features/studies/types';
import type { ApiAdminAccount } from '../../../src/features/users/types';

/** Local synthetic data only. Keep dates and identifiers stable across runs. */
export const study: ApiStudyDetail = {
  id: 20, programId: 20, programTitle: '테스트 프로그램', title: '카탈로그 스터디',
  oneLineSummary: '함께 읽고 이야기하는 테스트 스터디', description: '목표\n매주 한 장씩 읽습니다.',
  category: 'AI_ML', studyKind: 'STUDY', thumbnailUrl: null, status: 'DRAFT', recruitStatus: null,
  curriculum: null, capacity: null, schedule: null, timezone: 'KST',
  recruitDeadlineAt: '2026-11-30T14:59:00Z', startAt: '2026-12-01T11:00:00Z', endAt: null,
  discordLinked: false, discordChannelUrl: null, driveUrl: null,
};
export const form: ApplicationFormResponse = {
  studyId: 20, title: '카탈로그 신청 폼', description: '관심 분야를 알려 주세요.',
  questions: [{ id: 'reason', label: '지원 사유', type: 'TEXTAREA', required: false }],
};
export const results = {
  respondentCount: 1, questions: form.questions,
  applications: [{ id: 1, recruitmentId: 1, discordNickname: '테스트크루', email: 'crew@example.com',
    answers: { reason: '매주 읽은 내용을 나누고 싶습니다.\n꾸준히 참여하겠습니다.' } }],
};
export const users: ApiAdminAccount[] = [
  { id: 1, name: '테스트캡틴', maskedEmail: 'c***@example.com', systemRole: 'ADMIN', navigatorOf: [],
    dormant: false, joinedAt: '2026-10-01T00:00:00Z', roleChangeBlockedReason: 'CANNOT_CHANGE_OWN_ROLE', discordLinked: true },
  { id: 2, name: '테스트크루', maskedEmail: 'm***@example.com', systemRole: 'MEMBER', navigatorOf: [],
    dormant: true, joinedAt: '2026-10-02T00:00:00Z', roleChangeBlockedReason: null, discordLinked: false },
];
export const template = { id: 1, eventType: 'USER_REGISTERED', channel: 'EMAIL',
  subject: '[StudyClub] 가입을 환영합니다', body: '안녕하세요, {{nickname}}님.\n함께 공부해요.',
  updatedAt: '2026-10-01T00:00:00Z', updatedByAdminId: 1 };
export const notice = { noticeId: 1, title: '11월 스터디 안내', author: '테스트캡틴',
  body: '새로운 스터디를 만나 보세요.\n자세한 내용은 스터디 목록에서 확인해 주세요.',
  publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' };
export const pageOf = (items: unknown[]) => ({ items, total: items.length, offset: 0, limit: 20 });
