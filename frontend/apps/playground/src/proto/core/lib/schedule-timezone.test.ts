import { meetingWindow, meetingsOf } from '@core/lib/attendance';
import { weekDays, ymdInTz } from '@core/lib/joined';
import { getTimeZone, setTimeZone } from '@core/lib/me';
import {
  addMeetings,
  initialMeetingDraft,
  patchMeeting,
  planDraft,
  wallInputErrors,
  wallLabel,
  wallParts,
  withAdded,
  zonedInstant,
} from '@core/lib/meetings';
import { confirmedRecruitSchedule, withConfirmedScheduleExample } from '@core/lib/recruit';
import { regularScheduleDisplay } from '@core/lib/regular-schedule';
import { classSource, studySource } from '@core/lib/schedule-source';
import { resolveDisplayZone, SCHEDULE_ZONES, scheduleZoneTitle, zoneAbbreviation } from '@core/lib/schedule-timezone';
import { zoneOffset } from '@core/lib/time-zones';
import { studies } from '@studyclub/mock';
import assert from 'node:assert/strict';

const seoul = 'Asia/Seoul';
const east = 'America/New_York';
const west = 'America/Los_Angeles';
const vancouver = 'America/Vancouver';
assert.equal(resolveDisplayZone(east, seoul), east);
assert.equal(resolveDisplayZone('', 'America/Toronto'), 'America/Toronto');
assert.equal(resolveDisplayZone('invalid', west), west);
assert.equal(resolveDisplayZone(undefined, 'invalid'), seoul);
assert.equal(SCHEDULE_ZONES.length, 4);
assert(SCHEDULE_ZONES.some((z) => z.iana === 'America/Vancouver'));
assert.equal(scheduleZoneTitle(east), '뉴욕·토론토(ET)');
assert.equal(scheduleZoneTitle(vancouver), '밴쿠버(PCT)');

const october = zonedInstant('2026-10-28', '20:30', seoul);
const november = zonedInstant('2026-11-04', '20:30', seoul);
assert.deepEqual(wallParts(october, west), { date: '2026-10-28', time: '04:30' });
assert.deepEqual(wallParts(november, west), { date: '2026-11-04', time: '03:30' });
assert.deepEqual(wallParts(october, vancouver), { date: '2026-10-28', time: '04:30' });
assert.deepEqual(wallParts(november, vancouver), { date: '2026-11-04', time: '04:30' });
assert.equal(wallLabel(november, vancouver), '11/4(수) 04:30');
assert.equal(zoneAbbreviation(vancouver, november), 'PCT');
assert.equal(zoneOffset(vancouver, november), 'UTC-07:00');
assert.equal(zoneOffset(west, november), 'UTC-08:00');
// 역사적인 겨울·마지막 봄 전환은 보존하고, 2026년 11월에는 LA만 한 시간 뒤로 간다.
const beforeSpring = new Date('2026-03-08T09:59:00Z');
const afterSpring = new Date('2026-03-08T10:00:00Z');
assert.deepEqual(wallParts(beforeSpring, vancouver), { date: '2026-03-08', time: '01:59' });
assert.deepEqual(wallParts(afterSpring, vancouver), { date: '2026-03-08', time: '03:00' });
assert.equal(zoneAbbreviation(vancouver, beforeSpring), 'PST');
assert.equal(zoneOffset(vancouver, new Date('2026-01-07T12:00:00Z')), 'UTC-08:00');
const beforeFall = new Date('2026-11-01T08:59:00Z');
const afterFall = new Date('2026-11-01T09:00:00Z');
assert.deepEqual(wallParts(beforeFall, vancouver), wallParts(beforeFall, west));
assert.deepEqual(wallParts(afterFall, vancouver), { date: '2026-11-01', time: '02:00' });
assert.deepEqual(wallParts(afterFall, west), { date: '2026-11-01', time: '01:00' });
assert.equal(zonedInstant('2026-11-01', '02:30', vancouver).toISOString(), '2026-11-01T09:30:00.000Z');
assert.equal(zonedInstant('2026-11-01', '02:30', west).toISOString(), '2026-11-01T10:30:00.000Z');
const winterMidnight = new Date('2027-01-07T07:30:00Z');
assert.equal(ymdInTz(winterMidnight, vancouver), '2027-01-07');
assert.equal(ymdInTz(winterMidnight, west), '2027-01-06');
assert.deepEqual(wallParts(winterMidnight, 'Canada/Pacific'), wallParts(winterMidnight, vancouver));
assert.equal(zoneAbbreviation(vancouver, new Date('2027-07-07T12:00:00Z')), 'PCT');
assert.equal(zoneAbbreviation(west, october), 'PDT');
assert.equal(zoneAbbreviation(west, november), 'PST');
assert.equal(zoneAbbreviation(east, october), 'EDT');
assert.equal(zoneAbbreviation(east, november), 'EST');
assert.deepEqual(wallParts(zonedInstant('2026-10-31', '10:00', seoul), east), { date: '2026-10-30', time: '21:00' });
assert.deepEqual(wallParts(zonedInstant('2026-11-04', '07:00', east), seoul), { date: '2026-11-04', time: '21:00' });
for (const { iana } of SCHEDULE_ZONES) {
  const wall = wallParts(november, iana);
  assert.equal(zonedInstant(wall.date, wall.time, iana).toISOString(), november.toISOString());
}
assert(wallInputErrors('2027-03-14', '02:30', west).time);
assert.deepEqual(wallInputErrors('2027-03-14', '02:30', vancouver), {});
assert(wallInputErrors('2026-03-08', '02:30', vancouver).time);
assert(wallInputErrors('', '07:00', east).date);
assert(wallInputErrors('invalid', '07:00', east).time);
assert.deepEqual(wallInputErrors('2027-03-14', '03:30', west), {});
const weekly = planDraft(
  { date: '2026-10-28', time: '20:30', title: '', repeat: 'weekly', until: '2026-11-04', weekdays: [3] },
  [],
  seoul,
  new Date('2026-10-01T00:00:00Z'),
);
assert.deepEqual(weekly.plan?.dates, ['2026-10-28', '2026-11-04']);

