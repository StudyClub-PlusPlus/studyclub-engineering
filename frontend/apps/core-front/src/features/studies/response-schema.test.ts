import { apiStudies, findApiStudyDetail } from '@studyclub/mock/msw';
import { describe, expect, it } from 'vitest';

import { apiStudySchema, apiStudyDetailSchema } from './response-schema';

describe('study catalog response contract', () => {
  it('accepts the complete catalog, including ongoing lifecycle records', () => {
    expect(apiStudySchema.array().safeParse(apiStudies).success).toBe(true);
  });
  it.each(['DRAFT', 'OPEN', 'ONGOING', 'ENDED', 'CLOSED'])('accepts backend StudyStatus %s', (status) => {
    expect(apiStudySchema.safeParse({ ...apiStudies[0], status }).success).toBe(true);
  });
  it('rejects invalid nested records instead of hiding them as an empty list', () => {
    expect(apiStudySchema.array().safeParse([{ ...apiStudies[0], studyId: 'bad' }]).success).toBe(false);
  });
});


describe('study detail response contract', () => {
  it('validates every shared catalog detail seed against the backend shape', () => {
    for (const study of apiStudies) {
      expect(apiStudyDetailSchema.safeParse(findApiStudyDetail(study.studyId)).success).toBe(true);
    }
  });
  it('requires the actual program title returned by the backend', () => {
    const detail = findApiStudyDetail(apiStudies[0]!.studyId);
    expect(apiStudyDetailSchema.safeParse({ ...detail, programTitle: null }).success).toBe(false);
    expect(apiStudyDetailSchema.safeParse({ ...detail, programTitle: undefined }).success).toBe(false);
  });
});
