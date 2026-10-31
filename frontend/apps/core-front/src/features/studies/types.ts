export type { ApiPage, ApiStudy, ApiStudyApplicationForm, ApiStudyDetail } from '@studyclub/mock/msw';

export type StudyPhaseFilter = 'recruiting' | 'ongoing' | 'closed';
export type StudyTimezoneFilter = 'KST' | 'PST' | 'both';

/** 스터디 목록 조건. 전부 선택 — 비우면 그 조건을 걸지 않는다. `category` 는 API enum 값(`AI_ML` …). */
export type StudySearch = {
  keyword?: string;
  status?: StudyPhaseFilter;
  timezone?: StudyTimezoneFilter;
  category?: string;
};
