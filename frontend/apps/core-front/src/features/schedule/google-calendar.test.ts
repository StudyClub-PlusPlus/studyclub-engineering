import { describe, expect, it } from 'vitest';

import { googleCalendarUrl } from './google-calendar';

describe('googleCalendarUrl', () => {
  it('시작 순간을 UTC 로 바꾸고 기본 1시간짜리 일정 링크를 만든다', () => {
    const url = new URL(
      googleCalendarUrl({
        title: '분산시스템 스터디 3회차 Raft',
        start: new Date('2026-11-20T11:00:00Z'),
        details: 'https://discord.com/channels/1/2',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('분산시스템 스터디 3회차 Raft');
    expect(url.searchParams.get('dates')).toBe('20261120T110000Z/20261120T120000Z');
    expect(url.searchParams.get('details')).toBe('https://discord.com/channels/1/2');
  });

  it('자정을 넘는 회차는 끝 날짜가 다음 날이고, 설명이 없으면 details 를 붙이지 않는다', () => {
    const url = new URL(googleCalendarUrl({ title: '킥오프', start: new Date('2026-12-31T23:30:00Z') }));
    expect(url.searchParams.get('dates')).toBe('20261231T233000Z/20270101T003000Z');
    expect(url.searchParams.has('details')).toBe(false);
  });
});
