import { studies } from '@studyclub/mock';
import { describe, expect, it } from 'vitest';

import { apiStudyDetailSchema } from './response-schema';
import { studyToApiStudyDetail } from '../../../../../packages/mock/src/msw/data';
import { studyDetailFixture } from '../../../e2e/fixtures/study-detail';

describe('StudyDetailResponse wire contract', () => {
  it('accepts the complete smoke fixture including nullable fields', () => {
    const fixture = studyDetailFixture();
    expect(apiStudyDetailSchema.parse(fixture)).toEqual(fixture);
  });
  it.each(['programId', 'programTitle', 'timezone', 'discordLinked'] as const)(
    'rejects an omitted %s rather than letting an incomplete detail reach the page',
    (field) => {
      const fixture: Record<string, unknown> = { ...studyDetailFixture() };
      delete fixture[field];
      expect(apiStudyDetailSchema.safeParse(fixture).success).toBe(false);
    },
  );
  it('rejects malformed server policy fields', () => {
    expect(apiStudyDetailSchema.safeParse({ ...studyDetailFixture(), discordLinked: 'false' }).success).toBe(false);
  });
});

it('shared MSW study detail seeds satisfy the admin API contract', () => {
  for (const study of studies) {
    expect(() => apiStudyDetailSchema.parse(studyToApiStudyDetail(study)), `study ${study.study_id}`).not.toThrow();
  }
});
