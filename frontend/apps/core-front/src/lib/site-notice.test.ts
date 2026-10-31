import { describe, expect, it } from 'vitest';

import { noticeDate } from './site-notice';

describe('noticeDate', () => {
  it('보는 사람의 시간대 날짜로 자른다', () => {
    expect(noticeDate('2026-10-20T16:30:00Z', 'Asia/Seoul')).toBe('2026-10-21');
    expect(noticeDate('2026-10-20T16:30:00Z', 'America/Los_Angeles')).toBe('2026-10-20');
  });

  it('날짜가 아니면 받은 글자 그대로', () => {
    expect(noticeDate('n/a', 'Asia/Seoul')).toBe('n/a');
  });
});