const seoulGroup = { id: 'wednesday', name: '수요일반', timeZone: seoul, startAt: '20:30', weekdays: [3] };
const fixtureNow = new Date('2026-10-30T00:00:00Z');
// 정규 시간은 오늘의 EDT가 아니라 가장 가까운 정규 회차(11/4)의 EST로 환산한다.
const regularDates = [
  { id: 'past', no: 1, date: '2026-10-28' },
  { id: 'next', no: 2, date: '2026-11-04' },
];
const regularTime = regularScheduleDisplay(
  seoulGroup,
  [{ id: 'kickoff', no: 0, kind: 'kickoff', date: '2026-10-31' }, ...regularDates],
  east,
  fixtureNow,
);
assert.deepEqual(regularTime, {
  label: '매주 수요일 06:30 · 뉴욕·토론토(EST)',
  original: '매주 수요일 20:30 · 서울(KST)',
  referenceDate: '2026-11-04',
});
assert.equal(
  regularScheduleDisplay(seoulGroup, regularDates, vancouver, fixtureNow).label,
  '매주 수요일 04:30 · 밴쿠버(PCT)',
);
assert.equal(regularScheduleDisplay(seoulGroup, regularDates, west, fixtureNow).label, '매주 수요일 03:30 · LA(PST)');
assert.equal(
  regularScheduleDisplay({ ...seoulGroup, startAt: '10:00', weekdays: [6] }, [], east, fixtureNow).label,
  '매주 금요일 21:00 · 뉴욕·토론토(EDT)',
);
// 종료한 반은 마지막 회차의 계절, 요일이 없는 반은 임의의 매주 요일을 만들지 않는다.
assert.equal(
  regularScheduleDisplay(seoulGroup, regularDates, east, new Date('2027-07-01T00:00:00Z')).label,
  regularTime.label,
);
assert.equal(
  regularScheduleDisplay({ ...seoulGroup, weekdays: [] }, [], east, fixtureNow).label,
  '07:30 · 뉴욕·토론토(EDT)',
);
// 개별 회차가 목요일 늦은 시각으로 옮겨져도 정규 수요일 20:30 자체는 유지한다.
const movedTime = regularScheduleDisplay(
  seoulGroup,
  [{ id: 'moved', no: 1, date: '2026-11-05', time: '23:00' }],
  east,
  fixtureNow,
);
assert.equal(movedTime.label, regularTime.label);
assert.equal(movedTime.original, regularTime.original);
const nextDraft = initialMeetingDraft(seoulGroup, [{ id: 'last', no: 6, date: '2026-11-18' }], east, fixtureNow);
assert.equal(nextDraft.date, '2026-11-25');
assert.equal(nextDraft.time, '06:30');
assert.equal(nextDraft.repeat, 'none');
const fridayDraft = initialMeetingDraft({ ...seoulGroup, startAt: '10:00', weekdays: [6] }, [], east, fixtureNow);
assert.equal(fridayDraft.date, '2026-10-30');
assert.equal(fridayDraft.time, '21:00');
assert.deepEqual(fridayDraft.weekdays, [5]);
const profileWeekly = planDraft(fridayDraft, [], east, fixtureNow, seoul);
assert.deepEqual(profileWeekly.plan?.dates.slice(0, 2), ['2026-10-30', '2026-11-06']);
assert.deepEqual(wallParts(zonedInstant('2026-11-06', fridayDraft.time, east), seoul), {
  date: '2026-11-07',
  time: '11:00',
});
// 내 날짜가 전날이어도, 반 기준 같은 날의 기존 회차·킥오프와 겹치면 막는다.
const lateDraft = { date: '2026-11-04', time: '23:00', title: '', repeat: 'none' as const, until: '', weekdays: [] };
assert(planDraft(lateDraft, [{ id: 'same', no: 2, date: '2026-11-05' }], east, fixtureNow, seoul).errors.date);
assert(planDraft(lateDraft, [{ id: 'earlier', no: 1, date: '2026-11-04' }], east, fixtureNow, seoul).plan);
assert(planDraft(lateDraft, [{ id: 'kickoff', no: 0, date: '2026-11-05' }], east, fixtureNow, seoul).errors.date);
// 봄 전환으로 서로 다른 입력 날짜가 반의 같은 날짜가 되는 경우도 하루 한 회차를 지킨다.
const springDaily = planDraft(
  { ...lateDraft, date: '2027-03-13', time: '10:30', repeat: 'daily', until: '2027-03-14' },
  [],
  east,
  fixtureNow,
  seoul,
);
assert.deepEqual(springDaily.plan?.dates, ['2027-03-13']);
assert.equal(springDaily.plan?.skipped[0]?.date, '2027-03-14');

