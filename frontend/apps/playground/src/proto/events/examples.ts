import type { EventMailPreview, EventPreviewState, EventRegistration } from '@studyclub/types';

import {
  cancellationEventTemplate,
  channels,
  createEventNoticeMail,
  fillLegacyEventMailPreview,
  formatDate,
  occupiesSeat,
  seatInfo,
} from './model';

const REVISION = 11;
const LEGACY_EVENT_COPY: Record<string, { title?: string; summary?: string; description?: string }> = {
  'preview-event-full': {
    summary: '소규모 산책 모임의 모든 자리가 채워졌습니다.',
    description: '가볍게 공원을 걸으며 개발과 커리어 이야기를 나눕니다.\n\n서로 충분히 이야기할 수 있도록 8명만 함께합니다. 편한 신발과 물을 준비해 주세요. 현재 정원이 모두 찼으며 취소 자리가 생기면 다시 신청할 수 있습니다.',
  },
  'preview-event-live': {
    summary: '지금 함께 질문을 나누고 있는 온라인 모임입니다.',
    description: '특강을 듣고 생긴 질문을 함께 정리하는 오피스아워입니다.\n\n행사가 진행 중이므로 신규 신청은 받지 않습니다. 참가 확정자는 내 신청 내역에서 참여 안내를 확인해 주세요.',
  },
  'preview-event-closed': {
    title: 'AI 커리어 토크 · 참가자 확정 중',
    summary: '모집을 마치고 신청 내용을 확인하고 있습니다.',
    description:
      'AI를 활용하는 개발자의 경험과 고민을 나누는 대화 모임입니다.\n\n모집은 마감되었으며 운영진이 신청 내용을 확인하고 있습니다. 참가가 확정된 분께 참여 안내를 보내드립니다.\n\n온라인과 오프라인으로 함께하며, 발표 이후에는 참가자 질문을 중심으로 이야기를 나눕니다.',
  },
  'preview-event-finished': {
    summary: '가치 함수와 정책의 관계를 함께 살펴본 지난 특강입니다.',
    description:
      '강화학습의 기초 개념과 간단한 적용 사례를 함께 살펴보았습니다.\n\n행사는 종료되었습니다. 참가 확정 내역과 당시 전달된 안내를 확인할 수 있습니다. 다음 모임 일정은 새 행사 공지로 안내합니다.',
  },
  'preview-event-cancelled': {
    title: '베이 지역 피크닉 · 우천 취소',
    summary: '우천 예보로 취소되어 신청자에게 안내를 마친 행사입니다.',
    description:
      '야외 피크닉을 준비했으나 우천 예보로 행사를 취소했습니다.\n\n신청도 함께 취소되었으며 기존 참가자에게 취소 안내를 전달했습니다. 새로운 일정이 정해지면 별도 행사로 모집하겠습니다.',
  },
};
const ANNOUNCEMENTS: Record<string, [string, string][]> = {
  'preview-event-community': [
    [
      '참여 전 안내',
      '행사 시작 10분 전부터 입장할 수 있습니다.\n발표 후에는 질문과 대화 시간이 이어집니다. 미리 궁금한 점을 생각해 와 주세요.\n온라인 참여 링크는 행사 전날 다시 안내드릴게요.',
    ],
    [
      '현장·온라인 참여 안내',
      '오프라인 참가자는 입구에서 닉네임을 말씀해 주세요. 별도 준비물은 없습니다.\n온라인 참가자는 마이크를 끄고 입장한 뒤 채팅으로 질문을 남겨 주세요.',
    ],
  ],
  'preview-event-coffee': [
    [
      '특강 참여 안내',
      '스터디클럽 디스코드의 AI 논문 스터디 공부방에서 만나요.\nV·Q·정책의 관계를 함께 살펴볼 예정입니다. 처음 접하셔도 괜찮아요.',
    ],
    [
      '질문 준비 안내',
      '강화학습을 공부하며 막혔던 부분을 한 가지씩 적어 와 주세요.\n가치 함수, 정책 최적화, 논문 읽기에 관한 질문을 함께 다룹니다.\n실습 환경을 미리 설치할 필요는 없습니다.',
    ],
  ],
  'preview-event-picnic': [
    [
      '피크닉 준비 안내',
      '공원 입구에서 닉네임을 확인한 뒤 함께 이동합니다.\n편한 신발과 개인 물병을 준비해 주세요. 가벼운 게임과 산책을 함께합니다.\n식사 비용은 현장에서 나누어 부담합니다.',
    ],
    [
      '식사·현장 안내',
      '신청서에 적어 주신 식사 선호를 참고해 메뉴를 준비하고 있습니다.\n개별 도시락을 가져오셔도 괜찮아요. 공원에는 주류를 가져올 수 없습니다.\n도착이 늦어지면 디스코드로 운영진에게 알려 주세요.',
    ],
  ],
};

