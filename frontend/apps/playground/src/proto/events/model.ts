import { zoneAbbreviation } from '@core/lib/schedule-timezone';
import type {
  EventChannel,
  EventQuestion,
  EventMailPreview,
  EventNoticeTemplate,
  PreviewNotificationTemplate,
  EventPreviewState,
  EventRegistration,
  PreviewEvent,
} from '@studyclub/types';

export const SELF = { memberId: 'preview-self', name: '코딩구름', email: 'me@example.test' };
export const CHANNEL_LABEL = { ONLINE: '온라인', OFFLINE: '오프라인' };
export const FORMAT_LABEL = { ...CHANNEL_LABEL, HYBRID: '온라인·오프라인' };
export const CONFIRM_LABEL = { AUTO: '자동 확정', REVIEW: '운영진 확인 후 확정' };
export const REGISTRATION_LABEL = {
  PENDING: '확인 대기',
  CONFIRMED: '참가 확정',
  DECLINED: '참가 불가',
  CANCELLED: '신청 취소',
};
export const ZONES = [
  { value: 'Asia/Seoul', label: '한국 (서울)' },
  { value: 'America/Toronto', label: '캐나다 (토론토)' },
  { value: 'America/New_York', label: '미국 (뉴욕)' },
  { value: 'America/Los_Angeles', label: '미국 (로스앤젤레스)' },
];

export function normalizeEventAnswers(
  questions: EventQuestion[],
  source: EventRegistration['answers'],
): EventRegistration['answers'] {
  return questions.reduce<EventRegistration['answers']>((result, question) => {
    const answer = source[question.id];
    if (answer === undefined) return result;
    if (!['RADIO', 'CHECKBOX', 'SELECT'].includes(question.type)) {
      if (!Array.isArray(answer)) result[question.id] = answer;
      return result;
    }
    const values = (Array.isArray(answer) ? answer : [answer]).filter((value) => question.options.includes(value));
    if (question.type === 'CHECKBOX') {
      if (values.length) result[question.id] = values;
    } else if (values[0]) result[question.id] = values[0];
    return result;
  }, {});
}

export function wallTime(iso: string, timeZone: string) {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** DST로 사라지거나 두 번 나타나는 시각은 임의로 선택하지 않는다. */
export function wallTimeToIso(value: string, zone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const naive = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(naive)) return null;
  const offsets = new Set(
    [-24, 0, 24].map((hours) => {
      const sample = new Date(naive + hours * 3600000).toISOString();
      return Date.parse(`${wallTime(sample, zone)}:00Z`) - Date.parse(sample);
    }),
  );
  const matches = [...offsets]
    .map((offset) => new Date(naive - offset).toISOString())
    .filter((iso) => wallTime(iso, zone) === value);
  return matches.length === 1 ? matches[0]! : null;
}

export function formatDate(iso: string, zone: string, locale = 'ko-KR', includeTimeZone = true) {
  const at = new Date(iso);
  const formatted = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at);
  return includeTimeZone ? `${formatted} ${zoneAbbreviation(zone, at)}` : formatted;
}