// 실제 저장 경로를 거쳐, UTC 일정이 주간 캘린더에서 KST로 재해석되지 않는지 확인한다.
const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
  },
});
Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: () => true } });
setTimeZone(east);
assert.equal(getTimeZone(), east);
const ddia = studies.find((s) => s.id === 'ddia-2nd')!;
const profileSource = studySource(ddia, seoul);
profileSource.add({ dates: ['2026-11-25'], time: '06:30', timeZone: east });
const profileAdded = profileSource.meetings().find((m) => m.scheduledAt === '2026-11-25T11:30:00.000Z')!;
assert(profileAdded);
assert.deepEqual(wallParts(profileSource.startOf(profileAdded), east), { date: '2026-11-25', time: '06:30' });
assert.equal(profileAdded.time, '20:30');
const profileClassSource = classSource({ key: 'profile-class', base: [], timeZone: seoul, time: '10:00', people: [] });
profileClassSource.add({ dates: ['2026-11-06'], time: '20:00', timeZone: east });
const profileClassAdded = profileClassSource.meetings()[0];
assert.equal(profileClassAdded.scheduledAt, '2026-11-07T01:00:00.000Z');
assert.equal(profileClassAdded.date, '2026-11-07');
assert.equal(profileClassAdded.time, '10:00');
const repeatSource = classSource({ key: 'profile-repeat', base: [], timeZone: seoul, time: '10:00', people: [] });
repeatSource.add({ dates: profileWeekly.plan!.dates, time: fridayDraft.time, timeZone: east });
assert.deepEqual(
  repeatSource
    .meetings()
    .slice(0, 2)
    .map((m) => m.scheduledAt),
  ['2026-10-31T01:00:00.000Z', '2026-11-07T02:00:00.000Z'],
);
addMeetings(ddia.id, { dates: ['2026-11-04'], time: '18:30', timeZone: west });
const added = withAdded([], ddia.id).find((m) => m.scheduledAt === '2026-11-05T02:30:00.000Z')!;
assert(added);
const start = meetingWindow(ddia, added).start.toISOString();
patchMeeting(ddia.id, added.id, { title: '제목만 수정' }, seoul);
assert.equal(
  meetingWindow(
    ddia,
    meetingsOf(ddia).find((m) => m.id === added.id)!,
  ).start.toISOString(),
  start,
);
const day = weekDays([ddia], 'ko', east, '2026-11-02').find((d) => d.date === '2026-11-04')!;
assert.equal(day.hits.find((h) => h.meetingId === added.id)?.time, '21:30');
assert.equal(day.hits.find((h) => h.meetingId === added.id)?.abbreviation, 'EST');
// 밴쿠버 입력도 기존 저장 경로에서 UTC−7로 저장되고, LA에서는 한 시간 일찍 보인다.
addMeetings(ddia.id, { dates: ['2026-11-04'], time: '18:30', timeZone: vancouver });
const vancouverAdded = withAdded([], ddia.id).find((m) => m.scheduledAt === '2026-11-05T01:30:00.000Z')!;
assert(vancouverAdded);
const vancouverDay = weekDays([ddia], 'ko', vancouver, '2026-11-02').find((d) => d.date === '2026-11-04')!;
assert.equal(vancouverDay.hits.find((h) => h.meetingId === vancouverAdded.id)?.time, '18:30');
assert.equal(vancouverDay.hits.find((h) => h.meetingId === vancouverAdded.id)?.abbreviation, 'PCT');
const laDay = weekDays([ddia], 'ko', west, '2026-11-02').find((d) => d.date === '2026-11-04')!;
assert.equal(laDay.hits.find((h) => h.meetingId === vancouverAdded.id)?.time, '17:30');

