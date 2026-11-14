import type { EventChannel, EventPreviewState, EventRegistration, PreviewEvent } from '@studyclub/types';

export const SELF = { memberId: 'preview-self', name: '나 (예시 크루)', email: 'me@example.test' };
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

export function formatDate(iso: string, zone: string, locale = 'ko-KR') {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(new Date(iso));
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
  if (Date.parse(event.endsAt) <= now) return '종료';
  if (
    event.status === 'CLOSED' ||
    Date.parse(event.deadlineAt) <= now ||
    channels(event).every((channel) => seatInfo(state, event, channel).remaining === 0)
  )
    return '모집 마감';
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
  if (![event.startsAt, event.endsAt, event.deadlineAt].every((x) => Number.isFinite(Date.parse(x))))
    return '일정을 모두 입력해 주세요.';
  if (Date.parse(event.endsAt) <= Date.parse(event.startsAt)) return '종료시간은 시작시간보다 늦어야 합니다.';
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
  if (previous && previous.status !== 'DRAFT' && JSON.stringify(previous.questions) !== JSON.stringify(event.questions))
    return '질문은 공개 전인 행사에서만 수정할 수 있습니다.';
  if (previous && state.registrations.some((r) => r.eventId === event.id)) {
    if (
      previous.confirmation !== event.confirmation ||
      previous.format !== event.format ||
      JSON.stringify(previous.questions) !== JSON.stringify(event.questions)
    )
      return '신청 이력이 있어 참여 방식, 확정 방식, 신청 질문을 변경할 수 없습니다.';
  }
  return null;
}

export type EventAction =
  | { type: 'SAVE'; event: PreviewEvent }
  | { type: 'STATUS'; eventId: string; status: PreviewEvent['status'] }
  | { type: 'APPLY'; eventId: string; channel: EventChannel; answers: EventRegistration['answers'] }
  | { type: 'DECIDE'; registrationId: string; status: 'CONFIRMED' | 'DECLINED' }
  | { type: 'CANCEL'; registrationId: string }
  | { type: 'ADMIN_CANCEL'; registrationId: string }
  | { type: 'MAIL'; eventId: string; channel: EventChannel | 'ALL'; subject: string; body: string };

/** 플레이그라운드의 단일 판정 지점. 실제 연동에서는 동일한 판정을 서버가 반환해야 한다. */
export function transition(current: EventPreviewState, action: EventAction, now = Date.now()): EventPreviewState {
  const state: EventPreviewState = structuredClone(current);
  const id = () => crypto.randomUUID();
  const mail = (event: PreviewEvent, recipients: string[], subject: string, body: string) => {
    if (recipients.length)
      state.mails.unshift({
        id: id(),
        eventId: event.id,
        recipients,
        subject: `[StudyClub] ${subject}`,
        body,
        createdAt: new Date(now).toISOString(),
      });
  };
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (action.type === 'SAVE') {
    const error = validateEvent(action.event, state, now);
    if (error) fail(error);
    const index = state.events.findIndex((e) => e.id === action.event.id);
    if (index < 0) state.events.unshift(action.event);
    else state.events[index] = action.event;
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
      mail(event, [registration.email], `${event.title} 신청 취소`, '신청이 취소되었습니다.');
    } else {
      if (registration.status !== 'PENDING' || event.status === 'CANCELLED' || Date.parse(event.startsAt) <= now)
        fail('현재 상태에서는 처리할 수 없습니다.');
      registration.status = action.status;
      mail(
        event,
        [registration.email],
        `${event.title} ${REGISTRATION_LABEL[action.status]}`,
        action.status === 'CONFIRMED'
          ? `참가가 확정되었습니다.\n${formatDate(event.startsAt, event.timeZone)}\n참여 방식: ${CHANNEL_LABEL[registration.channel]}\n내 신청 내역에서 참여 안내를 확인해 주세요.`
          : '운영진 확인 결과 이번 행사에 참가하기 어렵습니다. 자세한 내용은 운영진에게 문의해 주세요.',
      );
    }
    return state;
  }
  const event = state.events.find((e) => e.id === action.eventId) ?? fail('행사를 찾을 수 없습니다.');
  if (action.type === 'STATUS') {
    if (event.status === 'CANCELLED') fail('취소된 행사는 다시 공개할 수 없습니다.');
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
      mail(
        event,
        active.map((r) => r.email),
        `${event.title} 행사 취소 안내`,
        '행사가 취소되어 신청도 함께 취소되었습니다. 자세한 내용은 운영진에게 문의해 주세요.',
      );
      active.forEach((r) => {
        r.status = 'CANCELLED';
      });
    }
  } else if (action.type === 'APPLY') {
    if (eventStatus(state, event, now) !== '모집 중') fail('현재 신청할 수 없는 행사입니다.');
    if (
      state.registrations.some(
        (r) => r.eventId === event.id && r.memberId === SELF.memberId && r.status !== 'CANCELLED',
      )
    )
      fail('이미 신청한 행사입니다. 내 신청 내역을 확인해 주세요.');
    if (!channels(event).includes(action.channel) || seatInfo(state, event, action.channel).remaining === 0)
      fail('선택한 참여 방식의 정원이 찼습니다.');
    for (const q of event.questions) {
      const answer = action.answers[q.id];
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
      ...SELF,
      channel: action.channel,
      status,
      answers: action.answers,
      questions: structuredClone(event.questions),
      createdAt: new Date(now).toISOString(),
    });
    mail(
      event,
      [SELF.email],
      `${event.title} ${status === 'CONFIRMED' ? '참가 확정' : '신청 접수'}`,
      status === 'CONFIRMED'
        ? '참가가 확정되었습니다. 내 신청 내역에서 일정과 참여 안내를 확인해 주세요.'
        : '신청이 접수되었습니다. 현재 운영진 확인 대기 중이며, 참가 확정 시 다시 안내드립니다.',
    );
  } else if (action.type === 'MAIL') {
    if (!action.subject.trim() || !action.body.trim()) fail('메일 제목과 내용을 입력해 주세요.');
    const recipients = state.registrations
      .filter(
        (r) =>
          r.eventId === event.id &&
          r.status === 'CONFIRMED' &&
          (action.channel === 'ALL' || r.channel === action.channel),
      )
      .map((r) => r.email);
    if (!recipients.length) fail('선택한 대상에 참가 확정자가 없습니다.');
    mail(event, recipients, action.subject.trim(), action.body.trim());
  }
  return state;
}