export function channels(event: PreviewEvent): EventChannel[] {
  return event.format === 'HYBRID' ? ['ONLINE', 'OFFLINE'] : [event.format];
}
export function occupiesSeat(r: EventRegistration) {
  return r.status === 'PENDING' || r.status === 'CONFIRMED';
}
export function seatInfo(state: EventPreviewState, event: PreviewEvent, channel: EventChannel) {
  const rows = state.registrations.filter((r) => r.eventId === event.id && r.channel === channel && occupiesSeat(r));
  const capacity = channel === 'ONLINE' ? event.onlineCapacity : event.offlineCapacity;
  return {
    capacity,
    pending: rows.filter((r) => r.status === 'PENDING').length,
    confirmed: rows.filter((r) => r.status === 'CONFIRMED').length,
    remaining: Math.max(0, capacity - rows.length),
  };
}
export function eventStatus(state: EventPreviewState, event: PreviewEvent, now = Date.now()) {
  if (event.status === 'DRAFT') return '작성 중';
  if (event.status === 'CANCELLED') return '행사 취소';
  if (event.endsAt && Date.parse(event.endsAt) <= now) return '종료';
  if (!event.endsAt && wallTime(new Date(now).toISOString(), event.timeZone).slice(0, 10) > wallTime(event.startsAt, event.timeZone).slice(0, 10)) return '종료';
  if (Date.parse(event.startsAt) <= now) return event.endsAt ? '진행 중' : '행사 시작';
  if (event.status === 'CLOSED' || Date.parse(event.deadlineAt) <= now) return '모집 마감';
  if (channels(event).every((channel) => seatInfo(state, event, channel).remaining === 0)) return '정원 마감';
  return '모집 중';
}
export function safeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateEvent(event: PreviewEvent, state: EventPreviewState, now = Date.now()): string | null {
  const previous = state.events.find((e) => e.id === event.id);
  if (!event.title.trim() || !event.summary.trim() || !event.description.trim())
    return '행사명, 한 줄 소개, 모집 상세를 입력해 주세요.';
  if (event.title.length > 60) return '행사명은 60자 이내로 입력해 주세요.';
  if (
    ![event.startsAt, event.deadlineAt].every((x) => Number.isFinite(Date.parse(x))) ||
    (event.endsAt && !Number.isFinite(Date.parse(event.endsAt)))
  )
    return '일정을 모두 입력해 주세요.';
  if (event.endsAt && Date.parse(event.endsAt) <= Date.parse(event.startsAt))
    return '종료시간은 시작시간보다 늦어야 합니다.';
  if (Date.parse(event.deadlineAt) > Date.parse(event.startsAt))
    return '신청 마감시간은 행사 시작시간 이전으로 설정해 주세요.';
  if (
    event.status === 'PUBLISHED' &&
    Date.parse(event.deadlineAt) !== Date.parse(previous?.deadlineAt ?? '') &&
    Date.parse(event.deadlineAt) <= now
  )
    return '신청 마감시간을 현재보다 늦게 설정해 주세요.';
  if (!ZONES.some((zone) => zone.value === event.timeZone)) return '기준 시간대를 선택해 주세요.';
  for (const channel of channels(event)) {
    const info = seatInfo(state, event, channel);
    if (!Number.isInteger(info.capacity) || info.capacity < 1 || info.capacity > 10000)
      return '정원은 1명부터 10,000명까지 입력해 주세요.';
    if (info.capacity < info.pending + info.confirmed) return '확인 대기와 참가 확정 인원보다 정원을 줄일 수 없습니다.';
  }
  if (channels(event).includes('OFFLINE') && !event.location.trim()) return '오프라인 장소를 입력해 주세요.';
  if (event.onlineUrl && !safeWebUrl(event.onlineUrl))
    return '온라인 참여 링크는 http 또는 https 주소로 입력해 주세요.';
  for (const q of event.questions) {
    if (!q.label.trim()) return '질문 제목을 입력해 주세요.';
    if (
      ['RADIO', 'CHECKBOX', 'SELECT'].includes(q.type) &&
      (q.options.length < 2 || q.options.some((x) => !x.trim()) || new Set(q.options).size !== q.options.length)
    )
      return '선택지는 서로 다른 내용으로 2개 이상 입력해 주세요.';
  }
  if (previous?.status === 'CANCELLED') return '취소된 행사는 수정할 수 없습니다.';
  if (
    previous &&
    previous.confirmation !== event.confirmation &&
    (Date.parse(previous.startsAt) <= now || Date.parse(event.startsAt) <= now)
  )
    return '행사 시작 후에는 참가 확정 방식을 변경할 수 없습니다.';
  if (previous && state.registrations.some((r) => r.eventId === event.id)) {
    const removedChannel = state.registrations.find(
      (r) => r.eventId === event.id && occupiesSeat(r) && !channels(event).includes(r.channel),
    );
    if (removedChannel)
      return `${CHANNEL_LABEL[removedChannel.channel]} 신청자가 남아 있어 해당 참여 방식을 없앨 수 없습니다. 기존 신청을 먼저 정리해 주세요.`;
  }
  return null;
}

