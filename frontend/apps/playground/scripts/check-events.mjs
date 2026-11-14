import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(tmpdir(), 'event-preview-'));
try {
  await build({
    entryPoints: {
      model: path.join(root, 'src/proto/events/model.ts'),
      seed: path.join(root, '../../packages/mock/src/data/event-preview.ts'),
    },
    outdir: temp,
    bundle: true,
    platform: 'node',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  });
  const { transition, seatInfo, wallTimeToIso, eventStatus, SELF } = await import(
    pathToFileURL(path.join(temp, 'model.mjs'))
  );
  const { createEventPreviewState } = await import(pathToFileURL(path.join(temp, 'seed.mjs')));
  const now = Date.parse('2026-11-13T12:00:00Z');
  let state = createEventPreviewState(new Date(now));
  const event = state.events[0];
  const apply = { type: 'APPLY', eventId: event.id, channel: 'OFFLINE', answers: { 'q-interest': '프로젝트 경험' } };
  const remaining = seatInfo(state, event, 'OFFLINE').remaining;
  state = transition(state, apply, now);
  const registration = state.registrations.find((r) => r.memberId === SELF.memberId);
  assert.equal(registration.status, 'PENDING');
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining - 1);
  assert.match(state.mails[0].subject, /신청 접수/);
  assert.throws(() => transition(state, apply, now), /이미 신청/);
  state = transition(state, { type: 'DECIDE', registrationId: registration.id, status: 'CONFIRMED' }, now);
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining - 1);
  assert.match(state.mails[0].subject, /참가 확정/);
  assert.throws(
    () => transition(state, { type: 'DECIDE', registrationId: registration.id, status: 'CONFIRMED' }, now),
    /현재 상태/,
  );
  state = transition(state, { type: 'CANCEL', registrationId: registration.id }, now);
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining);
  state = transition(state, apply, now);
  const reapplied = state.registrations.find((r) => r.memberId === SELF.memberId);
  state = transition(state, { type: 'DECIDE', registrationId: reapplied.id, status: 'DECLINED' }, now);
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining);
  assert.throws(() => transition(state, apply, now), /이미 신청/);
  console.log('✓ 확인 대기 자리 확보, 승인 시 유지, 취소·참가 불가 시 반환, 중복 처리 방지');

  state = createEventPreviewState(new Date(now));
  state.events[0].offlineCapacity = 2;
  assert.throws(() => transition(state, apply, now), /정원이 찼/);
  assert.throws(
    () => transition(state, { ...apply, channel: 'ONLINE' }, Date.parse(event.deadlineAt)),
    /신청할 수 없는/,
  );
  assert.throws(() => transition(state, { ...apply, channel: 'ONLINE', answers: {} }, now), /답변해/);
  assert.throws(
    () => transition(state, { type: 'SAVE', event: { ...state.events[0], offlineCapacity: 1 } }, now),
    /정원을 줄일/,
  );
  assert.throws(
    () => transition(state, { type: 'SAVE', event: { ...state.events[0], confirmation: 'AUTO' } }, now),
    /신청 이력/,
  );
  console.log('✓ 방식별 정원, 정확한 마감 경계, 필수 답변, 모집 정책 변경 제한');

  const auto = state.events[1];
  state = transition(state, { type: 'APPLY', eventId: auto.id, channel: 'ONLINE', answers: {} }, now);
  assert.equal(state.registrations[0].status, 'CONFIRMED');
  assert.match(state.mails[0].subject, /참가 확정/);
  state = transition(
    state,
    { type: 'MAIL', eventId: event.id, channel: 'ALL', subject: '행사 안내', body: '참여 방법 안내' },
    now,
  );
  assert.deepEqual(state.mails[0].recipients, ['crew3@example.test']);
  state = transition(state, { type: 'STATUS', eventId: event.id, status: 'CANCELLED' }, now);
  assert.equal(eventStatus(state, state.events[0], now), '행사 취소');
  assert.ok(state.registrations.filter((r) => r.eventId === event.id).every((r) => r.status === 'CANCELLED'));
  assert.throws(() => transition(state, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, now), /다시 공개/);
  console.log('✓ 자동 확정, 안내 메일 대상 제한, 행사 취소와 재공개 제한');

  state = createEventPreviewState(new Date(now));
  const afterDeadline = Date.parse(state.events[0].deadlineAt) + 1;
  state = transition(
    state,
    {
      type: 'SAVE',
      event: {
        ...state.events[0],
        deadlineAt: new Date(state.events[0].deadlineAt).toISOString(),
        onlineUrl: 'https://example.com/updated',
      },
    },
    afterDeadline,
  );
  assert.equal(state.events[0].onlineUrl, 'https://example.com/updated');
  assert.throws(
    () => transition(state, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, afterDeadline),
    /현재보다 늦게/,
  );
  const seatsBeforeCancel = seatInfo(state, state.events[0], 'OFFLINE').remaining;
  state = transition(state, { type: 'ADMIN_CANCEL', registrationId: 'sample-3' }, afterDeadline);
  assert.equal(state.registrations.find((r) => r.id === 'sample-3').status, 'CANCELLED');
  assert.equal(seatInfo(state, state.events[0], 'OFFLINE').remaining, seatsBeforeCancel + 1);
  assert.throws(
    () => transition(state, { type: 'ADMIN_CANCEL', registrationId: 'sample-1' }, Date.parse(event.startsAt)),
    /행사 시작 후/,
  );
  const draft = { ...state.events[1], id: 'preview-event-private', status: 'DRAFT', publishedAt: undefined };
  state = transition(state, { type: 'SAVE', event: draft }, now);
  state = transition(state, { type: 'STATUS', eventId: draft.id, status: 'CANCELLED' }, now);
  assert.equal(state.events.find((e) => e.id === draft.id).publishedAt, undefined);
  assert.ok(!state.events.filter((e) => e.status !== 'DRAFT' && e.publishedAt).some((e) => e.id === draft.id));
  console.log('✓ 마감 후 정보 수정·운영진 취소, 행사 시작 후 처리 제한, 미공개 행사 비노출');

  assert.equal(wallTimeToIso('2026-11-14T09:00', 'Asia/Seoul'), '2026-11-14T00:00:00.000Z');
  assert.equal(wallTimeToIso('2026-11-13T19:00', 'America/Toronto'), '2026-11-14T00:00:00.000Z');
  assert.equal(wallTimeToIso('2026-07-01T19:00', 'America/New_York'), '2026-07-01T23:00:00.000Z');
  assert.equal(wallTimeToIso('2026-03-08T02:30', 'America/New_York'), null);
  assert.equal(wallTimeToIso('2026-11-01T01:30', 'America/New_York'), null);
  console.log('✓ 한국·북미 시차, 서머타임, 존재하지 않거나 중복된 시각');
} finally {
  await rm(temp, { recursive: true, force: true });
}
