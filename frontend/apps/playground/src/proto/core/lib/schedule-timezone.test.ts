import { countCrewTimeZones, groupTimeZones, usedMemberTimeZones } from '@console/lib/crew-timezones';
import { daysUntil, upcomingEvents } from '@console/lib/dashboard';
import { formatConsoleTimestamp, getConsoleTimeZone, setConsoleTimeZone } from '@console/lib/display-timezone';
import { latestStartedMeeting, meetingWindow, meetingsOf } from '@core/lib/attendance';
import { weekDays, ymdInTz } from '@core/lib/joined';
import { getRegion, getTimeZone, setRegion, setTimeZone } from '@core/lib/me';
import {
  addMeetings,
  initialMeetingDraft,
  patchMeeting,
  planDraft,
  wallInputErrors,
  wallTimeChoices,
  resolveWallInput,
  wallLabel,
  wallParts,
  withAdded,
  zonedInstant,
} from '@core/lib/meetings';
import { recruitBadge } from '@core/lib/recruit';
import { regularScheduleDisplay } from '@core/lib/regular-schedule';
import { classSource, studySource } from '@core/lib/schedule-source';
import { resolveDisplayZone, SCHEDULE_ZONES, scheduleZoneTitle, zoneAbbreviation } from '@core/lib/schedule-timezone';
import { zoneOffset } from '@core/lib/time-zones';
import { createEventPreviewState, studies } from '@studyclub/mock';
import assert from 'node:assert/strict';