const NOTICE_VARIABLES = ['nickname', 'eventTitle', 'eventSchedule', 'participation', 'channel', 'notice'];
const AUTOMATIC_EVENT_VARIABLES = ['nickname', 'eventTitle', 'eventSchedule', 'participation', 'channel'];
export function validateEventTemplate(template: EventNoticeTemplate): string | null {
  if (!template.subject.trim() || !template.body.trim()) return '템플릿 제목과 본문을 입력해 주세요.';
  if (!/{{\s*notice\s*}}/.test(template.body)) return '행사 안내 내용이 들어갈 {{notice}}를 본문에 넣어 주세요.';
  const unknown = [...`${template.subject} ${template.body}`.matchAll(/{{([\s\S]*?)}}/g)].find(
    (match) => !NOTICE_VARIABLES.includes(match[1]!.trim()),
  );
  return unknown ? `지원하지 않는 변수입니다: ${unknown[0]}` : null;
}
/** 새 기본 양식만 보충하고 운영자가 삭제한 알림 조건은 유지한다. */
export function mergeNotificationTemplates(
  stored: PreviewNotificationTemplate[],
  defaults: PreviewNotificationTemplate[],
  deleted: PreviewNotificationTemplate['trigger'][] = [],
) {
  let nextId = Math.max(0, ...stored.map((template) => template.id), ...defaults.map((template) => template.id));
  return [...stored, ...defaults
    .filter((sample) => !deleted.includes(sample.trigger) && !stored.some((template) => template.trigger === sample.trigger))
    .map((sample) => ({ ...structuredClone(sample), id: stored.some((template) => template.id === sample.id) ? ++nextId : sample.id }))];
}

function validateAutomaticEventTemplate(template: PreviewNotificationTemplate): string | null {
  if (!template.subject.trim() || !template.body.trim()) return '템플릿 제목과 본문을 입력해 주세요.';
  const unknown = [...`${template.subject} ${template.body}`.matchAll(/{{([\s\S]*?)}}/g)].find(
    (match) => !AUTOMATIC_EVENT_VARIABLES.includes(match[1]!.trim()),
  );
  return unknown ? `지원하지 않는 변수입니다: ${unknown[0]}` : null;
}
function renderNoticeValues(template: Pick<EventNoticeTemplate, 'subject' | 'body'>, values: Record<string, string>, storedFormat?: 'HTML' | 'TEXT') {
  const escape = (value: string) =>
    value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  const replace = (value: string, html: boolean) =>
    value.replace(/{{\s*(\w+)\s*}}/g, (original, key: string) =>
      values[key] === undefined ? original : html ? escape(values[key]!).replaceAll('\n', '<br>') : values[key]!,
    );
  const format = storedFormat ?? (/^\s*</.test(template.body) ? 'HTML' : 'TEXT');
  return {
    subject: replace(template.subject, false),
    body: replace(template.body, format === 'HTML'),
    format,
  } as const;
}

function eventNoticeValues(event: PreviewEvent, channel: EventChannel | 'ALL', displayTimeZone = event.timeZone) {
  const modes = channel === 'ALL' ? channels(event) : [channel];
  return {
    eventTitle: event.title,
    channel: channel === 'ALL' ? FORMAT_LABEL[event.format] : CHANNEL_LABEL[channel],
    eventSchedule: event.endsAt
      ? `${formatDate(event.startsAt, displayTimeZone, 'ko-KR', false)} ~ ${formatDate(event.endsAt, displayTimeZone)}`
      : formatDate(event.startsAt, displayTimeZone),
    participation: modes.map((mode) => {
      const detail = mode === 'OFFLINE' ? event.location : event.onlineUrl || '온라인 참여 링크는 추후 안내드립니다.';
      return modes.length > 1 ? `${CHANNEL_LABEL[mode]}: ${detail}` : detail;
    }).join('\n'),
  };
}

