import { afterEach, describe, expect, it, vi } from 'vitest';

import { meetingFormSchema, type MeetingFormValues } from './form-schema';

const draft: MeetingFormValues = {
  date: '2026-11-05',
  time: '20:00',
  title: '',
  repeat: 'none',
  until: '',
  weekdays: [],
};
afterEach(() => vi.useRealTimers());

describe('회차 추가 Zod 스키마', () => {
  it('유효한 단건을 허용하고 반복 요일·제목 오류를 필드에 연결한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T00:00:00Z'));
    const schema = meetingFormSchema([], 'Asia/Seoul', 'Asia/Seoul');
    expect(schema.safeParse(draft).success).toBe(true);
    const bad = schema.safeParse({ ...draft, repeat: 'weekly', until: '2026-11-12', title: '가'.repeat(51) });
    expect(bad.success).toBe(false);
    if (!bad.success)
      expect(bad.error.issues.map((issue) => issue.path[0])).toEqual(expect.arrayContaining(['title', 'weekdays']));
  });
  it('DST 중복 시각은 사용자가 선택한 UTC 시각이 있어야 통과한다', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-31T00:00:00Z'));
    const schema = meetingFormSchema([], 'America/New_York', 'America/New_York');
    const ambiguous = { ...draft, date: '2026-11-01', time: '01:30' };
    expect(schema.safeParse(ambiguous).success).toBe(false);
    expect(schema.safeParse({ ...ambiguous, occurrences: { '2026-11-01': '2026-11-01T05:30:00.000Z' } }).success).toBe(
      true,
    );
  });
});