import { snapToOnboardingZone, isOnboardingTimeZone } from './onboarding';
import { matchesRecruitmentZone, recruitmentTimeZones, recruitmentZoneOptions, recruitmentZoneLabel } from './recruitment-timezones';
import { relativeTimeChanges } from './time-zone-preview';
import { availableZones, memberTimeZones, zoneSearchText } from './time-zones';
import { resolveEventInput, wallTime } from '../../events/model';
import { readMemberTimeZones, saveMemberTimeZone, seedMemberTimeZones } from '@/proto/lib/member-timezone-store';
import { recruitState, recruitmentDeadlineAt, recruitmentDeadlineLabel, recruitmentDaysLeft } from '@/proto/lib/recruitment-deadline';
import { createRecruitmentProjector, saveRecruitmentZones, withSavedRecruitmentZones } from '@/proto/lib/recruitment-zone-store';

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
assert.equal(scheduleZoneTitle(east), '뉴욕(ET)');
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
  label: '매주 수요일 06:30 · 뉴욕(EST)',
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
  '매주 금요일 21:00 · 뉴욕(EDT)',
);
// 종료한 반은 마지막 회차의 계절, 요일이 없는 반은 임의의 매주 요일을 만들지 않는다.
assert.equal(
  regularScheduleDisplay(seoulGroup, regularDates, east, new Date('2027-07-01T00:00:00Z')).label,
  regularTime.label,
);
assert.equal(
  regularScheduleDisplay({ ...seoulGroup, weekdays: [] }, [], east, fixtureNow).label,
  '07:30 · 뉴욕(EDT)',
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

// 반복은 1년까지 — 31일을 넘어도 만들고, 입력 지역의 1년이 반 달력의 1년 하루에 걸치면 종료일을 줄이도록 안내한다.
const longDaily = { ...lateDraft, date: '2026-10-31', time: '10:30', repeat: 'daily' as const, until: '2026-11-30' };
assert.equal(planDraft(longDaily, [], east, fixtureNow, seoul).plan?.dates.length, 31);
const yearDaily = { ...longDaily, date: '2027-11-05', until: '2028-11-05' };
const yearResult = planDraft(yearDaily, [], east, fixtureNow, seoul);
assert.equal(yearResult.plan, undefined);
assert.match(yearResult.errors.until!, /2028-11-04/);
// 봄 서머타임 시작 때 뉴욕 두 날이 서울 같은 날이 되어 하루를 건너뛴다 — 366일 중 365개
assert.equal(planDraft({ ...yearDaily, until: '2028-11-04' }, [], east, fixtureNow, seoul).plan?.dates.length, 365);
assert.equal(
  planDraft(longDaily, [{ id: 'occupied', no: 1, date: '2026-12-01' }], east, fixtureNow, seoul).plan?.dates.length,
  30,
);
// 같은 01:30의 두 순간을 구분하고, 기존 두 번째 순간은 초 단위까지 유지한다.
const secondOccurrence = '2026-11-01T06:30:00.000Z';
assert.deepEqual(
  wallTimeChoices('2026-11-01', '01:30', east).map((c) => c.scheduledAt),
  ['2026-11-01T05:30:00.000Z', secondOccurrence],
);
assert.equal(wallTimeChoices('2026-11-01', '01:30', vancouver).length, 1);
assert.equal(resolveWallInput('2026-11-01', '01:30', east).instant, undefined);
assert.equal(
  resolveWallInput('2026-11-01', '01:30', east, ['2026-11-01T06:30:42.000Z']).instant?.toISOString(),
  '2026-11-01T06:30:42.000Z',
);
const ambiguousDraft = { ...longDaily, date: '2026-11-01', time: '01:30', until: '2026-11-02' };
assert.equal(planDraft(ambiguousDraft, [], east, fixtureNow, seoul).plan, undefined);
const chosenRepeat = planDraft(
  { ...ambiguousDraft, occurrences: { '2026-11-01': secondOccurrence } },
  [],
  east,
  fixtureNow,
  seoul,
).plan!;
assert.deepEqual(chosenRepeat.scheduledAts, [secondOccurrence, '2026-11-02T06:30:00.000Z']);

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
setRegion('ETC');
setTimeZone(east);
assert.equal(getTimeZone(), east);
assert.equal(getRegion(), 'ETC', '표시 시간대 변경은 기존 모집 권역을 바꾸지 않는다');
const ambiguousSource = classSource({ key: 'ambiguous-repeat', base: [], timeZone: east, time: '01:30', people: [] });
ambiguousSource.add({
  dates: chosenRepeat.dates,
  scheduledAts: chosenRepeat.scheduledAts,
  time: '01:30',
  timeZone: east,
});
assert.deepEqual(
  ambiguousSource.meetings().map((m) => m.scheduledAt),
  chosenRepeat.scheduledAts,
);
const ambiguousMeeting = ambiguousSource.meetings()[0];
ambiguousSource.patch(ambiguousMeeting.id, { title: '제목만 변경' });
assert.equal(ambiguousSource.meetings()[0].scheduledAt, secondOccurrence);
ambiguousSource.patch(ambiguousMeeting.id, { scheduledAt: '2026-11-01T05:30:00.000Z' });
assert.equal(ambiguousSource.meetings()[0].scheduledAt, '2026-11-01T05:30:00.000Z');
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

console.log(
  '시간대 회귀 검사 통과: 프로필 우선, 날짜 이동, DST, 밴쿠버 PCT·LA 겨울 시차, 지역 전환, UTC 저장, 반복 기준',
);

// 전 세계 입력과 반복 회차의 현지 시각 유지.
const london = 'Europe/London';
const kathmandu = 'Asia/Kathmandu';
assert.equal(snapToOnboardingZone(london), london);
assert.equal(snapToOnboardingZone('America/Toronto'), 'America/Toronto');
assert.equal(snapToOnboardingZone('invalid'), '');
assert(isOnboardingTimeZone(kathmandu));
assert(availableZones('').length > 300);
assert(!availableZones('invalid').includes('invalid'));
assert(zoneSearchText(london).includes('런던'));
assert(zoneSearchText(london).includes('united kingdom'));
assert.equal(zonedInstant('2027-03-31', '19:00', kathmandu).toISOString(), '2027-03-31T13:15:00.000Z');
const londonWeekly = planDraft(
  { date: '2027-03-24', time: '19:00', title: '', repeat: 'weekly', until: '2027-03-31', weekdays: [3] },
  [], london, new Date('2027-03-01T00:00:00Z'), london,
).plan!;
assert.deepEqual(londonWeekly.scheduledAts, ['2027-03-24T19:00:00.000Z', '2027-03-31T18:00:00.000Z']);
assert.deepEqual(londonWeekly.scheduledAts.map((at) => wallParts(new Date(at), london).time), ['19:00', '19:00']);
assert.deepEqual(relativeTimeChanges(londonWeekly.scheduledAts, london, seoul), [{ at: '2027-03-31T18:00:00.000Z', before: '04:00', after: '03:00' }]);
assert.deepEqual(relativeTimeChanges(londonWeekly.scheduledAts, london, london), []);
assert.deepEqual(relativeTimeChanges(['2027-03-07T19:00:00Z', '2027-03-21T18:00:00Z'], east, west), []);

// 대시보드는 고유 회원을 집계하고, 미설정은 Others와 분리한다.
const counts = countCrewTimeZones([
  { email: 'a@test', timeZone: london }, { email: 'a@test', timeZone: london },
  { email: 'b@test', timeZone: null }, { email: 'c@test', timeZone: kathmandu },
]);
assert.equal(counts.reduce((sum, row) => sum + row.count, 0), 3);
assert.equal(counts.find((row) => row.key === 'unknown')?.count, 1);
// 헤더는 한 명뿐인 지역도 포함하되, 미사용 인기 도시·이전 선택값을 끼워 넣지 않는다.
const memberZones = usedMemberTimeZones([
  { email: 'a@test', timeZone: london }, { email: 'a@test', timeZone: london },
  { email: 'b@test', timeZone: null }, { email: 'c@test', timeZone: kathmandu },
  { email: 'd@test', timeZone: 'invalid' }, { email: 'e@test', timeZone: seoul },
]);
assert.deepEqual(memberTimeZones(east, 'ko', memberZones), [seoul, london, kathmandu]);
assert.deepEqual(memberTimeZones(east, 'ko', usedMemberTimeZones([])), []);
assert(memberTimeZones('', 'ko').length > 300); // 온보딩·행사 선택기는 전체 목록을 유지한다.
const manyZones = [seoul, east, west, london, kathmandu, 'Asia/Tokyo'].map((key, index) => ({ key, count: 10 - index }));
assert.equal(groupTimeZones(manyZones.slice(0, 5)).rest.length, 0);
assert.equal(groupTimeZones(manyZones).rows.length, 5);
assert.equal(groupTimeZones(manyZones).rest.length, 2);
const withMissing = groupTimeZones([...manyZones, { key: 'unknown', count: 1 }]);
assert.equal(withMissing.rows.length, 5);
assert.equal(withMissing.rest.length, 3);
assert(!withMissing.rest.some((row) => row.key === 'unknown'));
assert.equal(withMissing.rows.reduce((sum, row) => sum + row.count, 0), manyZones.reduce((sum, row) => sum + row.count, 1));

// 행사 시간대 변경은 초 단위와 중복 시각의 실제 순간까지 보존한다.
const originalEvent = '2027-11-07T06:30:45.123Z';
for (const zone of [london, kathmandu, east, vancouver]) {
  assert.equal(resolveEventInput(wallTime(originalEvent, zone), zone, undefined, originalEvent).iso, originalEvent);
}
assert.equal(wallTime('2027-01-07T07:30:00Z', vancouver), '2027-01-07T00:30');
console.log('전 세계 시간대·반 기준 반복·조건부 서머타임 안내·Others·행사 시각 보존 검사 통과');

// 기록 날짜의 서머타임, 날짜 경계, 45분 오프셋과 계정별 설정 격리.
assert.equal(formatConsoleTimestamp('2026-07-01T12:00:00Z', 'America/Toronto'), '2026-07-01 08:00 EDT');
assert.equal(formatConsoleTimestamp('2026-12-01T12:00:00Z', 'America/Toronto'), '2026-12-01 07:00 EST');
assert.equal(formatConsoleTimestamp('2026-07-01T23:30:00Z', 'Asia/Seoul'), '2026-07-02 08:30 KST');
assert.match(formatConsoleTimestamp('2026-07-01T23:30:00Z', 'Asia/Kathmandu'), /^2026-07-02 05:15 /);
assert.equal(formatConsoleTimestamp('invalid', 'Asia/Seoul'), 'invalid');
Object.defineProperty(window, 'localStorage', { value: localStorage });
setTimeZone(seoul);
memory.set('bo_user', JSON.stringify({ id: 1 }));
setConsoleTimeZone(london);
assert.equal(getConsoleTimeZone(), london);
assert.equal(getTimeZone(), seoul);
memory.set('bo_user', JSON.stringify({ id: 2 }));
assert.equal(getConsoleTimeZone(), seoul);
setConsoleTimeZone(kathmandu);
memory.set('bo_user', JSON.stringify({ id: 1 }));
assert.equal(getConsoleTimeZone(), london);
setConsoleTimeZone('invalid');
assert.equal(getConsoleTimeZone(), london);
memory.delete('bo_user');
assert.equal(getConsoleTimeZone(), seoul);
console.log('백오피스 기록 약칭·계정별 표시 설정·회원 시간대 격리 검사 통과');

// 같은 행사의 지역별 날짜는 달라도 예정 여부·실제 순서는 같다.
const auditEvent = { ...createEventPreviewState(new Date('2026-11-01T00:00:00Z')).events[0]!,
  id: 'zone-audit', publishedAt: '2026-10-01T00:00:00Z', startsAt: '2026-12-11T00:00:00Z' };
const auditNow = Date.parse('2026-11-22T02:00:00Z');
assert.equal(upcomingEvents([auditEvent], 'America/Toronto', auditNow)[0]?.date, '2026-12-10');
assert.equal(upcomingEvents([auditEvent], seoul, auditNow)[0]?.date, '2026-12-11');
assert.equal(upcomingEvents([{ ...auditEvent, status: 'CANCELLED' }], seoul, auditNow).length, 0);
assert.equal(upcomingEvents([{ ...auditEvent, publishedAt: undefined }], seoul, auditNow).length, 0);
assert.equal(upcomingEvents([auditEvent], seoul, Date.parse(auditEvent.startsAt) + 1).length, 0);
assert.equal(daysUntil('2026-12-31', wallParts(new Date(auditNow), 'America/Toronto').date), 40);
assert.equal(daysUntil('2026-12-31', wallParts(new Date(auditNow), seoul).date), 39);
// UTC 날짜는 내일이어도 아직 시작하지 않은 회차를 기본 출석 대상으로 고르지 않는다.
const attendanceMeetings = [
  { id: 'future', no: 2, date: '2026-11-21', scheduledAt: '2026-11-22T03:00:00Z' },
  { id: 'started', no: 1, date: '2026-11-21', scheduledAt: '2026-11-22T01:00:00Z' },
];
assert.equal(latestStartedMeeting(attendanceMeetings, (m) => new Date(m.scheduledAt), auditNow)?.id, 'started');
console.log('대시보드 행사 날짜·D-day·출석 기본 회차 경계 검사 통과');

// 모집 범위는 반의 시각과 독립적이며, 전체/선택/미정을 구분한다.
const selectedRecruit = { ...studies[0]!, recruitmentTimeZones: { mode: 'selected' as const, zones: [seoul, west] } };
const londonRecruit = { ...studies[1]!, recruitmentTimeZones: { mode: 'selected' as const, zones: [london] } };
const allRecruit = { ...studies[2]!, recruitmentTimeZones: { mode: 'all' as const, zones: [] } };
const unsetRecruit = { ...studies[3]!, recruitmentTimeZones: { mode: 'unset' as const, zones: [] } };
assert(matchesRecruitmentZone(selectedRecruit, seoul));
assert(matchesRecruitmentZone(selectedRecruit, west));
assert(!matchesRecruitmentZone(selectedRecruit, london));
assert(matchesRecruitmentZone(allRecruit, london));
assert(matchesRecruitmentZone(allRecruit, kathmandu));
assert(matchesRecruitmentZone(unsetRecruit, seoul));
assert(matchesRecruitmentZone(unsetRecruit, west));
assert(matchesRecruitmentZone(unsetRecruit, london));
assert(matchesRecruitmentZone(unsetRecruit, 'all'));
assert.deepEqual(recruitmentZoneOptions([selectedRecruit, londonRecruit, allRecruit, unsetRecruit], 'ko'), [seoul, west, london]);
assert.deepEqual(recruitmentZoneOptions([allRecruit, unsetRecruit], 'ko'), []);
assert.deepEqual(recruitmentTimeZones({ ...studies[0]!, timezone: 'PST' }), { mode: 'selected', zones: [west] });
assert.deepEqual(recruitmentTimeZones({ ...studies[0]!, timezone: 'both' }), { mode: 'selected', zones: [seoul, west] });
assert.equal(recruitmentZoneLabel(allRecruit, 'ko'), '모든 시간대에서 모집');
assert.equal(recruitmentZoneLabel(unsetRecruit, 'ko'), '미정');
assert.deepEqual(meetingsOf(selectedRecruit), meetingsOf({ ...selectedRecruit, recruitmentTimeZones: allRecruit.recruitmentTimeZones }));
console.log('모집 시간대: 복수 지역 OR·전체 및 미정 포함·기존 동시 진행·반 일정 독립 검사 통과');

// 전체 점검: 검색 별칭, 사라진 헤더 옵션, 다음 기수의 최신 모집 범위.
assert(zoneSearchText(west).split(/\s+/).includes('la'));
assert(zoneSearchText(vancouver).includes('밴쿠버'));
// 회원 후보에 없는 유효 지역도 헤더 저장값으로 유지한다.
const previousConsoleZone = getConsoleTimeZone();
setConsoleTimeZone('Pacific/Auckland');
assert.equal(getConsoleTimeZone(), 'Pacific/Auckland');
setConsoleTimeZone(previousConsoleZone);
assert.match(recruitBadge({ ...studies[0]!, status: 'recruiting', recruitment: { status: 'open', deadline: '2099-12-31T14:59:59Z' } }, 'ko', seoul, Date.parse('2099-12-30T00:00:00Z')).label, /D-1/);
const projectRecruitment = createRecruitmentProjector();
const firstProjection = projectRecruitment([studies[0]!, studies[1]!], { [studies[0]!.id]: allRecruit.recruitmentTimeZones });
const otherStudySaved = projectRecruitment([studies[0]!, studies[1]!], { [studies[0]!.id]: allRecruit.recruitmentTimeZones, [studies[1]!.id]: selectedRecruit.recruitmentTimeZones });
assert.strictEqual(firstProjection[0], otherStudySaved[0]);
assert.notStrictEqual(firstProjection[1], otherStudySaved[1]);
saveRecruitmentZones(studies[0]!.id, allRecruit.recruitmentTimeZones);
assert.equal(recruitmentTimeZones(withSavedRecruitmentZones(studies[0]!)).mode, 'all');
const brokenRecruit = { ...studies[0]!, recruitmentTimeZones: { mode: 'selected' as const, zones: ['invalid'] } };
assert.equal(recruitmentZoneLabel(brokenRecruit, 'ko'), '미정');
assert(matchesRecruitmentZone(brokenRecruit, east));
console.log('추가 점검: D-day·검색 별칭·헤더 후보·저장 입력 보존·새 기수 최신값 검사 통과');

// 정확한 마감 순간은 지역과 무관하고, D-day만 현지 날짜를 따른다.
const cutoff = Date.parse('2026-12-01T01:00:00Z');
const timedRecruit = { ...studies[0]!, status: 'recruiting' as const, recruitment: { status: 'open' as const, deadline: '2026-12-01T01:00:00Z' } };
assert.equal(recruitState(timedRecruit, cutoff - 1), 'apply');
assert.equal(recruitState(timedRecruit, cutoff), 'closed');
assert.equal(recruitState(timedRecruit, cutoff + 1), 'closed');
assert.equal(recruitmentDeadlineLabel(timedRecruit, seoul), '2026-12-01 10:00 KST');
assert.equal(recruitmentDeadlineLabel(timedRecruit, west), '2026-11-30 17:00 PST');
const before = Date.parse('2026-11-30T14:00:00Z');
assert.equal(recruitmentDaysLeft(timedRecruit, seoul, before), 1);
assert.equal(recruitmentDaysLeft(timedRecruit, west, before), 0);
for (const zone of [seoul, west, 'America/Toronto']) {
  assert.equal(recruitBadge(timedRecruit, 'ko', zone, cutoff).label, '모집 마감');
}
assert.equal(recruitState({ ...timedRecruit, recruitment: { ...timedRecruit.recruitment, status: 'closed' } }, before), 'closed');
assert.equal(recruitmentDeadlineAt({ ...timedRecruit, id: 'unknown-legacy', recruitment: { status: 'open', deadline: '2026-12-01' } }), undefined);
assert.equal(recruitmentDeadlineAt({ ...timedRecruit, recruitment: { status: 'open', deadline: '2026-12-01T10:00:00+09:00' } }), timedRecruit.recruitment.deadline.replace('Z', '.000Z'));
// 저장은 한 회원을 옮긴다. 이전 화면의 후보 스냅샷은 유지, 다음 조회만 새 후보 반영.
const uniqueZone = 'Pacific/Auckland';
const email = Object.keys(seedMemberTimeZones)[0]!;
const snapshot = readMemberTimeZones();
const total = Object.keys(snapshot).length;
saveMemberTimeZone(email.toUpperCase(), uniqueZone);
assert.equal(Object.keys(readMemberTimeZones()).length, total);
assert.notEqual(snapshot[email], uniqueZone);
assert.equal(readMemberTimeZones()[email], uniqueZone);
saveMemberTimeZone(email, 'not-a-zone');
assert.equal(readMemberTimeZones()[email], uniqueZone);
saveMemberTimeZone(email, snapshot[email]!);
setTimeZone(uniqueZone, 'preview-timezone-test@example.com');
assert.equal(readMemberTimeZones()['preview-timezone-test@example.com'], uniqueZone);
assert.equal(countCrewTimeZones([{email:'preview-timezone-test@example.com'}, {email:'PREVIEW-TIMEZONE-TEST@example.com'}])[0]?.count, 1);
console.log('회원 설정 집계 연결·스냅샷 유지·마감 순간 경계·지역별 D-day 검사 통과');