const recruit = studies.find((s) => s.id === 'ai-paper-study')!;
assert.equal(confirmedRecruitSchedule(recruit, 'ko', east), undefined);
assert.equal(confirmedRecruitSchedule({ ...recruit, startAt: '2027-01-07', timezone: 'KST' }, 'ko', east), undefined);
const example = withConfirmedScheduleExample(recruit);
assert.deepEqual(confirmedRecruitSchedule(example, 'ko', east), {
  label: '2027-01-07 (목) 06:00',
  zone: '뉴욕·토론토(EST)',
});
assert.deepEqual(confirmedRecruitSchedule(example, 'ko', vancouver), {
  label: '2027-01-07 (목) 04:00',
  zone: '밴쿠버(PCT)',
});
assert.deepEqual(confirmedRecruitSchedule(example, 'ko', west), {
  label: '2027-01-07 (목) 03:00',
  zone: 'LA(PST)',
});
assert.equal(
  confirmedRecruitSchedule(
    { ...example, confirmedSchedule: { scheduledAt: '2027-01-07T20:00:00', timeZone: seoul } },
    'ko',
    east,
  ),
  undefined,
);
assert.equal(
  confirmedRecruitSchedule(
    { ...example, confirmedSchedule: { scheduledAt: '2027-01-07T11:00:00Z', timeZone: 'invalid' } },
    'ko',
    east,
  ),
  undefined,
);
console.log(
  '시간대 회귀 검사 통과: 프로필 우선, 날짜 이동, DST, 밴쿠버 PCT·LA 겨울 시차, 지역 전환, UTC 저장, 반복 기준, 확정 일정만 변환',
);
