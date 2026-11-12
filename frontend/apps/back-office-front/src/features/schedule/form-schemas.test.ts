import { describe, expect, it } from 'vitest';

import { groupRulesSchema, groupTimeSchema, kickoffSchema, meetingSchema } from '@/features/schedule/form-schemas';
import { RULES_MAX, TITLE_MAX, type Meeting } from '@/features/schedule/meetings';

const draft = { date: '2030-11-01', time: '20:00', title: '', repeat: 'none' as const, until: '', weekdays: [] };
const schema = meetingSchema([], 'Asia/Seoul', new Date('2030-10-01'));

describe('schedule form schemas', () => {
  it('rejects invalid calendar dates, times and weekdays before computing a plan', () => {
    expect(schema.safeParse({ ...draft, date: '2030-02-30' }).success).toBe(false);
    expect(schema.safeParse({ ...draft, time: '25:00' }).success).toBe(false);
    expect(schema.safeParse({ ...draft, weekdays: [7] }).success).toBe(false);
    expect(schema.safeParse(draft).success).toBe(true);
  });
  it('preserves repetition and title constraints', () => {
    expect(schema.safeParse({ ...draft, repeat: 'weekly', until: '2030-11-07' }).success).toBe(false);
    expect(schema.safeParse({ ...draft, title: 'x'.repeat(TITLE_MAX + 1) }).success).toBe(false);
    expect(schema.safeParse({ ...draft, repeat: 'daily', until: '2030-11-02' }).success).toBe(true);
  });
  it('allows past kickoff dates but rejects regular meeting conflicts', () => {
    const existing: Meeting[] = [
      {
        id: 'one',
        no: 1,
        date: '2030-11-01',
        scheduledAt: '2030-11-01T11:00:00Z',
        time: '20:00',
        title: '',
        presenter1: '',
        presenter2: '',
      },
    ];
    expect(kickoffSchema(existing).safeParse({ date: '2020-01-01', time: '20:00' }).success).toBe(true);
    expect(kickoffSchema(existing).safeParse({ date: '2030-11-01', time: '20:00' }).success).toBe(false);
  });
  it('requires group weekdays while allowing unspecified time and empty rules', () => {
    expect(groupTimeSchema.safeParse({ weekdays: [], time: '', tz: 'Asia/Seoul' }).success).toBe(false);
    expect(groupTimeSchema.safeParse({ weekdays: [1], time: '', tz: 'Asia/Seoul' }).success).toBe(true);
    expect(groupRulesSchema.safeParse({ rules: '' }).success).toBe(true);
    expect(groupRulesSchema.safeParse({ rules: 'x'.repeat(RULES_MAX + 1) }).success).toBe(false);
  });
});