/** 닉네임만 원문으로 두고 행사 정보와 선택한 대상의 참여 안내를 채운다. */
export function renderEventNoticePreview(
  template: EventNoticeTemplate,
  event: PreviewEvent,
  channel: EventChannel | 'ALL',
  notice: string,
  displayTimeZone = event.timeZone,
) {
  return renderNoticeValues(template, { ...eventNoticeValues(event, channel, displayTimeZone), notice: notice.trim() });
}

/** 구버전 공통 미리보기의 빈 행사 정보만 한 번 채운다. 개인별 발송 결과는 변경하지 않는다. */
export function fillLegacyEventMailPreview(mail: EventMailPreview, event: PreviewEvent): EventMailPreview {
  if (!mail.deliveries || mail.previewVersion === 2) return mail;
  const channel = mail.audience === 'ONLINE' || mail.audience === 'OFFLINE' ? mail.audience : 'ALL';
  // 개별 치환본에도 남은 변수는 운영진이 본문에 직접 쓴 문자열일 수 있어 그대로 둔다.
  const values = Object.fromEntries(Object.entries(eventNoticeValues(event, channel)).filter(([key]) => {
    const literal = new RegExp(`{{\\s*${key}\\s*}}`);
    return !mail.deliveries!.some((delivery) => literal.test(delivery.body) || literal.test(delivery.subject));
  }));
  return { ...mail, ...renderNoticeValues(mail, values, mail.format ?? 'TEXT'), previewVersion: 2 };
}

export function renderEventNotice(
  template: EventNoticeTemplate,
  event: PreviewEvent,
  recipient: EventRegistration,
  notice: string,
  displayTimeZone = recipient.timeZone ?? event.timeZone,
) {
  return renderNoticeValues(template, {
    ...eventNoticeValues(event, recipient.channel, displayTimeZone),
    nickname: recipient.name,
    notice: notice.trim(),
  });
}

type EventAutomaticTrigger = Extract<
  PreviewNotificationTemplate['trigger'],
  | 'EVENT_REGISTRATION_PENDING'
  | 'EVENT_REGISTRATION_CONFIRMED'
  | 'EVENT_REGISTRATION_DECLINED'
  | 'EVENT_REGISTRATION_CANCELLED'
>;

function renderAutomaticEventMail(
  template: PreviewNotificationTemplate,
  event: PreviewEvent,
  registration: EventRegistration,
) {
  return renderNoticeValues(template, {
    ...eventNoticeValues(event, registration.channel, registration.timeZone ?? event.timeZone),
    nickname: registration.name,
    channel: CHANNEL_LABEL[registration.channel],
  });
}

export function mailAudienceLabel(mail: EventMailPreview) {
  const labels = {
    ALL: '참가 확정자 전체',
    ONLINE: '온라인 참가 확정자',
    OFFLINE: '오프라인 참가 확정자',
    ACTIVE: '확인 대기·참가 확정자 전체',
    CANCELLED_ACTIVE: '취소 당시 신청자 전체',
  };
  return mail.audience ? labels[mail.audience] : mail.recipients.length === 1 ? '개별 안내' : '단체 안내';
}

/** 발송 작업 하나와 수신자별 결과를 함께 보존한다. 미리보기에는 특정 참가자를 대입하지 않는다. */
export function createEventNoticeMail(
  template: EventNoticeTemplate,
  event: PreviewEvent,
  recipients: EventRegistration[],
  notice: string,
  audience: EventChannel | 'ALL' | 'CANCELLED_ACTIVE',
  id: string,
  createdAt: string,
  displayTimeZone = event.timeZone,
): EventMailPreview {
  const preview = renderEventNoticePreview(
    template,
    event,
    audience === 'CANCELLED_ACTIVE' ? 'ALL' : audience,
    notice,
    displayTimeZone,
  );
  const deliveries = recipients.map((recipient) => ({
    recipient: recipient.email,
    ...renderEventNotice(template, event, recipient, notice),
  }));
  return {
    id, eventId: event.id, audience, createdAt, kind: 'OPERATOR',
    recipients: recipients.map((recipient) => recipient.email),
    ...preview, previewVersion: 2, deliveries,
  };
}

