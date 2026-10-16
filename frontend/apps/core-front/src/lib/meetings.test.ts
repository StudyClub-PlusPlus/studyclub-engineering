import { studies } from '@studyclub/mock';
import { describe, expect, it } from 'vitest';

import { meetingsOf } from './attendance';
import { addMeetings } from './meetings';

describe('joined study meetings', () => {
  it('returns a meeting added from the schedule form', () => {
    const study = studies[0];
    const store = new Map<string, string>();
    const storage = {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
    };
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

    addMeetings(study.id, {
      dates: ['2099-01-01'],
      time: '20:00',
      timeZone: 'Asia/Seoul',
      title: '새 회차',
    });

    expect(meetingsOf(study).some((meeting) => meeting.date === '2099-01-01')).toBe(true);
  });
});
