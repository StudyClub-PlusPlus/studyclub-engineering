import type { StudyclubEvent } from '@studyclub/types';
import { describe, expect, it } from 'vitest';

import { eventJsonLd } from './jsonld';

const ev: StudyclubEvent = {
  id: 'e1',
  title: { ko: '밋업', en: 'Meetup' },
  summary: { ko: '요약', en: 'Summary' },
  date: '2026-12-01',
  type: 'meetup',
  location: { ko: '서울', en: 'Seoul' },
};

describe('eventJsonLd', () => {
  it('모르는 상태 · 남은 자리는 내보내지 않는다', () => {
    const ld = eventJsonLd(ev, 'ko', 'https://example.com/ko/events/e1');
    expect(ld).not.toHaveProperty('eventStatus');
    expect(ld).not.toHaveProperty('offers');
    expect(ld).toMatchObject({ '@type': 'Event', name: '밋업', startDate: '2026-12-01' });
  });
});