export function cancellationEventTemplate(template: EventNoticeTemplate): EventNoticeTemplate {
  return {
    ...template,
    subject: '[StudyClub] {{eventTitle}} 행사 취소 안내',
    body: template.body
      .replace('>행사 안내</p>', '>행사 취소 안내</p>')
      .replace(
        '이 메일은 참가가 확정된 {{eventTitle}} 행사의 운영 안내를 위해 발송되었습니다.',
        '이 메일은 {{eventTitle}} 행사 취소 안내를 위해 발송되었습니다.',
      ),
  };
}

export type EventAction =
  | { type: 'SAVE'; event: PreviewEvent }
  | { type: 'STATUS'; eventId: string; status: PreviewEvent['status'] }
  | { type: 'APPLY'; eventId: string; channel: EventChannel; answers: EventRegistration['answers']; applicant?: typeof SELF & { timeZone?: string } }
  | { type: 'DECIDE'; registrationId: string; status: 'CONFIRMED' | 'DECLINED' }
  | { type: 'CANCEL'; registrationId: string }
  | { type: 'ADMIN_CANCEL'; registrationId: string }
  | { type: 'TEMPLATES'; templates: PreviewNotificationTemplate[]; deletedTriggers?: PreviewNotificationTemplate['trigger'][] }
  | { type: 'MAIL'; eventId: string; channel: EventChannel | 'ALL'; templateId: number; notice: string; displayTimeZone?: string }
  | { type: 'CANCELLATION_MAIL'; eventId: string; templateId: number; notice: string; displayTimeZone?: string };

