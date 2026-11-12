import { describe, expect, it } from 'vitest';

import { pathToPageName } from './PageViewTracker';

describe('pathToPageName', () => {
  it.each([
    ['', 'landing'],
    ['/studies', 'studies_list'],
    ['/studies/12', 'study_detail'],
    ['/events', 'events_list'],
    ['/events/3', 'event_detail'],
    ['/notices', 'notices_list'],
    ['/notices/7', 'notice_detail'],
    ['/about', 'about'],
    ['/guide', 'guide'],
    ['/terms', 'terms'],
    ['/privacy', 'privacy'],
    ['/login', 'login'],
    ['/onboarding', 'onboarding'],
    ['/my', 'my_page'],
    ['/my/joined', 'my_studies'],
    ['/my/saved', 'saved_studies'],
    ['/my/leave', 'account_leave'],
    ['/my/joined/5/schedule', 'study_room_schedule'],
    ['/my/joined/5/schedule/attendance', 'study_room_attendance'],
    ['/my/joined/5/schedule/notice', 'study_room_notice'],
  ])('%s → %s', (path, name) => {
    expect(pathToPageName(path)).toBe(name);
  });

  it('곧장 다른 화면으로 넘기는 경로는 세지 않는다 — 도착한 화면에서 한 번만', () => {
    expect(pathToPageName('/my/joined/5')).toBeNull();
    expect(pathToPageName('/my/joined/5/attendance')).toBeNull();
  });
});
