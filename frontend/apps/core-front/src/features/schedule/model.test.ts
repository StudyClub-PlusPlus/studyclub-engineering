import type { StudyMeeting } from '@studyclub/types';
import { describe, expect, it } from 'vitest';

import { meetingRows } from './model';

describe('joined study detail rows', () => {
  it('keeps kickoff first and numbers regular meetings by displayed date', () => {
    const rows = meetingRows([
      { id: 'later', no: 2, date: '2026-10-22' },
      { id: 'kickoff', no: 0, date: '2026-10-08', kind: 'kickoff' } as StudyMeeting & { kind: 'kickoff' },
      { id: 'earlier', no: 1, date: '2026-10-15' },
    ]);

    expect(rows.map((row) => [row.id, row.no])).toEqual([
      ['kickoff', 0],
      ['earlier', 1],
      ['later', 2],
    ]);
  });
});
