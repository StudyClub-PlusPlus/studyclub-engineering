import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isDormant, type DormancyFacts, type RosterPeriod } from './user-dormancy';
import { consoleUsers, USER_ACTIVITY_AS_OF } from './users';

const now = new Date('2026-10-31T00:00:00Z');
const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const inactive: DormancyFacts = { joinedAt: ago(400), lastLoginAt: ago(200), rosterPeriods: [] };
const ended = (days: number): RosterPeriod => ({
  studyId: 'sample',
  joinedAt: ago(300),
  ongoing: false,
  endedAt: ago(days),
});

test('180일간 로그인과 명부 참여가 모두 없을 때만 휴면이다', () => {
  assert.equal(isDormant(inactive, now), true);
  assert.equal(isDormant({ ...inactive, lastLoginAt: ago(1) }, now), false);
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(7)] }, now), false);
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(200)] }, now), true);
});

test('가입한 지 180일이 지나지 않은 회원은 제외한다', () => {
  assert.equal(isDormant({ ...inactive, joinedAt: ago(7) }, now), false);
  assert.equal(isDormant({ ...inactive, joinedAt: ago(180) }, now), false);
});

test('정확히 180일 전의 로그인이나 참여 종료도 최근 기록에 포함한다', () => {
  assert.equal(isDormant({ ...inactive, lastLoginAt: ago(180) }, now), false);
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(180)] }, now), false);
  const beforeCutoff = new Date(Date.parse(ago(180)) - 1).toISOString();
  assert.equal(isDormant({ ...inactive, lastLoginAt: beforeCutoff }, now), true);
});

test('명부 등록이 오래됐어도 현재 참여·일시 중단이면 휴면이 아니다', () => {
  assert.equal(
    isDormant({ ...inactive, rosterPeriods: [{ ...ended(300), ongoing: true, endedAt: null }] }, now),
    false,
  );
});

test('일시 중단 명부라도 스터디가 종료됐으면 정규화한 종료일로 판단한다', () => {
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(200)] }, now), true);
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(30)] }, now), false);
});

test('복수 스터디 중 하나라도 최근 참여 이력이 있으면 제외한다', () => {
  assert.equal(isDormant({ ...inactive, rosterPeriods: [ended(250), ended(7)] }, now), false);
});

test('로그인·가입·명부 이력·종료일이 불완전하면 휴면으로 단정하지 않는다', () => {
  for (const facts of [
    { ...inactive, joinedAt: null },
    { ...inactive, lastLoginAt: null },
    { ...inactive, lastLoginAt: 'invalid' },
    { ...inactive, rosterPeriods: null },
    { ...inactive, rosterPeriods: [{ ...ended(200), endedAt: null }] },
    { ...inactive, rosterPeriods: [{ ...ended(200), joinedAt: null }] },
    { ...inactive, rosterPeriods: [{ ...ended(200), joinedAt: ago(100) }] },
  ])
    assert.equal(isDormant(facts, now), false);
});

test('시연 데이터는 캡틴에게도 같은 기준을 적용하고 대표 사례를 포함한다', () => {
  assert.equal(consoleUsers.find((user) => user.id === 'alex')?.status, 'active');
  assert.equal(consoleUsers.find((user) => user.id === 'robin')?.status, 'dormant');
  const examples = consoleUsers.filter((user) => user.id.startsWith('activity-demo-'));
  assert.equal(examples.length, 10);
  assert.deepEqual(
    examples
      .filter((user) => user.status === 'dormant')
      .map((user) => user.id)
      .sort(),
    ['activity-demo-dormant', 'activity-demo-old-completed'],
  );
  assert(examples.every((user) => (user.status === 'dormant') === isDormant(user, USER_ACTIVITY_AS_OF)));
  assert.equal(consoleUsers.find((user) => user.id === 'activity-demo-completed')?.studyIds.length, 0);
});
