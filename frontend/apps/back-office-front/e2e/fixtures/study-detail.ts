import type { ApiStudyDetail } from '../../src/features/studies/types';

/** Complete StudyDetailResponse wire fixture. Overrides keep each smoke scenario readable. */
export function studyDetailFixture(overrides: Partial<ApiStudyDetail> = {}): ApiStudyDetail {
  return {
    id: 20,
    programId: 1,
    programTitle: '백오피스 테스트',
    title: '백엔드 스터디',
    oneLineSummary: '함께 공부합니다.',
    description: null,
    category: 'AI_ML',
    studyKind: 'STUDY',
    thumbnailUrl: null,
    status: 'DRAFT',
    recruitStatus: null,
    curriculum: null,
    capacity: null,
    schedule: null,
    timezone: null,
    recruitDeadlineAt: null,
    startAt: null,
    endAt: null,
    discordLinked: false,
    discordChannelUrl: null,
    driveUrl: null,
    ...overrides,
  };
}
