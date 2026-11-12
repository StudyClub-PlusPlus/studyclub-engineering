import { describe, expect, it } from 'vitest';

import { joinedStudyIds } from '@/features/my-studies/mapper';
import { type ApiMyStudy } from '@/features/my-studies/types';

describe('joined studies API mapping', () => {
  it('returns participant study ids in API order', () => {
    const items: ApiMyStudy[] = [
      {
        studyId: 11,
        title: 'Study 11',
        category: 'OTHER',
        studyKind: 'STUDY',
        startAt: null,
        endAt: null,
        relation: 'ONGOING',
        participantStatus: 'ACTIVE',
        participantRole: 'LEADER',
        captain: false,
        discordChannelUrl: null,
        driveUrl: null,
        attendanceRate: null,
        meetings: [],
      },
      {
        studyId: 1,
        title: 'Study 1',
        category: 'OTHER',
        studyKind: 'STUDY',
        startAt: null,
        endAt: null,
        relation: 'UPCOMING',
        participantStatus: 'ACTIVE',
        participantRole: 'MEMBER',
        captain: true,
        discordChannelUrl: null,
        driveUrl: null,
        attendanceRate: null,
        meetings: [],
      },
    ];

    expect(joinedStudyIds(items)).toEqual(['11', '1']);
  });
});
