type RegistrationStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
type Channel = 'ONLINE' | 'OFFLINE';

type ListItem = {
  eventId: number;
  title: string;
  summary: string;
  startsAt: string;
  endsAt: string | null;
  effectiveEndsAt: string;
  timeZone: string;
  format: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  displayStatus: string;
  listGroup: 'UPCOMING' | 'PAST';
  myRegistration: { status: RegistrationStatus; channel: Channel } | null;
};

type Detail = ListItem & {
  description: string;
  deadlineAt: string;
  offline: { location: string } | null;
  online: Record<string, never> | null;
  confirmation: 'AUTO' | 'REVIEW';
  seats: Array<{ channel: Channel; capacity: number; remaining: number }>;
  questions: Array<{
    questionId: string;
    label: string;
    type: 'TEXT' | 'TEXTAREA' | 'RADIO' | 'CHECKBOX';
    required: boolean;
    options: string[];
  }>;
  questionVersion: string;
  canApply: boolean;
  applyBlockedReason: string | null;
  myRegistration: {
    registrationId: number;
    status: RegistrationStatus;
    channel: Channel;
    createdAt: string;
    canCancel: boolean;
    cancelBlockedReason: string | null;
    onlineLinkVisible: boolean;
    onlineUrl: string | null;
  } | null;
};

const upcomingBase: Detail = {
  eventId: 1001,
  title: '연말 네트워킹 밋업',
  summary: '한 해를 마무리하며 크루끼리 만나요',
  description: '행사 소개와 참가 조건을 확인해 주세요.\n\n함께 이야기하며 네트워킹해요.',
  timeZone: 'Asia/Seoul',
  startsAt: '2026-12-05T10:00:00Z',
  endsAt: '2026-12-05T13:00:00Z',
  effectiveEndsAt: '2026-12-05T13:00:00Z',
  deadlineAt: '2026-12-03T14:59:00Z',
  format: 'HYBRID',
  offline: { location: '서울 강남구 ○○빌딩 5층' },
  online: {},
  confirmation: 'REVIEW',
  displayStatus: 'RECRUITING',
  listGroup: 'UPCOMING',
  seats: [
    { channel: 'ONLINE', capacity: 100, remaining: 56 },
    { channel: 'OFFLINE', capacity: 40, remaining: 12 },
  ],
  questions: [
    { questionId: 'q_motivation', label: '참여 동기', type: 'TEXTAREA', required: true, options: [] },
    { questionId: 'q_topic', label: '관심 주제', type: 'CHECKBOX', required: false, options: ['AI', '커리어', '네트워킹'] },
  ],
  questionVersion: 'mock-question-v1',
  canApply: true,
  applyBlockedReason: null,
  myRegistration: null,
};

const past: ListItem = {
  eventId: 1000,
  title: '가을 오프라인 모각코',
  summary: '토요일 오후, 같이 코딩해요',
  startsAt: '2026-10-11T05:00:00Z',
  endsAt: null,
  effectiveEndsAt: '2026-10-11T15:00:00Z',
  timeZone: 'Asia/Seoul',
  format: 'OFFLINE',
  displayStatus: 'ENDED',
  listGroup: 'PAST',
  myRegistration: null,
};

let detailState: Detail = structuredClone(upcomingBase);
const registrations = new Map<number, { channel: Channel; answers: Record<string, string[]> }>();

export function mockEventList(): ListItem[] {
  const upcomingItem: ListItem = {
    eventId: detailState.eventId,
    title: detailState.title,
    summary: detailState.summary,
    startsAt: detailState.startsAt,
    endsAt: detailState.endsAt,
    effectiveEndsAt: detailState.effectiveEndsAt,
    timeZone: detailState.timeZone,
    format: detailState.format,
    displayStatus: detailState.displayStatus,
    listGroup: 'UPCOMING',
    myRegistration: detailState.myRegistration
      ? { status: detailState.myRegistration.status, channel: detailState.myRegistration.channel }
      : null,
  };
  return [upcomingItem, past];
}

export function mockEventDetail(eventId: number): Detail | null {
  if (eventId === detailState.eventId) return structuredClone(detailState);
  if (eventId === past.eventId) {
    return {
      eventId: past.eventId,
      title: past.title,
      summary: past.summary,
      description: '종료된 행사 예시입니다.',
      timeZone: past.timeZone,
      startsAt: past.startsAt,
      endsAt: past.endsAt,
      effectiveEndsAt: past.effectiveEndsAt,
      deadlineAt: past.startsAt,
      format: past.format,
      offline: { location: '서울' },
      online: null,
      confirmation: 'AUTO',
      displayStatus: past.displayStatus,
      listGroup: past.listGroup,
      seats: [{ channel: 'OFFLINE', capacity: 30, remaining: 0 }],
      questions: [],
      questionVersion: 'mock-ended',
      canApply: false,
      applyBlockedReason: 'EVENT_ENDED',
      myRegistration: null,
    };
  }
  return null;
}

export function mockSubmitRegistration(eventId: number, channel: Channel, answers: Record<string, string[]>) {
  if (eventId !== detailState.eventId) return null;
  const registrationId = 9001;
  registrations.set(registrationId, { channel, answers });
  detailState = {
    ...detailState,
    canApply: false,
    applyBlockedReason: 'ALREADY_REGISTERED',
    myRegistration: {
      registrationId,
      status: detailState.confirmation === 'AUTO' ? 'CONFIRMED' : 'PENDING',
      channel,
      createdAt: new Date().toISOString(),
      canCancel: true,
      cancelBlockedReason: null,
      onlineLinkVisible: channel === 'ONLINE' && detailState.confirmation === 'AUTO',
      onlineUrl: channel === 'ONLINE' ? 'https://meet.example.com/mock' : null,
    },
  };
  return registrationId;
}

export function mockCancelRegistration(registrationId: number) {
  if (detailState.myRegistration?.registrationId !== registrationId) return false;
  detailState = {
    ...detailState,
    canApply: true,
    applyBlockedReason: null,
    myRegistration: {
      ...detailState.myRegistration!,
      status: 'CANCELLED',
      canCancel: false,
      cancelBlockedReason: 'NOT_ACTIVE',
      onlineLinkVisible: false,
      onlineUrl: null,
    },
  };
  return true;
}

export function mockMyEvents() {
  if (!detailState.myRegistration || detailState.myRegistration.status === 'CANCELLED') return [];
  return [
    {
      eventId: detailState.eventId,
      title: detailState.title,
      startsAt: detailState.startsAt,
      timeZone: detailState.timeZone,
      registration: {
        registrationId: detailState.myRegistration.registrationId,
        status: detailState.myRegistration.status,
        channel: detailState.myRegistration.channel,
        createdAt: detailState.myRegistration.createdAt,
      },
    },
  ];
}

export function mockRegistrationMe(eventId: number, registrationId: number) {
  if (eventId !== detailState.eventId || detailState.myRegistration?.registrationId !== registrationId) return null;
  const saved = registrations.get(registrationId);
  return {
    registrationId,
    eventId,
    status: detailState.myRegistration.status,
    channel: detailState.myRegistration.channel,
    createdAt: detailState.myRegistration.createdAt,
    canCancel: detailState.myRegistration.canCancel,
    cancelBlockedReason: detailState.myRegistration.cancelBlockedReason,
    questions: detailState.questions.map((q) => ({
      ...q,
      answer: saved?.answers[q.questionId] ?? [],
    })),
  };
}