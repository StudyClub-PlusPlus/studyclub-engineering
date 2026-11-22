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
  const { firstEventTemplate, eventMailRecipients, eventRegistrationPage, transition: applyTransition, answersForUnchangedQuestions, eventQuestionVersion, seatInfo, wallTime, resolveEventInput, eventAdminPage, EVENT_LIMITS, isEventPublic, latestRegistrationsByEvent, eventStatus, formatDate, SELF, renderEventNotice, renderEventNoticePreview, fillLegacyEventMailPreview, mergeNotificationTemplates, settleEndedRegistrations } = await import(
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
  const transition = (state, action, now) => applyTransition(
    state,
    action.type === 'APPLY'
      ? { questionVersion: eventQuestionVersion(state.events.find((event) => event.id === action.eventId)?.questions ?? []), ...action }
      : action,
    now,
  );
  const now = Date.parse('2026-11-13T12:00:00Z');
  const fullSeed = createState(new Date(now), noticeBody);
  assert.equal(fullSeed.notificationTemplates.filter((template) => template.trigger.startsWith('EVENT_REGISTRATION_')).length, 4);
  assert.ok(fullSeed.notificationTemplates.filter((template) => template.trigger.startsWith('EVENT_REGISTRATION_')).every((template) => template.body.includes('\n  <table')));
  assert.ok(noticeBody.includes('background-color:#F5F7FF'));
  assert.ok(noticeBody.indexOf('{{notice}}') < noticeBody.indexOf('참여 안내'));
  assert.ok(noticeBody.indexOf('참여 안내') < noticeBody.indexOf('일정: {{eventSchedule}}'));
  const populated = populateEventExamples(fullSeed, fullSeed, now);
  const communityRows = populated.registrations.filter((row) => row.eventId === 'preview-event-community');
  assert.equal(eventRegistrationPage(communityRows, 1).items.length, 20);
  assert.equal(eventRegistrationPage(communityRows, 2).items.length, communityRows.length - 20);
  assert.equal(eventRegistrationPage(communityRows, 999).page, 2);
  assert.equal(firstEventTemplate([{ id: 9, trigger: 'EVENT_CANCELLATION', channel: 'EMAIL' }, { id: 2, trigger: 'EVENT_CANCELLATION', channel: 'EMAIL' }], 'EVENT_CANCELLATION').id, 2);
  const cancelledSample = populated.events.find((row) => row.id === 'preview-event-cancelled');
  const cancellationRecipients = eventMailRecipients(populated, cancelledSample, 'CANCELLED_ACTIVE');
  assert.ok(cancellationRecipients.every((row) => !row.accountDeleted));
  const gone = structuredClone(populated);
  gone.registrations.forEach((row) => { row.accountDeleted = true; });
  assert.equal(eventMailRecipients(gone, cancelledSample, 'CANCELLED_ACTIVE').length, 0);

  assert.equal(populated.events.length, 8);
  assert.ok(!fullSeed.events.some((event) => event.id === 'preview-event-draft'));
  assert.equal(populated.registrations.length, 105);
  const previewMemberRows = populated.registrations.filter(({ memberId }) => memberId === SELF.memberId);
  assert.ok(previewMemberRows.length > 0);
  assert.ok(previewMemberRows.every(({ name, email }) => name === SELF.name && email === SELF.email));
  const reappliedEventId = 'preview-event-finished';
  const attempts = previewMemberRows.filter((row) => row.eventId === reappliedEventId);
  const currentAttempt = attempts.find((row) => row.status === 'CONFIRMED');
  const previousAttempt = attempts.find((row) => row.status === 'CANCELLED');
  assert.equal(attempts.length, 2);
  assert.ok(Date.parse(currentAttempt.createdAt) > Date.parse(previousAttempt.createdAt));
  assert.deepEqual(latestRegistrationsByEvent([previousAttempt, currentAttempt], SELF.memberId).get(reappliedEventId), currentAttempt);
  const beforeReapplyExample = {
    ...populated, exampleRevision: 11,
    registrations: populated.registrations.filter((row) => row.id !== previousAttempt.id),
  };
  const upgradedExample = populateEventExamples(beforeReapplyExample, fullSeed, now);
  assert.deepEqual(upgradedExample.registrations, populated.registrations);
  assert.deepEqual(populateEventExamples(upgradedExample, fullSeed, now), upgradedExample);
  console.log('✓ 마이페이지는 행사별 최신 신청만 표시, 운영진은 재신청 이력 전체 조회');
  for (const sampleEvent of populated.events) {
    const rows = populated.registrations.filter((row) => row.eventId === sampleEvent.id);
    assert.ok(isEventPublic(sampleEvent));
    assert.ok(rows.length >= 8);
    assert.ok(rows.every((row) => row.accountDeleted ? row.email === '' : /^[a-z]+\d+@(gmail\.com|naver\.com|kakao\.com|daum\.net|outlook\.com)$/.test(row.email)));
    assert.ok(rows.every((row) => row.questions.length && Object.keys(row.answers).length));
    const mailRows = populated.mails.filter((mail) => mail.eventId === sampleEvent.id);
    assert.ok(mailRows.length >= 3);
    if (sampleEvent.status !== 'CANCELLED') assert.ok(mailRows.some((mail) => mail.format === 'HTML'));
    assert.ok(mailRows.every((mail) => (mail.deliveries ? mail.deliveries.every((delivery) => !delivery.body.includes('{{')) : !mail.body.includes('{{')) && Date.parse(mail.createdAt) <= now));
    assert.ok(mailRows.every((mail) => mail.recipients.every((email) => fullSeed.registrations.some((row) => row.eventId === sampleEvent.id && row.email === email))));
    assert.ok(mailRows.every((mail) => mail.kind === 'OPERATOR' || mail.kind === 'AUTOMATIC'));
  }
  for (const [id, status] of Object.entries({
    'preview-event-closed': '모집 마감', 'preview-event-finished': '종료',
    'preview-event-cancelled': '행사 취소',
    'preview-event-full': '정원 마감', 'preview-event-live': '모집 마감',
  })) assert.equal(eventStatus(populated, populated.events.find((event) => event.id === id), now), status);
  const newEvent = {
    ...fullSeed.events[0], id: 'preview-new-event', publishedAt: undefined, format: 'ONLINE', confirmation: 'AUTO', questions: [],
  };
  const unsorted = Array.from({ length: 21 }, (_, i) => ({
    ...newEvent, id: String(i), startsAt: new Date(now + i * 3600000).toISOString(),
  }));
  const firstPage = eventAdminPage(unsorted, 1);
  assert.equal(firstPage.pageCount, 2);
  assert.deepEqual(firstPage.rows.map(({ id }) => Number(id)), Array.from({ length: 20 }, (_, i) => 20 - i));
  assert.deepEqual(eventAdminPage(unsorted, 2).rows, [unsorted[0]]);
  assert.equal(unsorted[0].id, '0');
  console.log('✓ 행사 시작 시각 내림차순, 20건 단위 페이지');

  const maxLengthEvent = {
    ...newEvent,
    format: 'OFFLINE',
    title: '가'.repeat(EVENT_LIMITS.title),
    summary: '가'.repeat(EVENT_LIMITS.summary),
    description: '가'.repeat(EVENT_LIMITS.description),
    location: '가'.repeat(EVENT_LIMITS.location),
    questions: Array.from({ length: EVENT_LIMITS.questions }, (_, i) => ({
      id: String(i), label: '가'.repeat(EVENT_LIMITS.questionLabel), type: i ? 'TEXT' : 'RADIO',
      required: false,
      options: i ? [] : Array.from({ length: EVENT_LIMITS.maxOptions }, (_, option) => String(option) + '가'.repeat(EVENT_LIMITS.optionLabel - 1)),
    })),
  };
  assert.equal(transition(populated, { type: 'CREATE', event: maxLengthEvent }, now).events[0].questions.length, 20);
  for (const key of ['title', 'summary', 'description', 'location']) {
    assert.throws(
      () => transition(populated, { type: 'CREATE', event: { ...maxLengthEvent, [key]: maxLengthEvent[key] + '가' } }, now),
      new RegExp(`${EVENT_LIMITS[key]}자 이내`),
    );
  }
  const [choiceQuestion, ...remainingQuestions] = maxLengthEvent.questions;
  const saveWithQuestion = (question) => transition(
    populated, { type: 'CREATE', event: { ...maxLengthEvent, questions: [question, ...remainingQuestions] } }, now,
  );
  assert.throws(() => saveWithQuestion({ ...choiceQuestion, label: choiceQuestion.label + '가' }), /200자 이내/);
  assert.throws(() => saveWithQuestion({ ...choiceQuestion, options: [...choiceQuestion.options, '하나 더'] }), /2~10개/);
  assert.throws(() => saveWithQuestion({ ...choiceQuestion, options: ['짧은 선택지', '가'.repeat(101)] }), /100자 이내/);
  assert.throws(() => transition(populated, {
    type: 'CREATE', event: { ...maxLengthEvent, questions: [...maxLengthEvent.questions, { ...choiceQuestion, id: '20' }] },
  }, now), /최대 20개/);
  console.log('✓ 행사 기본 정보와 신청 질문의 입력 범위');

  const created = transition(populated, { type: 'CREATE', event: newEvent }, now);
  assert.equal(created.events[0].status, 'PUBLISHED');
  assert.equal(created.events[0].publishedAt, new Date(now).toISOString());
  assert.equal(eventStatus(created, created.events[0], now), '모집 중');
  assert.equal(
    transition(created, { type: 'APPLY', eventId: newEvent.id, channel: 'ONLINE', answers: {} }, now).registrations[0].status,
    'CONFIRMED',
  );
  assert.throws(
    () => transition(populated, { type: 'CREATE', event: { ...newEvent, deadlineAt: new Date(now).toISOString() } }, now),
    /현재보다 늦게/,
  );
  console.log('✓ 신규 등록 즉시 공개 및 신청, 지난 마감 차단');
  assert.throws(() => transition(created, { type: 'STATUS', eventId: newEvent.id, status: 'DRAFT' }, now), /지원하지 않는 행사 상태/);
  const closedAfterPublish = transition(created, { type: 'STATUS', eventId: newEvent.id, status: 'CLOSED' }, now);
  assert.equal(eventStatus(closedAfterPublish, closedAfterPublish.events[0], now), '모집 마감');
  const reopenedAfterClose = transition(closedAfterPublish, { type: 'STATUS', eventId: newEvent.id, status: 'PUBLISHED' }, now);
  assert.equal(eventStatus(reopenedAfterClose, reopenedAfterClose.events[0], now), '모집 중');
  const cancelledWithoutApplicants = transition(reopenedAfterClose, { type: 'STATUS', eventId: newEvent.id, status: 'CANCELLED' }, now);
  assert.equal(cancelledWithoutApplicants.events[0].status, 'CANCELLED');
  assert.equal(cancelledWithoutApplicants.events[0].publishedAt, created.events[0].publishedAt);
  assert.deepEqual(cancelledWithoutApplicants.events[0].cancellationRecipientIds, []);
  assert.deepEqual(cancelledWithoutApplicants.mails, created.mails);
  console.log('✓ 미지원 상태 차단, 모집 마감·재모집 및 신청 이력 없는 행사 취소');
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
  assert.doesNotMatch(cancelledExampleMail.body, /참여 안내|Washington Park/);
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
  assert.throws(() => transition(
    questionsChanged, { ...apply, channel: 'ONLINE', questionVersion: eventQuestionVersion(questionEvent.questions) }, now,
  ), /신청 질문이 변경/);
  const renamedQuestion = { ...questionEvent.questions[0], label: '의미가 바뀐 질문' };
  const unchanged = questionEvent.questions[1];
  const unchangedAnswer = unchanged.options[0] ?? '유지할 답변';
  assert.deepEqual(
    answersForUnchangedQuestions(questionEvent.questions, [renamedQuestion, unchanged], {
      [renamedQuestion.id]: '프로젝트 경험', [unchanged.id]: unchangedAnswer,
    }),
    { [unchanged.id]: unchangedAnswer },
  );
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
  assert.equal(eventStatus(noEnd, noEnd.events[0], Date.parse(event.startsAt)), '모집 마감');
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
  const cancellationTemplate = state.eventTemplates.find((template) => template.trigger === 'EVENT_CANCELLATION');
  state = transition(state, { type: 'TEMPLATES', templates: [custom, cancellationTemplate] }, now);
  assert.throws(() => transition(state, {
    type: 'TEMPLATES', templates: [custom, { ...cancellationTemplate, body: '{{notice}} {{participation}}' }],
  }, now), /지원하지 않는 변수/);
  assert.ok(mergeNotificationTemplates([custom], fullSeed.notificationTemplates).some((template) => template.trigger === 'EVENT_CANCELLATION'));
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
  state.events[0].onlineUrl = 'https://example.com/other-participation';
  assert.throws(() => transition(state, {
    type: 'CANCELLATION_MAIL', eventId: event.id, templateId: custom.id, notice: '취소 안내 테스트',
  }, now), /메일 템플릿이 바뀌었습니다/);
  state = transition(
    state,
    {
      type: 'CANCELLATION_MAIL',
      eventId: event.id,
      templateId: cancellationTemplate.id,
      notice: '운영 사정으로 행사가 취소되었습니다.',
    },
    now,
  );
  assert.equal(state.mails[0].kind, 'OPERATOR');
  assert.equal(state.mails[0].audience, 'CANCELLED_ACTIVE');
  assert.equal(state.mails[0].recipients.length, cancellationRecipientIds.length);
  assert.match(state.mails[0].subject, /행사 취소 안내/);
  assert.doesNotMatch(state.mails[0].body, /참여 안내|other-participation/);
  assert.ok(state.mails[0].deliveries.every((item) => !item.body.includes('other-participation') && !item.body.includes('참여 안내')));
  assert.deepEqual(state.events[0].cancellationRecipientIds, cancellationRecipientIds);
  const reopenedCancellation = transition(JSON.parse(JSON.stringify(state)), {
    type: 'CANCELLATION_MAIL', eventId: event.id, templateId: cancellationTemplate.id, notice: '추가 취소 안내',
  }, now);
  assert.deepEqual(reopenedCancellation.mails[0].recipients, state.mails[0].recipients);
  const priorWithdrawals = createState(new Date(now), noticeBody);
  const cancellationEvent = priorWithdrawals.events[0];
  const eligibleIds = priorWithdrawals.registrations.filter((r) => r.eventId === cancellationEvent.id && ['PENDING', 'CONFIRMED'].includes(r.status)).map((r) => r.id);
  const cancelledWithHistory = transition(priorWithdrawals, { type: 'STATUS', eventId: cancellationEvent.id, status: 'CANCELLED' }, now);
  assert.deepEqual(cancelledWithHistory.events[0].cancellationRecipientIds, eligibleIds);
  assert.ok(priorWithdrawals.registrations.some((r) => r.eventId === cancellationEvent.id && ['DECLINED', 'CANCELLED'].includes(r.status) && !eligibleIds.includes(r.id)));
  assert.throws(() => transition(state, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, now), /취소된 행사는 모집 상태를 변경할 수 없습니다/);
  console.log('✓ 자동 확정, 안내 메일 대상 제한, 행사 취소 후 운영진 안내와 모집 상태 변경 제한');

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
  assert.strictEqual(transition(state, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, afterDeadline), state);
  const manuallyClosed = transition(state, { type: 'STATUS', eventId: event.id, status: 'CLOSED' }, afterDeadline);
  assert.throws(
    () => transition(manuallyClosed, { type: 'STATUS', eventId: event.id, status: 'PUBLISHED' }, afterDeadline),
    /현재보다 늦게/,
  );
  const seatsBeforeCancel = seatInfo(state, state.events[0], 'OFFLINE').remaining;
  state = transition(state, { type: 'ADMIN_CANCEL', registrationId: 'sample-3' }, afterDeadline);
  assert.equal(state.registrations.find((r) => r.id === 'sample-3').status, 'CANCELLED');
  assert.equal(seatInfo(state, state.events[0], 'OFFLINE').remaining, seatsBeforeCancel + 1);
  assert.equal(isEventPublic({ ...newEvent, status: 'CANCELLED' }), false);
  assert.equal(isEventPublic(cancelledWithoutApplicants.events[0]), true);
  console.log('✓ 마감 후 정보 수정·운영진 취소, 공개된 행사만 크루에게 표시');

  const startedAt = Date.parse(event.startsAt);
  const endedAt = Date.parse(event.endsAt);
  const pendingFixture = createEventPreviewState(new Date(now));
  const declineAction = { type: 'DECIDE', registrationId: 'sample-1', status: 'DECLINED' };
  const confirmAction = { type: 'DECIDE', registrationId: 'sample-1', status: 'CONFIRMED' };
  const cancelAction = { type: 'ADMIN_CANCEL', registrationId: 'sample-1' };
  const declined = transition(pendingFixture, declineAction, startedAt);
  assert.equal(declined.registrations[0].status, 'DECLINED');
  const confirmed = transition(pendingFixture, confirmAction, startedAt);
  assert.equal(confirmed.registrations[0].status, 'CONFIRMED');
  assert.equal(transition(confirmed, cancelAction, startedAt).registrations[0].status, 'CANCELLED');
  assert.equal(transition(pendingFixture, cancelAction, startedAt).registrations[0].status, 'CANCELLED');

  const cancelledDuringEvent = transition(pendingFixture, { type: 'STATUS', eventId: event.id, status: 'CANCELLED' }, startedAt);
  for (const action of [declineAction, confirmAction, cancelAction]) {
    assert.throws(() => transition(pendingFixture, action, endedAt), /종료되거나 취소된 행사/);
    assert.throws(() => transition(cancelledDuringEvent, action, startedAt), /종료되거나 취소된 행사/);
  }
  assert.strictEqual(settleEndedRegistrations(cancelledDuringEvent, endedAt), cancelledDuringEvent);
  assert.strictEqual(settleEndedRegistrations(pendingFixture, endedAt - 1), pendingFixture);
  const settled = settleEndedRegistrations(pendingFixture, endedAt);
  assert.deepEqual(settled.registrations.map(({ status }) => status), ['DECLINED', 'DECLINED', 'CONFIRMED']);
  assert.equal(pendingFixture.registrations[0].status, 'PENDING');
  const automatedMails = settled.mails.slice(0, 2);
  assert.equal(settled.mails.length, pendingFixture.mails.length + 2);
  assert.ok(automatedMails.every((mail) => mail.kind === 'AUTOMATIC'));
  const manualMail = declined.mails[0];
  const automatedMail = automatedMails.find((mail) => mail.recipients.includes(manualMail.recipients[0]));
  assert.deepEqual(
    [automatedMail.subject, automatedMail.body, automatedMail.format],
    [manualMail.subject, manualMail.body, manualMail.format],
  );
  const reloaded = JSON.parse(JSON.stringify(settled));
  assert.strictEqual(settleEndedRegistrations(reloaded, endedAt + 1000), reloaded);
  console.log('✓ 행사 시작 후 참가 처리, 종료 시 확인 대기만 참가 불가 전환 및 동일 메일, 중복 방지');

  const afterTimedDeadline = Date.parse('2026-11-14T12:00:00Z');
  const timedEvent = {
    ...created.events[0],
    startsAt: '2026-11-15T18:00:19.100Z',
    endsAt: '2026-11-15T19:00:25.200Z',
    deadlineAt: '2026-11-14T11:00:37.300Z',
  };
  const timedState = { ...created, events: [timedEvent] };
  const editedTimes = Object.fromEntries(
    ['startsAt', 'endsAt', 'deadlineAt'].map((field) => [
      field, resolveEventInput(wallTime(timedEvent[field], timedEvent.timeZone), timedEvent.timeZone, { iso: timedEvent[field], timeZone: timedEvent.timeZone }).iso,
    ]),
  );
  assert.deepEqual(editedTimes, {
    startsAt: timedEvent.startsAt, endsAt: timedEvent.endsAt, deadlineAt: timedEvent.deadlineAt,
  });
  const savedEvent = transition(timedState, {
    type: 'SAVE', event: { ...timedEvent, ...editedTimes, title: '수정한 행사명', onlineUrl: 'https://example.com/join' },
  }, afterTimedDeadline).events[0];
  assert.equal(savedEvent.title, '수정한 행사명');
  assert.equal(savedEvent.deadlineAt, timedEvent.deadlineAt);
  const whileStarted = Date.parse(timedEvent.startsAt) + 1000;
  assert.throws(() => transition(timedState, {
    type: 'SAVE',
    event: { ...timedEvent, startsAt: '2026-11-15T18:30:00Z', deadlineAt: '2026-11-15T18:20:00Z' },
  }, whileStarted), /이미 시작한 행사/);
  assert.equal(transition(timedState, {
    type: 'SAVE', event: { ...timedEvent, onlineUrl: 'https://example.com/live-correction' },
  }, whileStarted).events[0].onlineUrl, 'https://example.com/live-correction');
  const futureEvent = {
    ...timedEvent, startsAt: '2026-11-20T18:00:00Z', endsAt: '2026-11-20T19:00:00Z', deadlineAt: '2026-11-19T18:00:00Z',
  };
  assert.throws(() => transition(timedState, { type: 'SAVE', event: futureEvent }, Date.parse(timedEvent.endsAt)), /종료된 행사는 수정할 수 없습니다/);
  const noEndState = { ...timedState, events: [{ ...timedEvent, endsAt: '' }] };
  assert.throws(() => transition(noEndState, { type: 'SAVE', event: futureEvent }, Date.parse('2026-11-17T00:00:00Z')), /종료된 행사는 수정할 수 없습니다/);
  console.log('✓ 마감 후 일정의 초 단위 보존, 종료된 행사와 종료 시각 미설정 지난 행사의 수정 차단');

  const withoutEnd = { ...fullSeed.events[0], startsAt: '2026-11-14T23:00:00.000Z', endsAt: '', timeZone: 'America/Toronto' };
  assert.equal(eventStatus(fullSeed, withoutEnd, Date.parse('2026-11-15T04:59:59Z')), '모집 마감');
  assert.equal(eventStatus(fullSeed, withoutEnd, Date.parse('2026-11-15T05:00:00Z')), '종료');
  const untimedPending = { ...pendingFixture, events: [withoutEnd] };
  assert.strictEqual(settleEndedRegistrations(untimedPending, Date.parse('2026-11-15T04:59:59Z')), untimedPending);
  assert.equal(settleEndedRegistrations(untimedPending, Date.parse('2026-11-15T05:00:00Z')).registrations[0].status, 'DECLINED');
  const seoulWithoutEnd = { ...withoutEnd, startsAt: '2026-11-14T09:00:00.000Z', timeZone: 'Asia/Seoul' };
  assert.equal(eventStatus(fullSeed, seoulWithoutEnd, Date.parse('2026-11-14T14:59:59Z')), '모집 마감');
  assert.equal(eventStatus(fullSeed, seoulWithoutEnd, Date.parse('2026-11-14T15:00:00Z')), '종료');
  const dstWithoutEnd = { ...withoutEnd, startsAt: '2026-11-01T04:00:00.000Z' };
  assert.equal(eventStatus(fullSeed, dstWithoutEnd, Date.parse('2026-11-02T04:59:59Z')), '모집 마감');
  assert.equal(eventStatus(fullSeed, dstWithoutEnd, Date.parse('2026-11-02T05:00:00Z')), '종료');
  assert.equal(eventStatus(fullSeed, { ...withoutEnd, endsAt: '2026-11-15T07:00:00Z' }, Date.parse('2026-11-15T05:00:00Z')), '모집 마감');

  assert.throws(
    () => transition(fullSeed, { type: 'APPLY', eventId: 'preview-event-live', channel: 'ONLINE', answers: {} }, now),
    /현재 신청할 수 없는 행사/,
  );
  for (const status of ['CANCELLED', 'PUBLISHED', 'CLOSED']) {
    assert.throws(() => transition(fullSeed, { type: 'STATUS', eventId: 'preview-event-finished', status }, now), /종료된 행사/);
  }
  assert.throws(() => transition(fullSeed, { type: 'APPLY', eventId: fullSeed.events[0].id, channel: 'ONLINE', answers: {}, applicant: { ...SELF, email: '' } }, now), /이메일/);
  console.log('✓ 종료 미입력 행사의 현지 자정·서머타임, 종료 후 상태 변경 제한, 계정 이메일 검증');

  assert.equal(resolveEventInput('2026-11-14T09:00', 'Asia/Seoul').iso, '2026-11-14T00:00:00.000Z');
  assert.equal(resolveEventInput('2026-11-13T19:00', 'America/Toronto').iso, '2026-11-14T00:00:00.000Z');
  assert.equal(resolveEventInput('2026-07-01T19:00', 'America/New_York').iso, '2026-07-01T23:00:00.000Z');
  const missingTime = resolveEventInput('2026-03-08T02:30', 'America/New_York');
  assert.equal(missingTime.iso, undefined);
  assert.match(missingTime.errors.time, /사라지는 시각/);
  const repeatedTime = '2026-11-01T01:30';
  const repeatedZone = 'America/New_York';
  const repeated = resolveEventInput(repeatedTime, repeatedZone);
  assert.equal(repeated.iso, undefined);
  assert.deepEqual(repeated.choices.map(({ scheduledAt }) => scheduledAt), ['2026-11-01T05:30:00.000Z', '2026-11-01T06:30:00.000Z']);
  for (const { scheduledAt } of repeated.choices)
    assert.equal(resolveEventInput(repeatedTime, repeatedZone, undefined, scheduledAt).iso, scheduledAt);
  const storedOccurrence = { iso: '2026-11-01T06:30:24.100Z', timeZone: repeatedZone };
  assert.equal(resolveEventInput(repeatedTime, repeatedZone, storedOccurrence).iso, storedOccurrence.iso);
  assert.equal(resolveEventInput(repeatedTime, 'America/Toronto', storedOccurrence).iso, undefined);
  assert.match(formatDate('2026-11-14T00:00:00.000Z', 'Asia/Seoul'), /KST$/);
  assert.match(formatDate('2026-11-14T00:00:00.000Z', 'America/Toronto'), /EST$/);
  assert.match(formatDate('2026-07-01T23:00:00.000Z', 'America/New_York'), /EDT$/);
  assert.doesNotMatch(formatDate('2026-11-14T00:00:00.000Z', 'America/Toronto'), /GMT/);
  const profileZonePreview = renderEventNoticePreview(state.eventTemplates[0], state.events[0], 'ALL', '안내', 'Asia/Seoul');
  assert.match(profileZonePreview.body, /KST/);
  const dstRangePreview = renderEventNoticePreview(
    { ...state.eventTemplates[0], body: '{{eventSchedule}}', format: 'TEXT' },
    { ...state.events[0], startsAt: '2026-11-01T05:30:00Z', endsAt: '2026-11-01T06:30:00Z' },
    'ALL', '', 'America/Toronto',
  );
  assert.match(dstRangePreview.body, /01:30 EDT.*01:30 EST/);
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
