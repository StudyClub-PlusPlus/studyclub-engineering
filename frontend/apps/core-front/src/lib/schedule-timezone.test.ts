import { describe, expect, it } from 'vitest';

import { initialMeetingDraft, planDraft, wallInputErrors, wallParts, zonedInstant } from './meetings';
import { zoneOffset } from './onboarding';
import { regularScheduleDisplay } from './regular-schedule';
import { resolveDisplayZone, SCHEDULE_ZONES, zoneAbbreviation } from './schedule-timezone';

const seoul = 'Asia/Seoul';
const east = 'America/New_York';
const la = 'America/Los_Angeles';
const vancouver = 'America/Vancouver';
const group = { id: '10', name: '수요일반', timeZone: seoul, startAt: '20:30', weekdays: [3] };
const now = new Date('2026-10-30T00:00:00Z');

describe('profile-based study times', () => {
  it('prefers a valid profile and otherwise falls back to browser and Seoul', () => {
    expect(resolveDisplayZone(east, la)).toBe(east);
    expect(resolveDisplayZone('invalid', 'America/Toronto')).toBe('America/Toronto');
    expect(resolveDisplayZone(null, 'invalid')).toBe(seoul);
    expect(SCHEDULE_ZONES).toHaveLength(4);
  });

  it('keeps Vancouver at UTC−7 after its last spring transition, independently of LA', () => {
    const at = zonedInstant('2026-11-25', '20:30', seoul);
    expect(wallParts(at, vancouver)).toEqual({ date: '2026-11-25', time: '04:30' });
    expect(wallParts(at, la)).toEqual({ date: '2026-11-25', time: '03:30' });
    expect(zoneAbbreviation(vancouver, at)).toBe('PCT');
    expect(zoneAbbreviation(la, at)).toBe('PST');
    expect(zoneAbbreviation(la, now)).toBe('PDT');
    expect(zoneOffset(vancouver, at)).toBe('UTC-07:00');
    expect(zoneOffset(vancouver, new Date('2026-01-01T12:00:00Z'))).toBe('UTC-08:00');
    expect(wallInputErrors('2027-03-14', '02:30', vancouver)).toEqual({});
    expect(wallInputErrors('2027-03-14', '02:30', la).time).toBeTruthy();
    expect(wallInputErrors('2026-03-08', '02:30', vancouver).time).toBeTruthy();
  });

  it('uses the upcoming meeting season for the regular schedule and shifts weekdays', () => {
    const meetings = [
      { id: '0', no: 0, date: '2026-10-31' },
      { id: '1', no: 1, date: '2026-11-04' },
    ];
    expect(regularScheduleDisplay(group, meetings, east, now)).toMatchObject({
      label: '매주 수요일 06:30 · 뉴욕·토론토(EST)',
      original: '매주 수요일 20:30 · 서울(KST)',
    });
    expect(regularScheduleDisplay({ ...group, weekdays: [6], startAt: '10:00' }, [], east, now).label).toBe(
      '매주 금요일 21:00 · 뉴욕·토론토(EDT)',
    );
    expect(regularScheduleDisplay({ ...group, startAt: '' }, [], east, now).label).toBe('미정');
  });

  it('prefills the same next operating instant in the profile timezone', () => {
    const initial = initialMeetingDraft(group, [{ id: 'last', no: 6, date: '2026-11-18' }], east, now);
    expect(initial).toMatchObject({ date: '2026-11-25', time: '06:30' });
    expect(zonedInstant(initial.date, initial.time, east).toISOString()).toBe('2026-11-25T11:30:00.000Z');
  });

  it('checks collisions by group date even when the input date is the previous day', () => {
    const draft = { date: '2026-11-04', time: '23:00', title: '', repeat: 'none' as const, until: '', weekdays: [] };
    expect(planDraft(draft, [{ id: 'same', no: 1, date: '2026-11-05' }], east, now, seoul).errors.date).toBeTruthy();
    expect(planDraft(draft, [{ id: 'other', no: 1, date: '2026-11-04' }], east, now, seoul).plan).toBeTruthy();
    expect(planDraft(draft, [{ id: 'kickoff', no: 0, date: '2026-11-05' }], east, now, seoul).errors.date).toBeTruthy();
  });

  it('keeps repeated local input times across DST and rejects nonexistent recurrence times', () => {
    const draft = {
      date: '2026-10-30',
      time: '21:00',
      title: '',
      repeat: 'weekly' as const,
      until: '2026-11-06',
      weekdays: [5],
    };
    const result = planDraft(draft, [], east, now, seoul).plan!;
    expect(result.dates.map((date) => zonedInstant(date, draft.time, east).toISOString())).toEqual([
      '2026-10-31T01:00:00.000Z',
      '2026-11-07T02:00:00.000Z',
    ]);
    expect(
      planDraft(
        { ...draft, date: '2027-03-07', until: '2027-03-14', weekdays: [0], time: '02:30' },
        [],
        east,
        now,
        seoul,
      ).errors.time,
    ).toBeTruthy();
  });
});
