import { describe, expect, it } from 'vitest';

import {
  initialMeetingDraft,
  planDraft,
  resolveWallInput,
  wallTimeChoices,
  validateEdit,
  wallInputErrors,
  wallParts,
  zonedInstant,
} from './meetings';
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

describe('DST input boundaries', () => {
  const daily = {
    date: '2026-10-31',
    until: '2026-11-30',
    time: '10:30',
    title: '',
    repeat: 'daily' as const,
    weekdays: [],
  };

  it('checks the actual group calendar span before allowing a 31-day profile recurrence', () => {
    const blocked = planDraft(daily, [], east, now, seoul);
    expect(blocked.plan).toBeUndefined();
    expect(blocked.errors.until).toContain('서울(KST)');
    expect(blocked.errors.until).toContain('2026-11-29');
    const corrected = planDraft({ ...daily, until: '2026-11-29' }, [], east, now, seoul).plan!;
    expect(corrected.scheduledAts).toHaveLength(30);
    expect(wallParts(new Date(corrected.scheduledAts[0]), seoul).date).toBe('2026-10-31');
    expect(wallParts(new Date(corrected.scheduledAts.at(-1)!), seoul).date).toBe('2026-11-30');
    expect(planDraft({ ...daily, time: '09:30' }, [], east, now, seoul).plan?.dates).toHaveLength(31);
  });

  it('measures retained meetings, allowing a full input range when a conflicting endpoint is skipped', () => {
    const result = planDraft(daily, [{ id: 'last', no: 1, date: '2026-12-01' }], east, now, seoul);
    expect(result.errors).toEqual({});
    expect(result.plan?.dates).toHaveLength(30);
    expect(result.plan?.skipped[0].date).toBe('2026-11-30');
  });

  it('preserves the original repeated hour including seconds when the same wall time is entered again', () => {
    const original = '2026-11-01T06:30:15.123Z';
    expect(resolveWallInput('2026-11-01', '01:30', east, [original]).instant?.toISOString()).toBe(original);
    expect(resolveWallInput('2026-11-01', '01:30', east).instant).toBeUndefined();
    expect(wallTimeChoices('2026-11-01', '01:30', east).map((c) => c.scheduledAt)).toEqual([
      '2026-11-01T05:30:00.000Z',
      '2026-11-01T06:30:00.000Z',
    ]);
    expect(wallTimeChoices('2026-11-01', '01:30', la)).toHaveLength(2);
    expect(wallTimeChoices('2026-11-01', '01:30', vancouver)).toHaveLength(1);
    expect(wallTimeChoices('2027-03-14', '02:30', east)).toHaveLength(0);
  });

  it('requires a date-specific choice in recurring additions and preserves the selected instant', () => {
    const draft = { ...daily, date: '2026-11-01', until: '2026-11-02', time: '01:30' };
    const missing = planDraft(draft, [], east, now, seoul);
    expect(missing.plan).toBeUndefined();
    expect(missing.ambiguousTimes?.map((r) => r.date)).toEqual(['2026-11-01']);
    const chosen = planDraft(
      { ...draft, occurrences: { '2026-11-01': '2026-11-01T06:30:00.000Z' } },
      [],
      east,
      now,
      seoul,
    );
    expect(chosen.plan?.scheduledAts).toEqual(['2026-11-01T06:30:00.000Z', '2026-11-02T06:30:00.000Z']);
    expect(
      planDraft({ ...draft, occurrences: { '2026-11-01': '2026-11-01T07:30:00.000Z' } }, [], east, now, seoul).plan,
    ).toBeUndefined();
  });

  it('validates the selected second occurrence as future even after the first one has passed', () => {
    const edit = { date: '2026-11-01', time: '01:30', title: '', scheduledAt: '2026-11-01T06:30:00.000Z' };
    expect(validateEdit(edit, 'one', [{ ...edit, id: 'one', no: 1 }], east, new Date('2026-11-01T05:45:00Z'))).toEqual(
      {},
    );
  });
});