/** 기존에 편집한 신청·템플릿·메일은 보존하고 누락된 체험용 사례만 보충한다. */
export function populateEventExamples(
  current: EventPreviewState,
  samples: EventPreviewState,
  now = Date.now(),
  displayTimeZone?: string,
) {
  if (current.exampleRevision === REVISION) return current;
  const state = structuredClone(current);
  // 상태를 제목이나 소개에 써 둔 이전 예시는 모집 당시 문구로만 교체한다.
  // 운영자가 직접 수정한 값은 이전 기본 문구와 정확히 일치할 때만 바꾼다.
  for (const event of state.events) {
    const sample = samples.events.find((item) => item.id === event.id);
    const legacy = LEGACY_EVENT_COPY[event.id];
    if (!sample || !legacy) continue;
    if (legacy.title && event.title === legacy.title) event.title = sample.title;
    if (legacy.summary && event.summary === legacy.summary) event.summary = sample.summary;
    if (legacy.description && event.description === legacy.description) event.description = sample.description;
  }
  // 예전에 자동 생성한 가명/주소만 스터디 예시 스타일로 교체한다. 처리 상태와 직접 만든 이력은 보존한다.
  const replacements = new Map<string, string>();
  for (const row of state.registrations) {
    const sample = samples.registrations.find((item) => item.id === row.id);
    if (!sample || !row.id.startsWith('sample-') || !row.email.endsWith('.example.test')) continue;
    replacements.set(row.name, sample.name);
    replacements.set(row.email, sample.email);
    row.name = sample.name;
    row.email = sample.email;
  }
  const updateExample = (value: string) => {
    for (const [before, after] of replacements) value = value.replaceAll(before, after);
    return value;
  };
  for (const mail of state.mails.filter((item) => item.id.startsWith('example-mail-'))) {
    mail.recipients = mail.recipients.map(updateExample);
    mail.body = updateExample(mail.body);
    mail.deliveries = mail.deliveries?.map((delivery) => ({ ...delivery, recipient: updateExample(delivery.recipient), body: updateExample(delivery.body) }));
  }
  for (const sample of samples.events) {
    const existing = state.events.find((item) => item.id === sample.id);
    const event = existing ?? structuredClone(sample);
    if (!existing) state.events.push(event);
    if (!event.publishedAt) continue;
    if (event.title === sample.title && event.questions.length === 0)
      event.questions = structuredClone(sample.questions);
    for (const registration of samples.registrations.filter((row) => row.eventId === event.id)) {
      if (
        state.registrations.some(
          (row) => row.id === registration.id || (row.eventId === event.id && row.memberId === registration.memberId),
        )
      )
        continue;
      if (!channels(event).includes(registration.channel)) continue;
      if (
        occupiesSeat(registration) &&
        event.status !== 'CANCELLED' &&
        seatInfo(state, event, registration.channel).remaining <= 0
      )
        continue;
      state.registrations.push({
        ...structuredClone(registration),
        createdAt: new Date(
          Math.min(now, Math.max(Date.parse(registration.createdAt), Date.parse(event.publishedAt))),
        ).toISOString(),
        status: event.status === 'CANCELLED' ? 'CANCELLED' : registration.status,
      });
    }
    if (event.status === 'CANCELLED' && event.cancellationRecipientIds === undefined) {
      const sent = state.mails.find((mail) => mail.eventId === event.id && mail.audience === 'CANCELLED_ACTIVE');
      if (sent) {
        event.cancellationRecipientIds = state.registrations
          .filter((row) => row.eventId === event.id && sent.recipients.includes(row.email)).map((row) => row.id);
      } else if (sample.status === 'CANCELLED') {
        event.cancellationRecipientIds = [...(sample.cancellationRecipientIds ?? [])];
      }
    }
    const rows = state.registrations.filter((row) => row.eventId === event.id && row.id.startsWith('sample-'));
    const examples: EventMailPreview[] = [];
    const addMail = (
      row: EventRegistration,
      kind: string,
      title: string,
      body: string,
      hoursAfterApplication: number,
      format: 'TEXT' | 'HTML' = 'TEXT',
    ) => {
      examples.push({
        id: `example-mail-${event.id}-${row.id}-${kind}`,
        eventId: event.id,
        subject: `[StudyClub] ${event.title} ${title}`,
        recipients: [row.email],
        body,
        format,
        kind: 'AUTOMATIC',
        createdAt: new Date(Math.min(now, Date.parse(row.createdAt) + hoursAfterApplication * 3600000)).toISOString(),
      });
    };
    for (const status of ['PENDING', 'CONFIRMED', 'DECLINED', 'CANCELLED'] as const) {
      for (const row of rows.filter((item) => item.status === status).slice(0, 2)) {
        if (event.confirmation === 'REVIEW' || status === 'PENDING')
          addMail(
            row,
            'received',
            '신청 접수',
            `${row.name}님, 신청이 접수되었습니다.\n참여 방식과 작성해 주신 내용을 운영진이 확인하고 있습니다. 참가가 확정되면 다시 안내드릴게요.`,
            0,
          );
        if (status === 'CONFIRMED')
          addMail(
            row,
            'confirmed',
            '참가 확정',
            `${row.name}님, 참가가 확정되었습니다.\n일정: ${formatDate(event.startsAt, event.timeZone)}\n행사 페이지의 내 신청 내역에서 참여 안내를 확인해 주세요.`,
            1,
          );
        if (status === 'DECLINED')
          addMail(
            row,
            'declined',
            '참가 불가',
            `${row.name}님, 신청해 주셔서 감사합니다.\n운영진 확인 결과 이번 행사에는 함께하기 어렵게 되었습니다. 궁금한 점은 운영진에게 문의해 주세요.`,
            1,
          );
        if (status === 'CANCELLED')
          addMail(
            row,
            'cancelled',
            '신청 취소',
            `${row.name}님, 신청 취소가 완료되었습니다.\n확보되어 있던 자리는 반환되었습니다. 다음 행사에서 다시 만나요.`,
            2,
          );
      }
    }
    const template = state.eventTemplates[0] ?? (state.deletedTemplateTriggers?.includes('EVENT_ANNOUNCEMENT') ? undefined : samples.eventTemplates[0]);
    const defaultConfirmedIds = new Set(
      samples.registrations
        .filter((row) => row.eventId === event.id && row.status === 'CONFIRMED')
        .map((row) => row.id),
    );
    const confirmed = rows.filter((row) => defaultConfirmedIds.has(row.id));
    if (template) {
      const messages =
        ANNOUNCEMENTS[event.id] ??
        (event.endsAt && Date.parse(event.endsAt) < now
          ? [
              [
                '함께해 주셔서 감사합니다',
                '행사에 함께해 주셔서 감사합니다.\n나누었던 질문과 의견을 바탕으로 다음 모임을 준비하겠습니다. 다음 행사에서도 만나요.',
              ],
            ]
          : [
              [
                '행사 참여 안내',
                '참가 신청이 확정되었습니다. 행사 페이지에서 일정과 참여 장소를 다시 확인해 주세요.\n시작 10분 전까지 준비해 주시고, 변경 사항이 있다면 운영진에게 알려 주세요.',
              ],
            ]);
      const addAnnouncement = (title: string, notice: string, audience: 'ALL' | 'ONLINE' | 'OFFLINE', key: string, hours: number) => {
        const recipients = confirmed.filter((row) => audience === 'ALL' || row.channel === audience);
        if (!recipients.length) return;
        const afterApplications = Math.max(...recipients.map((row) => Date.parse(row.createdAt))) + hours * 3600000;
        const sentAt = event.endsAt && Date.parse(event.endsAt) < now
          ? Math.max(afterApplications, Date.parse(event.endsAt) + 3600000)
          : afterApplications;
        const mail = createEventNoticeMail(
          { ...template, subject: `[StudyClub] {{eventTitle}} ${title}` }, event, recipients, notice, audience,
          `example-mail-${event.id}-batch-${key}`, new Date(Math.min(now, sentAt)).toISOString(),
          displayTimeZone,
        );
        examples.push(mail);
      };
      messages.forEach(([title, notice], index) => addAnnouncement(title, notice, 'ALL', `all-${index}`, 3 + index));
      if (event.format === 'HYBRID') {
        addAnnouncement('온라인 접속 안내', '온라인으로 함께하는 분들께 안내드립니다.\n행사 페이지의 내 신청 내역에서 접속 링크를 확인해 주세요. 시작 10분 전부터 입장할 수 있습니다.\n마이크는 음소거하고, 질문은 채팅창에 남겨 주세요.', 'ONLINE', 'online', 5);
        addAnnouncement('오프라인 장소·준비물 안내', '현장에서 함께하는 분들께 안내드립니다.\n행사 시작 15분 전까지 안내된 장소로 와 주세요. 입구에서 신청 닉네임을 확인합니다.\n개인 물병과 메모할 도구를 준비해 주세요. 늦게 도착하면 디스코드로 운영진에게 알려 주세요.', 'OFFLINE', 'offline', 6);
      }
    }
    if (event.status === 'CANCELLED' && rows.length && template) {
      examples.push(
        createEventNoticeMail(
          cancellationEventTemplate(template),
          event,
          rows.filter((row) => event.cancellationRecipientIds?.includes(row.id)),
          '우천 예보로 행사를 취소하게 되었습니다. 기다려 주신 여러분께 양해 부탁드리며, 새로운 일정이 정해지면 다시 안내드리겠습니다.',
          'CANCELLED_ACTIVE',
          `example-mail-${event.id}-event-cancelled`,
          new Date(now - 3600000).toISOString(),
          displayTimeZone,
        ),
      );
    }
    const latestExamples = new Map(examples.map((mail) => [mail.id, mail]));
    state.mails = state.mails.map((mail) => latestExamples.get(mail.id) ?? mail);
    const ids = new Set(state.mails.map((mail) => mail.id));
    state.mails.push(...examples.filter((mail) => !ids.has(mail.id)));
  }
  state.mails = state.mails.map((mail) => {
    mail.kind ??= mail.audience && mail.audience !== 'ACTIVE' ? 'OPERATOR' : 'AUTOMATIC';
    const event = state.events.find((item) => item.id === mail.eventId);
    return event ? fillLegacyEventMailPreview(mail, event) : mail;
  });
  state.mails.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  state.exampleRevision = REVISION;
  return state;
}
