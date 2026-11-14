import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const temp = await mkdtemp(path.join(tmpdir(), 'event-preview-'));
try {
  await build({
    entryPoints: {
      model: path.join(root, 'src/proto/events/model.ts'),
      examples: path.join(root, 'src/proto/events/examples.ts'),
      render: path.join(root, 'src/proto/mail/render.ts'),
      seed: path.join(root, '../../packages/mock/src/data/event-preview.ts'),
    },
    outdir: temp,
    bundle: true,
    platform: 'node',
    format: 'esm',
    outExtension: { '.js': '.mjs' },
    logLevel: 'silent',
  });
  const { transition, seatInfo, wallTimeToIso, eventStatus, formatDate, SELF, renderEventNotice, renderEventNoticePreview, fillLegacyEventMailPreview, mergeNotificationTemplates } = await import(
    pathToFileURL(path.join(temp, 'model.mjs'))
  );
  const { toPreviewDocument } = await import(pathToFileURL(path.join(temp, 'render.mjs')));
  const { createEventPreviewState: createState } = await import(pathToFileURL(path.join(temp, 'seed.mjs')));
  const noticeBody = await readFile(path.join(root, 'src/proto/mail/templates/event-announcement-email.html'), 'utf8');
  const { populateEventExamples } = await import(pathToFileURL(path.join(temp, 'examples.mjs')));
  // 상태 전이 검증은 조작 대상 3명으로 한정한 독립 fixture를 사용한다.
  const createEventPreviewState = (date) => {
    const fixture = createState(date, noticeBody);
    fixture.registrations = fixture.registrations.filter((row) => ['sample-1', 'sample-2', 'sample-3'].includes(row.id));
    return fixture;
  };
  const now = Date.parse('2026-11-13T12:00:00Z');
  const fullSeed = createState(new Date(now), noticeBody);
  assert.equal(fullSeed.notificationTemplates.filter((template) => template.trigger.startsWith('EVENT_REGISTRATION_')).length, 4);
  assert.ok(fullSeed.notificationTemplates.filter((template) => template.trigger.startsWith('EVENT_REGISTRATION_')).every((template) => template.body.includes('\n  <table')));
  assert.ok(noticeBody.includes('background-color:#F5F7FF'));
  assert.ok(noticeBody.indexOf('{{notice}}') < noticeBody.indexOf('참여 안내'));
  assert.ok(noticeBody.indexOf('참여 안내') < noticeBody.indexOf('일정: {{eventSchedule}}'));
  const populated = populateEventExamples(fullSeed, fullSeed, now);
  assert.equal(populated.events.length, 9);
  assert.equal(populated.registrations.length, 98);
  for (const sampleEvent of populated.events) {
    const rows = populated.registrations.filter((row) => row.eventId === sampleEvent.id);
    if (sampleEvent.status === 'DRAFT') {
      assert.equal(rows.length, 0);
      assert.ok(!populated.mails.some((mail) => mail.eventId === sampleEvent.id));
      continue;
    }
    assert.ok(rows.length >= 8);
    assert.ok(rows.every((row) => (/^[a-z]+\d+@(gmail\.com|naver\.com|kakao\.com|daum\.net|outlook\.com)$/.test(row.email) || row.email === SELF.email)));
    assert.ok(rows.every((row) => row.questions.length && Object.keys(row.answers).length));
    const mailRows = populated.mails.filter((mail) => mail.eventId === sampleEvent.id);
    assert.ok(mailRows.length >= 3);
    if (sampleEvent.status !== 'CANCELLED') assert.ok(mailRows.some((mail) => mail.format === 'HTML'));
    assert.ok(mailRows.every((mail) => (mail.deliveries ? mail.deliveries.every((delivery) => !delivery.body.includes('{{')) : !mail.body.includes('{{')) && Date.parse(mail.createdAt) <= now));
    assert.ok(mailRows.every((mail) => mail.recipients.every((email) => rows.some((row) => row.email === email))));
    assert.ok(mailRows.every((mail) => mail.kind === 'OPERATOR' || mail.kind === 'AUTOMATIC'));
  }
  for (const [id, status] of Object.entries({
    'preview-event-closed': '모집 마감', 'preview-event-finished': '종료',
    'preview-event-cancelled': '행사 취소', 'preview-event-draft': '작성 중',
    'preview-event-full': '정원 마감', 'preview-event-live': '진행 중',
  })) assert.equal(eventStatus(populated, populated.events.find((event) => event.id === id), now), status);
  const fullEvent = populated.events.find((event) => event.id === 'preview-event-full');
  const fullApplicant = populated.registrations.find((row) => row.eventId === fullEvent.id);
  const reopenedSeat = transition(populated, { type: 'ADMIN_CANCEL', registrationId: fullApplicant.id }, now);
  assert.equal(eventStatus(reopenedSeat, fullEvent, now), '모집 중');
  const edited = createEventPreviewState(new Date(now));
  edited.registrations[0].status = 'DECLINED';
  edited.eventTemplates[0].subject = '[StudyClub] 내가 편집한 제목';
  edited.mails.push({ id: 'my-mail', eventId: edited.events[0].id, subject: '기존 이력', body: '유지', recipients: ['me@example.test'], kind: 'OPERATOR', createdAt: new Date(now).toISOString() });
  const filled = populateEventExamples(edited, fullSeed, now);
  assert.equal(filled.registrations.find((row) => row.id === 'sample-1').status, 'DECLINED');
  assert.equal(filled.eventTemplates[0].subject, '[StudyClub] 내가 편집한 제목');
  assert.deepEqual(filled.mails.find((mail) => mail.id === 'my-mail'), edited.mails[0]);
  assert.deepEqual(populateEventExamples(filled, fullSeed, now), filled);
  const tight = createEventPreviewState(new Date(now));
  tight.events[0].offlineCapacity = 2;
  const tightFilled = populateEventExamples(tight, fullSeed, now);
  assert.equal(seatInfo(tightFilled, tightFilled.events[0], 'OFFLINE').remaining, 0);
  const community = populated.events[0];
  for (const audience of ['ALL', 'ONLINE', 'OFFLINE']) {
    const recipients = populated.registrations.filter((row) => row.eventId === community.id && row.status === 'CONFIRMED' && (audience === 'ALL' || row.channel === audience));
    const sent = transition(populated, { type: 'MAIL', eventId: community.id, channel: audience, templateId: 3, notice: '여러분께 드리는 안내' }, now);
    assert.equal(sent.mails.length, populated.mails.length + 1);
    assert.equal(sent.mails[0].audience, audience);
    assert.equal(sent.mails[0].kind, 'OPERATOR');
    assert.deepEqual(sent.mails[0].recipients, recipients.map((row) => row.email));
    assert.equal(sent.mails[0].deliveries.length, recipients.length);
    assert.ok(sent.mails[0].deliveries.every((delivery, index) => delivery.body.includes(recipients[index].name) && !delivery.body.includes('{{')));
    assert.ok(populated.mails.some((mail) => mail.eventId === community.id && mail.audience === audience && mail.recipients.length > 1));
  }
  const personalized = structuredClone(populated);
  personalized.eventTemplates[0].subject = '[StudyClub] {{nickname}}님, {{eventTitle}} 안내';
  const personalizedSent = transition(personalized, { type: 'MAIL', eventId: community.id, channel: 'ALL', templateId: 3, notice: '안내' }, now);
  assert.ok(personalizedSent.mails[0].subject.includes('{{nickname}}'));
  assert.ok(personalizedSent.mails[0].subject.includes(community.title));
  assert.ok(personalizedSent.mails[0].deliveries.every((delivery) => !delivery.subject.includes('{{')));
  const older = structuredClone(populated);
  older.exampleRevision = 2;
  older.mails = older.mails.filter((mail) => !mail.id.includes('-batch-'));
  older.registrations[0].name = '바이트나무';
  older.registrations[0].email = 'byte.tree@mail.example.test';
  older.registrations[0].status = 'DECLINED';
  const upgraded = populateEventExamples(older, fullSeed, now);
  assert.equal(upgraded.registrations[0].name, '지원');
  assert.equal(upgraded.registrations[0].email, 'jiwon24@gmail.com');
  assert.equal(upgraded.registrations[0].status, 'DECLINED');
  assert.ok(upgraded.mails.some((mail) => mail.audience === 'ALL' && mail.recipients.length > 1));
  const staleHistory = structuredClone(populated);
  staleHistory.exampleRevision = 5;
  const staleExampleMail = staleHistory.mails.find((mail) => mail.id.includes('-batch-'));
  staleExampleMail.body = '<p>이전 행사 안내 서식</p>';
  staleHistory.events.find((item) => item.id === staleExampleMail.eventId).status = 'CANCELLED';
  staleHistory.registrations
    .filter((item) => item.eventId === staleExampleMail.eventId)
    .forEach((item) => {
      item.status = 'CANCELLED';
    });
  const refreshedHistory = populateEventExamples(staleHistory, fullSeed, now, 'Asia/Seoul');
  const refreshedExampleMail = refreshedHistory.mails.find((mail) => mail.id === staleExampleMail.id);
  assert.notEqual(refreshedExampleMail.body, staleExampleMail.body);
  assert.ok(refreshedExampleMail.body.includes('background-color:#F5F7FF'));
  assert.ok(refreshedExampleMail.body.includes('KST'));
  const cancelledExampleMail = refreshedHistory.mails.find((mail) => mail.id.endsWith('-event-cancelled'));
  assert.equal(cancelledExampleMail.kind, 'OPERATOR');
  assert.equal(cancelledExampleMail.audience, 'CANCELLED_ACTIVE');
  assert.ok(cancelledExampleMail.body.includes('행사 취소 안내'));
  console.log(`✓ 행사 ${populated.events.length}개·신청 ${populated.registrations.length}건·메일 ${populated.mails.length}건, 전체/방식별 일괄 발송·개별 치환·기존 상태 보존`);


  let state = createEventPreviewState(new Date(now));
  const event = state.events[0];
  const apply = {
    type: 'APPLY',
    eventId: event.id,
    channel: 'OFFLINE',
    answers: { 'q-interest': '프로젝트 경험' },
    applicant: { ...SELF, name: '프로필닉네임', email: 'profile@example.test' },
  };
  const remaining = seatInfo(state, event, 'OFFLINE').remaining;
  state = transition(state, apply, now);
  const registration = state.registrations.find((r) => r.memberId === SELF.memberId);
  assert.equal(registration.status, 'PENDING');
  assert.equal(registration.name, '프로필닉네임');
  assert.equal(registration.email, 'profile@example.test');
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining - 1);
  assert.match(state.mails[0].subject, /확인 대기/);
  assert.equal(state.mails[0].kind, 'AUTOMATIC');
  assert.equal(state.mails[0].format, 'HTML');
  assert.ok(!state.mails[0].body.includes('{{'));
  assert.throws(() => transition(state, apply, now), /이미 신청/);
  state = transition(state, { type: 'DECIDE', registrationId: registration.id, status: 'CONFIRMED' }, now);
  assert.equal(seatInfo(state, event, 'OFFLINE').remaining, remaining - 1);
  assert.match(state.mails[0].subject, /참가.*확정/);
  assert.equal(state.mails[0].kind, 'AUTOMATIC');
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
  const pendingBeforeAuto = state.registrations.filter(
    (r) => r.eventId === state.events[0].id && r.status === 'PENDING',
  );
  const mailCountBeforeAuto = state.mails.length;
  const switched = transition(state, { type: 'SAVE', event: { ...state.events[0], confirmation: 'AUTO' } }, now);
  assert.ok(pendingBeforeAuto.length > 0);
  assert.ok(
    pendingBeforeAuto.every(
      (pending) => switched.registrations.find((registration) => registration.id === pending.id).status === 'CONFIRMED',
    ),
  );
  assert.equal(switched.mails.length, mailCountBeforeAuto + pendingBeforeAuto.length);
  assert.ok(switched.mails.slice(0, pendingBeforeAuto.length).every((mail) => /참가.*확정/.test(mail.subject)));
  const reviewAgain = transition(
    switched,
    { type: 'SAVE', event: { ...switched.events[0], confirmation: 'REVIEW' } },
    now,
  );
  assert.ok(
    pendingBeforeAuto.every(
      (pending) => reviewAgain.registrations.find((registration) => registration.id === pending.id).status === 'CONFIRMED',
    ),
  );
  const newApplication = transition(switched, { ...apply, channel: 'ONLINE' }, now);
  assert.equal(newApplication.registrations[0].status, 'CONFIRMED');
  const questionState = createEventPreviewState(new Date(now));
  const questionEvent = questionState.events[0];
  const existingQuestionSnapshot = structuredClone(questionState.registrations[0].questions);
  const changedQuestions = [
    ...questionEvent.questions,
    { id: 'q-added-later', label: '행사에서 더 궁금한 점이 있나요?', type: 'TEXT', required: false, options: [] },
  ];
  const questionsChanged = transition(
    questionState,
    { type: 'SAVE', event: { ...questionEvent, questions: changedQuestions } },
    now,
  );
  assert.deepEqual(questionsChanged.registrations[0].questions, existingQuestionSnapshot);
  const appliedAfterQuestionChange = transition(
    questionsChanged,
    { ...apply, channel: 'ONLINE' },
    now,
  );
  assert.ok(appliedAfterQuestionChange.registrations[0].questions.some((question) => question.id === 'q-added-later'));
  const removedQuestionState = transition(
    questionState,
    { type: 'SAVE', event: { ...questionEvent, questions: [] } },
    now,
  );
  const appliedAfterQuestionRemoval = transition(
    removedQuestionState,
    { ...apply, channel: 'ONLINE', answers: { 'q-interest': '화면에서 사라진 답변' } },
    now,
  );
  assert.deepEqual(appliedAfterQuestionRemoval.registrations[0].answers, {});
  const optionalTextState = transition(
    questionState,
    {
      type: 'SAVE',
      event: {
        ...questionEvent,
        questions: [{ id: 'q-interest', label: '바뀐 단답형 질문', type: 'TEXT', required: false, options: [] }],
      },
    },
    now,
  );
  const appliedAfterTypeChange = transition(
    optionalTextState,
    { ...apply, channel: 'ONLINE', answers: { 'q-interest': ['기존', '복수 답변'] } },
    now,
  );
  assert.deepEqual(appliedAfterTypeChange.registrations[0].answers, {});
  const boundaryState = createEventPreviewState(new Date(now));
  boundaryState.events[0].deadlineAt = new Date(now - 60 * 60 * 1000).toISOString();
  assert.throws(
    () =>
      transition(
        boundaryState,
        {
          type: 'SAVE',
          event: { ...boundaryState.events[0], confirmation: 'AUTO', startsAt: new Date(now).toISOString() },
        },
        now,
      ),
    /행사 시작 후/,
  );
  assert.throws(() => transition(state, { type: 'SAVE', event: { ...state.events[0], format: 'ONLINE' } }, now), /오프라인 신청자가 남아/);
  const cleared = transition(transition(state, { type: 'ADMIN_CANCEL', registrationId: 'sample-1' }, now), { type: 'ADMIN_CANCEL', registrationId: 'sample-3' }, now);
  assert.equal(transition(cleared, { type: 'SAVE', event: { ...cleared.events[0], format: 'ONLINE' } }, now).events[0].format, 'ONLINE');
  const noEnd = transition(state, { type: 'SAVE', event: { ...state.events[0], endsAt: '' } }, now);
  assert.equal(noEnd.events[0].endsAt, '');
  assert.equal(eventStatus(noEnd, noEnd.events[0], Date.parse(event.startsAt)), '행사 시작');
  console.log('✓ 방식별 정원, 확정 방식의 확인 대기 반영, 질문 변경 전후 신청서 스냅샷, 모집 정책 변경 제한');

  const auto = state.events[1];
  state = transition(state, { type: 'APPLY', eventId: auto.id, channel: 'ONLINE', answers: {} }, now);
  assert.equal(state.registrations[0].status, 'CONFIRMED');
  assert.match(state.mails[0].subject, /참가.*확정/);
  state = transition(
    state,
    { type: 'MAIL', eventId: event.id, channel: 'ALL', templateId: 3, notice: '참여 방법 안내' },
    now,
  );
  assert.deepEqual(state.mails[0].recipients, ['doyun17@kakao.com']);
  assert.match(state.mails[0].deliveries[0].body, /도윤/);
  assert.match(state.mails[0].body, /참여 방법 안내/);
  assert.equal(state.mails[0].format, 'HTML');
  assert.match(state.mails[0].body, /<!DOCTYPE html>/);
  assert.match(state.mails[0].body, /StudyClub 드림/);
  assert.ok(state.mails[0].body.includes('{{nickname}}'));
  assert.ok(!state.mails[0].deliveries[0].body.includes('{{'));
  const composedPreview = renderEventNoticePreview(state.eventTemplates[0], event, 'ALL', '<b>운영진 안내</b>\n두 번째 줄');
  assert.ok(composedPreview.body.includes('{{nickname}}'));
  assert.ok(composedPreview.body.includes(event.title));
  assert.ok(!/{{(?:eventTitle|eventSchedule|participation|notice)}}/.test(composedPreview.body));
  assert.ok(composedPreview.body.includes('온라인:'));
  assert.ok(composedPreview.body.includes('오프라인:'));
  const onlinePreview = renderEventNoticePreview(state.eventTemplates[0], event, 'ONLINE', '온라인 안내');
  assert.ok(!onlinePreview.body.includes(event.location));
  const offlinePreview = renderEventNoticePreview(state.eventTemplates[0], event, 'OFFLINE', '현장 안내');
  assert.ok(offlinePreview.body.includes(event.location));
  const legacyMail = { ...state.mails[0], previewVersion: undefined, body: '<p>{{nickname}} {{eventTitle}} {{eventSchedule}} {{participation}}</p><p>이전 안내 내용</p>' };
  const hydrated = fillLegacyEventMailPreview(legacyMail, event);
  assert.ok(hydrated.body.includes(event.title));
  assert.ok(hydrated.body.includes('이전 안내 내용'));
  assert.ok(hydrated.body.includes('{{nickname}}'));
  assert.deepEqual(hydrated.deliveries, legacyMail.deliveries);
  const legacyLiteral = { ...legacyMail, body: '<p>{{eventTitle}}</p><p>변수 {{eventTitle}} 표기를 그대로 써 주세요.</p>', deliveries: [{ recipient: 'me@example.test', subject: '이전 제목', body: '<p>이전 행사명</p><p>변수 {{eventTitle}} 표기를 그대로 써 주세요.</p>', format: 'HTML' }] };
  const literalHydrated = fillLegacyEventMailPreview(legacyLiteral, event);
  assert.equal(literalHydrated.body, legacyLiteral.body);
  assert.deepEqual(literalHydrated.deliveries, legacyLiteral.deliveries);

  assert.deepEqual(fillLegacyEventMailPreview(hydrated, { ...event, title: '나중에 바꾼 제목' }), hydrated);
  const literalNotice = renderEventNoticePreview(state.eventTemplates[0], event, 'ALL', '{{eventTitle}}');
  assert.ok(literalNotice.body.includes('{{eventTitle}}'));
  assert.ok(composedPreview.body.includes('&lt;b&gt;운영진 안내&lt;/b&gt;<br>두 번째 줄'));
  assert.ok(!composedPreview.body.includes('{{notice}}'));
  assert.equal(composedPreview.format, 'HTML');
  const originalMail = structuredClone(state.mails[0]);
  const custom = { ...state.eventTemplates[0], subject: '[StudyClub] {{eventTitle}} 공지', body: '<p>{{nickname}}</p><p>{{notice}}</p>' };
  state = transition(state, { type: 'TEMPLATES', templates: [custom] }, now);
  const rendered = renderEventNotice(custom, state.events[0], state.registrations.find((r) => r.id === 'sample-3'), '<img src=x>\n{{nickname}}');
  assert.ok(rendered.body.includes('&lt;img src=x&gt;<br>{{nickname}}'));
  assert.deepEqual(state.mails[0], originalMail);
  assert.throws(() => transition(state, { type: 'TEMPLATES', templates: [{ ...custom, body: '내용 자리 없음' }] }, now), /notice/);
  assert.throws(() => transition(state, { type: 'TEMPLATES', templates: [{ ...custom, subject: '{{unknown}}' }] }, now), /지원하지 않는/);
  for (const unknown of ['{{event.title}}', '{{닉네임}}', '{{}}']) {
    assert.throws(() => transition(state, { type: 'TEMPLATES', templates: [{ ...custom, subject: unknown }] }, now), /지원하지 않는/);
  }
  const textTemplate = { ...custom, body: '{{notice}}' };
  const textResult = renderEventNotice(textTemplate, state.events[0], state.registrations.find((r) => r.id === 'sample-3'), '<b>일반 텍스트</b>');
  assert.equal(textResult.format, 'TEXT');
  assert.ok(toPreviewDocument(textResult.body, textResult.format).includes('&lt;b&gt;일반 텍스트&lt;/b&gt;'));
  const allTemplates = [{ ...custom, id: 1 }, { ...custom, id: 2, trigger: 'FEEDBACK_REPLIED', body: '답변이 등록되었습니다.' }];
  const savedTemplates = JSON.parse(JSON.stringify(transition(state, { type: 'TEMPLATES', templates: allTemplates }, now)));
  assert.deepEqual(savedTemplates.notificationTemplates.map((t) => t.id), [1, 2]);
  assert.deepEqual(savedTemplates.eventTemplates.map((t) => t.id), [1]);
  assert.equal(savedTemplates.notificationTemplates[0].trigger, 'EVENT_ANNOUNCEMENT');
  assert.throws(() => transition(state, { type: 'TEMPLATES', templates: [custom, custom] }, now), /중복/);
  const deleted = transition(state, { type: 'TEMPLATES', templates: [] }, now);
  assert.throws(() => transition(deleted, { type: 'MAIL', eventId: event.id, channel: 'ALL', templateId: 3, notice: '안내' }, now), /템플릿이 없/);
  const reloadedDeleted = JSON.parse(JSON.stringify(deleted));
  assert.ok(!mergeNotificationTemplates(reloadedDeleted.notificationTemplates, fullSeed.notificationTemplates, reloadedDeleted.deletedTemplateTriggers).some((template) => template.trigger === 'EVENT_ANNOUNCEMENT'));
  const restoredTemplate = transition(reloadedDeleted, { type: 'TEMPLATES', templates: [custom] }, now);
  assert.ok(!restoredTemplate.deletedTemplateTriggers.includes('EVENT_ANNOUNCEMENT'));
  const mixedIds = mergeNotificationTemplates([{ ...custom, id: 4 }], fullSeed.notificationTemplates);
  assert.equal(new Set(mixedIds.map((template) => template.id)).size, mixedIds.length);
  console.log('✓ 행사 템플릿 치환·수정·삭제 연동, HTML 입력 이스케이프, 발송 당시 본문 보존');
  const cancellationRecipientIds = state.registrations
    .filter((registration) => registration.eventId === event.id && ['PENDING', 'CONFIRMED'].includes(registration.status))
    .map((registration) => registration.id);
  const mailCountBeforeCancellation = state.mails.length;
  state = transition(state, { type: 'STATUS', eventId: event.id, status: 'CANCELLED' }, now);
  assert.equal(eventStatus(state, state.events[0], now), '행사 취소');
  assert.ok(state.registrations.filter((r) => r.eventId === event.id).every((r) => r.status === 'CANCELLED'));
  assert.equal(state.mails.length, mailCountBeforeCancellation);
  state = transition(
    state,
    {
      type: 'CANCELLATION_MAIL',
      eventId: event.id,
      templateId: custom.id,
      notice: '운영 사정으로 행사가 취소되었습니다.',
    },
    now,
  );
  assert.equal(state.mails[0].kind, 'OPERATOR');
  assert.equal(state.mails[0].audience, 'CANCELLED_ACTIVE');
  assert.equal(state.mails[0].recipients.length, cancellationRecipientIds.length);
  assert.match(state.mails[0].subject, /행사 취소 안내/);
  assert.deepEqual(state.events[0].cancellationRecipientIds, cancellationRecipientIds);
  const reopenedCancellation = transition(JSON.parse(JSON.stringify(state)), {
    type: 'CANCELLATION_MAIL', eventId: event.id, templateId: custom.id, notice: '추가 취소 안내',
  }, now);
  assert.deepEqual(reopenedCancellation.mails[0].recipients, state.mails[0].recipients);
  const priorWithdrawals = createState(new Date(now), noticeBody);
  const cancellationEvent = priorWithdrawals.events[0];
  const eligibleIds = priorWithdrawals.registrations.filter((r) => r.eventId === cancellationEvent.id && ['PENDING', 'CONFIRMED'].includes(r.status)).map((r) => r.id);
  const cancelledWithHistory = transition(priorWithdrawals, { type: 'STATUS', eventId: cancellationEvent.id, status: 'CANCELLED' }, now);
  assert.deepEqual(cancelledWithHistory.events[0].cancellationRecipientIds, eligibleIds);
  assert.ok(priorWithdrawals.registrations.some((r) => r.eventId === cancellationEvent.id && ['DECLINED', 'CANCELLED'].includes(r.status) && !eligibleIds.includes(r.id)));
  assert.throws(() => transition(state, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, now), /다시 공개/);
  console.log('✓ 자동 확정, 안내 메일 대상 제한, 행사 취소 후 운영진 안내와 재공개 제한');

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

  const withoutEnd = { ...fullSeed.events[0], startsAt: '2026-11-14T23:00:00.000Z', endsAt: '', timeZone: 'America/Toronto' };
  assert.equal(eventStatus(fullSeed, withoutEnd, Date.parse('2026-11-15T04:59:59Z')), '행사 시작');
  assert.equal(eventStatus(fullSeed, withoutEnd, Date.parse('2026-11-15T05:00:00Z')), '종료');
  const seoulWithoutEnd = { ...withoutEnd, startsAt: '2026-11-14T09:00:00.000Z', timeZone: 'Asia/Seoul' };
  assert.equal(eventStatus(fullSeed, seoulWithoutEnd, Date.parse('2026-11-14T14:59:59Z')), '행사 시작');
  assert.equal(eventStatus(fullSeed, seoulWithoutEnd, Date.parse('2026-11-14T15:00:00Z')), '종료');
  const dstWithoutEnd = { ...withoutEnd, startsAt: '2026-11-01T04:00:00.000Z' };
  assert.equal(eventStatus(fullSeed, dstWithoutEnd, Date.parse('2026-11-02T04:59:59Z')), '행사 시작');
  assert.equal(eventStatus(fullSeed, dstWithoutEnd, Date.parse('2026-11-02T05:00:00Z')), '종료');
  assert.equal(eventStatus(fullSeed, { ...withoutEnd, endsAt: '2026-11-15T07:00:00Z' }, Date.parse('2026-11-15T05:00:00Z')), '진행 중');
  for (const status of ['CANCELLED', 'PUBLISHED', 'CLOSED']) {
    assert.throws(() => transition(fullSeed, { type: 'STATUS', eventId: 'preview-event-finished', status }, now), /종료된 행사/);
  }
  assert.throws(() => transition(fullSeed, { type: 'APPLY', eventId: fullSeed.events[0].id, channel: 'ONLINE', answers: {}, applicant: { ...SELF, email: '' } }, now), /이메일/);
  console.log('✓ 종료 미입력 행사의 현지 자정·서머타임, 종료 후 상태 변경 제한, 계정 이메일 검증');

  assert.equal(wallTimeToIso('2026-11-14T09:00', 'Asia/Seoul'), '2026-11-14T00:00:00.000Z');
  assert.equal(wallTimeToIso('2026-11-13T19:00', 'America/Toronto'), '2026-11-14T00:00:00.000Z');
  assert.equal(wallTimeToIso('2026-07-01T19:00', 'America/New_York'), '2026-07-01T23:00:00.000Z');
  assert.equal(wallTimeToIso('2026-03-08T02:30', 'America/New_York'), null);
  assert.equal(wallTimeToIso('2026-11-01T01:30', 'America/New_York'), null);
  assert.match(formatDate('2026-11-14T00:00:00.000Z', 'Asia/Seoul'), /KST$/);
  assert.match(formatDate('2026-11-14T00:00:00.000Z', 'America/Toronto'), /EST$/);
  assert.match(formatDate('2026-07-01T23:00:00.000Z', 'America/New_York'), /EDT$/);
  assert.doesNotMatch(formatDate('2026-11-14T00:00:00.000Z', 'America/Toronto'), /GMT/);
  const profileZonePreview = renderEventNoticePreview(state.eventTemplates[0], state.events[0], 'ALL', '안내', 'Asia/Seoul');
  assert.match(profileZonePreview.body, /KST/);
  const zoned = createState(new Date(now), noticeBody);
  zoned.registrations.find((row) => row.id === 'sample-1').timeZone = 'Asia/Seoul';
  const approvedWithZone = transition(zoned, { type: 'DECIDE', registrationId: 'sample-1', status: 'CONFIRMED' }, now);
  assert.match(approvedWithZone.mails[0].body, /KST/);
  const sentWithZone = transition(approvedWithZone, { type: 'MAIL', eventId: zoned.events[0].id, channel: 'ALL', templateId: 3, notice: '시간대 안내', displayTimeZone: 'America/Toronto' }, now);
  assert.match(sentWithZone.mails[0].deliveries.find((delivery) => delivery.recipient === zoned.registrations.find((row) => row.id === 'sample-1').email).body, /KST/);
  assert.match(sentWithZone.mails[0].body, /EST/);
  console.log('✓ 한국·북미 시차, 프로필 시간대 약어, 서머타임, 존재하지 않거나 중복된 시각');
} finally {
  await rm(temp, { recursive: true, force: true });
}