/** 플레이그라운드의 단일 판정 지점. 실제 연동에서는 동일한 판정을 서버가 반환해야 한다. */
export function transition(current: EventPreviewState, action: EventAction, now = Date.now()): EventPreviewState {
  const state: EventPreviewState = structuredClone(current);
  const id = () => crypto.randomUUID();
  const mail = (
    event: PreviewEvent,
    recipients: string[],
    subject: string,
    body: string,
    format: 'HTML' | 'TEXT' = 'TEXT',
    audience?: EventMailPreview['audience'],
  ) => {
    if (recipients.length)
      state.mails.unshift({
        id: id(),
        eventId: event.id,
        recipients,
        audience,
        format,
        subject: subject.startsWith('[StudyClub]') ? subject : `[StudyClub] ${subject}`,
        body,
        kind: 'AUTOMATIC',
        createdAt: new Date(now).toISOString(),
      });
  };
  const automaticMail = (
    trigger: EventAutomaticTrigger,
    event: PreviewEvent,
    registration: EventRegistration,
  ) => {
    const template = state.notificationTemplates?.find((item) => item.trigger === trigger);
    if (!template) return;
    const rendered = renderAutomaticEventMail(template, event, registration);
    mail(event, [registration.email], rendered.subject, rendered.body, rendered.format);
  };
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (action.type === 'TEMPLATES') {
    const eventTemplates = action.templates.filter((t): t is EventNoticeTemplate => t.trigger === 'EVENT_ANNOUNCEMENT');
    if (new Set(action.templates.map((t) => t.id)).size !== action.templates.length)
      fail('템플릿 ID가 중복되었습니다.');
    for (const template of eventTemplates) {
      const error = validateEventTemplate(template);
      if (error) fail(error);
    }
    for (const template of action.templates.filter((item) => item.trigger.startsWith('EVENT_REGISTRATION_'))) {
      const error = validateAutomaticEventTemplate(template);
      if (error) fail(error);
    }
    state.notificationTemplates = structuredClone(action.templates);
    state.eventTemplates = structuredClone(eventTemplates);
    state.deletedTemplateTriggers = [...new Set([
      ...(state.deletedTemplateTriggers ?? []),
      ...(action.deletedTriggers ?? []),
      ...(current.notificationTemplates ?? []).filter((template) => !action.templates.some((item) => item.trigger === template.trigger)).map((template) => template.trigger),
    ])].filter((trigger) => !action.templates.some((template) => template.trigger === trigger));
    return state;
  }
  if (action.type === 'SAVE') {
    const error = validateEvent(action.event, state, now);
    if (error) fail(error);
    const index = state.events.findIndex((e) => e.id === action.event.id);
    if (index < 0) state.events.unshift(action.event);
    else {
      const changedToAuto = state.events[index]!.confirmation !== 'AUTO' && action.event.confirmation === 'AUTO';
      state.events[index] = action.event;
      if (changedToAuto) {
        const pending = state.registrations.filter(
          (registration) => registration.eventId === action.event.id && registration.status === 'PENDING',
        );
        for (const registration of pending) {
          registration.status = 'CONFIRMED';
          automaticMail(
            'EVENT_REGISTRATION_CONFIRMED',
            action.event,
            registration,
          );
        }
      }
    }
    return state;
  }
  if (action.type === 'DECIDE' || action.type === 'CANCEL' || action.type === 'ADMIN_CANCEL') {
    const registration =
      state.registrations.find((r) => r.id === action.registrationId) ?? fail('신청 내역을 찾을 수 없습니다.');
    const event = state.events.find((e) => e.id === registration.eventId) ?? fail('행사를 찾을 수 없습니다.');
    if (action.type === 'CANCEL' || action.type === 'ADMIN_CANCEL') {
      if (!occupiesSeat(registration) || (action.type === 'CANCEL' && registration.memberId !== SELF.memberId))
        fail('취소할 수 없는 신청입니다.');
      if (action.type === 'CANCEL' && Date.parse(event.deadlineAt) <= now)
        fail('신청 마감 후에는 운영진에게 취소를 요청해 주세요.');
      if (action.type === 'ADMIN_CANCEL' && Date.parse(event.startsAt) <= now)
        fail('행사 시작 후에는 신청을 취소할 수 없습니다.');
      registration.status = 'CANCELLED';
      automaticMail(
        'EVENT_REGISTRATION_CANCELLED',
        event,
        registration,
      );
    } else {
      if (registration.status !== 'PENDING' || event.status === 'CANCELLED' || Date.parse(event.startsAt) <= now)
        fail('현재 상태에서는 처리할 수 없습니다.');
      registration.status = action.status;
      automaticMail(
        action.status === 'CONFIRMED' ? 'EVENT_REGISTRATION_CONFIRMED' : 'EVENT_REGISTRATION_DECLINED',
        event,
        registration,
      );
    }
    return state;
  }
  const event = state.events.find((e) => e.id === action.eventId) ?? fail('행사를 찾을 수 없습니다.');
  if (action.type === 'STATUS') {
    if (event.status === 'CANCELLED') fail('취소된 행사는 다시 공개할 수 없습니다.');
    if (eventStatus(state, event, now) === '종료') fail('종료된 행사는 취소하거나 모집 상태를 변경할 수 없습니다.');
    if (action.status === 'DRAFT' && state.registrations.some((r) => r.eventId === event.id))
      fail('신청 이력이 있는 행사는 공개를 취소할 수 없습니다.');
    if (action.status === 'PUBLISHED') {
      if (Date.parse(event.deadlineAt) <= now) fail('신청 마감시간을 현재보다 늦게 설정해 주세요.');
      const error = validateEvent({ ...event, status: 'PUBLISHED' }, state, now);
      if (error) fail(error);
      event.publishedAt ??= new Date(now).toISOString();
    }
    event.status = action.status;
    if (action.status === 'CANCELLED') {
      const active = state.registrations.filter((r) => r.eventId === event.id && occupiesSeat(r));
      event.cancellationRecipientIds = active.map((registration) => registration.id);
      active.forEach((r) => {
        r.status = 'CANCELLED';
      });
    }
  } else if (action.type === 'APPLY') {
    if (eventStatus(state, event, now) !== '모집 중') fail('현재 신청할 수 없는 행사입니다.');
    const applicant = action.applicant ?? SELF;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) fail('로그인 계정의 이메일을 확인한 뒤 다시 신청해 주세요.');
    if (
      state.registrations.some(
        (r) => r.eventId === event.id && r.memberId === SELF.memberId && r.status !== 'CANCELLED',
      )
    )
      fail('이미 신청한 행사입니다. 내 신청 내역을 확인해 주세요.');
    if (!channels(event).includes(action.channel) || seatInfo(state, event, action.channel).remaining === 0)
      fail('선택한 참여 방식의 정원이 찼습니다.');
    const answers = normalizeEventAnswers(event.questions, action.answers);
    for (const q of event.questions) {
      const answer = answers[q.id];
      const values = Array.isArray(answer) ? answer : answer ? [answer] : [];
      if (q.required && !values.some((x) => x.trim())) fail(`‘${q.label}’ 질문에 답변해 주세요.`);
      if (['RADIO', 'CHECKBOX', 'SELECT'].includes(q.type) && values.some((x) => !q.options.includes(x)))
        fail('신청 질문이 변경되었습니다. 내용을 확인해 주세요.');
      if (q.type !== 'CHECKBOX' && Array.isArray(answer)) fail('답변 형식을 확인해 주세요.');
    }
    const status = event.confirmation === 'AUTO' ? 'CONFIRMED' : 'PENDING';
    state.registrations.unshift({
      id: id(),
      eventId: event.id,
      ...applicant,
      channel: action.channel,
      status,
      answers,
      questions: structuredClone(event.questions),
      createdAt: new Date(now).toISOString(),
    });
    automaticMail(
      status === 'CONFIRMED' ? 'EVENT_REGISTRATION_CONFIRMED' : 'EVENT_REGISTRATION_PENDING',
      event,
      state.registrations[0]!,
    );
  } else if (action.type === 'MAIL' || action.type === 'CANCELLATION_MAIL') {
    const isCancellationMail = action.type === 'CANCELLATION_MAIL';
    if (!isCancellationMail && event.status === 'CANCELLED') fail('취소된 행사에는 안내 메일을 보낼 수 없습니다.');
    if (isCancellationMail && event.status !== 'CANCELLED') fail('취소된 행사에만 취소 안내 메일을 보낼 수 있습니다.');
    if (!action.notice.trim()) fail('안내 내용을 입력해 주세요.');
    const template =
      state.eventTemplates.find((item) => item.id === action.templateId) ?? fail('등록된 행사 안내 템플릿이 없습니다.');
    const templateError = validateEventTemplate(template);
    if (templateError) fail(templateError);
    const recipients = isCancellationMail
      ? state.registrations.filter((r) => r.eventId === event.id && event.cancellationRecipientIds?.includes(r.id))
      : state.registrations.filter(
          (r) =>
            r.eventId === event.id &&
            r.status === 'CONFIRMED' &&
            (action.channel === 'ALL' || r.channel === action.channel),
        );
    if (!recipients.length) fail(isCancellationMail ? '취소 안내 메일을 받을 신청자가 없습니다.' : '선택한 대상에 참가 확정자가 없습니다.');
    const mailTemplate = isCancellationMail ? cancellationEventTemplate(template) : template;
    state.mails.unshift(
      createEventNoticeMail(
        mailTemplate,
        event,
        recipients,
        action.notice,
        isCancellationMail ? 'CANCELLED_ACTIVE' : action.channel,
        id(),
        new Date(now).toISOString(),
        action.displayTimeZone,
      ),
    );
  }
  return state;
}
