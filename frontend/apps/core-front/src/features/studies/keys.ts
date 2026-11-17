import type { StudySearch } from './types';

export const studyKeys = {
  all: ['studies'] as const,
  list: (search: StudySearch) => [...studyKeys.all, 'list', search] as const,
  detail: (studyId: number) => [...studyKeys.all, 'detail', studyId] as const,
  joined: () => [...studyKeys.all, 'joined'] as const,
  groupInfo: (studyId: number) => [...studyKeys.all, 'group-info', studyId] as const,
  meetings: (studyId: number, groupId: number) => [...studyKeys.all, 'meetings', studyId, groupId] as const,
  attendance: (studyId: number, groupId: number) => [...studyKeys.all, 'attendance', studyId, groupId] as const,
};
