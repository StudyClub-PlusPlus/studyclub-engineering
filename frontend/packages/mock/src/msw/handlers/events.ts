// 행사 운영 API 목 — specs/event · event-status · event-participant · event-mail 의 응답 모양.
// 판정(표시 상태 · can* · 잔여석)은 서버가 하는 일이라 목에서도 한 곳에서 계산해 응답에 싣는다.
// 메모리에만 남고 목 서버를 다시 띄우면 처음 상태로 돌아간다. 알림 템플릿·시간대 약어는 흉내 내지 않는다.
import { HttpResponse } from 'msw';

import { mockClient, type MockResolveContext } from '../utils';

type Channel = 'ONLINE' | 'OFFLINE';
type Stored = 'PUBLISHED' | 'CLOSED' | 'CANCELLED';
type RegStatus = 'PENDING' | 'CONFIRMED' | 'DECLINED' | 'CANCELLED';
type Question = { questionId: string; label: string; type: string; required: boolean; options: string[] };

type MockEvent = {
  eventId: number;
  version: number;
  title: string;
  summary: string;
  description: string;
  timeZone: string;
  startsAt: string;
  endsAt: string | null;
  deadlineAt: string;
  offline: { capacity: number; location: string } | null;
  online: { capacity: number; url: string | null } | null;
  confirmation: 'AUTO' | 'REVIEW';
  status: Stored;
  publishedAt: string;
  questions: Question[];
  createdAt: string;
  updatedAt: string;
};

type MockReg = {
  registrationId: number;
  eventId: number;
  nickname: string | null;
  email: string | null;
  channel: Channel;
  status: RegStatus;
  cancelReason?: string;
  createdAt: string;
  answers: Record<string, string[]>;
  questions: Question[];
};

type MockMail = {
  mailId: number;
  eventId: number;
  type: 'ANNOUNCEMENT' | 'CANCELLATION';
  subject: string;
  body: string;
  audience: string;
  recipients: string[];
  createdAt: string;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
const NOW0 = Date.now();

const QUESTIONS: Question[] = [
  { questionId: 'q_motive', label: '참여 동기', type: 'TEXTAREA', required: true, options: [] },
  { questionId: 'q_topic', label: '관심 주제', type: 'CHECKBOX', required: false, options: ['AI', '커리어', '네트워킹'] },
];

function seed() {
  const events: MockEvent[] = [
    {
      eventId: 3,
      version: 1,
      title: '연말 네트워킹 밋업',
      summary: '한 해를 마무리하며 크루끼리 만나요',
      description: '행사 소개, 참가 조건, 추가 절차를 적습니다.',
      timeZone: 'Asia/Seoul',
      startsAt: iso(NOW0 + 14 * DAY),
      endsAt: iso(NOW0 + 14 * DAY + 3 * HOUR),
      deadlineAt: iso(NOW0 + 12 * DAY),
      offline: { capacity: 40, location: '서울 강남구 ○○빌딩 5층' },
      online: { capacity: 100, url: 'https://meet.example.com/abc' },
      confirmation: 'REVIEW',
      status: 'PUBLISHED',
      publishedAt: iso(NOW0 - 3 * DAY),
      questions: QUESTIONS,
      createdAt: iso(NOW0 - 3 * DAY),
      updatedAt: iso(NOW0 - DAY),
    },
    {
      eventId: 2,
      version: 2,
      title: 'AI 논문 리딩 데이',
      summary: '논문 한 편을 같이 읽습니다',
      description: '준비물은 노트북입니다.',
      timeZone: 'Asia/Seoul',
      startsAt: iso(NOW0 + 6 * DAY),
      endsAt: null,
      deadlineAt: iso(NOW0 + 5 * DAY),
      offline: null,
      online: { capacity: 30, url: null },
      confirmation: 'AUTO',
      status: 'CLOSED',
      publishedAt: iso(NOW0 - 8 * DAY),
      questions: [],
      createdAt: iso(NOW0 - 8 * DAY),
      updatedAt: iso(NOW0 - 2 * DAY),
    },
    {
      eventId: 1,
      version: 3,
      title: '가을 시즌 킥오프',
      summary: '지난 행사',
      description: '종료된 행사입니다.',
      timeZone: 'Asia/Seoul',
      startsAt: iso(NOW0 - 20 * DAY),
      endsAt: iso(NOW0 - 20 * DAY + 2 * HOUR),
      deadlineAt: iso(NOW0 - 22 * DAY),
      offline: { capacity: 30, location: '서울 마포구' },
      online: null,
      confirmation: 'AUTO',
      status: 'PUBLISHED',
      publishedAt: iso(NOW0 - 40 * DAY),
      questions: [],
      createdAt: iso(NOW0 - 40 * DAY),
      updatedAt: iso(NOW0 - 30 * DAY),
    },
  ];
  const names: [string, string | null][] = [
    ['수현', 'suhyeon@example.com'],
    ['민지', 'minji@example.com'],
    ['도윤', 'doyoon@example.com'],
    ['서아', 'seoa@example.com'],
    ['하준', 'hajun@example.com'],
  ];
  const regs: MockReg[] = names.map(([nickname, email], i) => ({
    registrationId: 300 + i,
    eventId: 3,
    nickname,
    email,
    channel: i % 2 === 0 ? 'ONLINE' : 'OFFLINE',
    status: (['PENDING', 'CONFIRMED', 'CONFIRMED', 'PENDING', 'CANCELLED'] as RegStatus[])[i]!,
    cancelReason: i === 4 ? 'SELF_CANCELLED' : undefined,
    createdAt: iso(NOW0 - (5 - i) * HOUR * 7),
    answers: { q_motive: [`${nickname}의 참여 동기입니다.`], q_topic: i % 2 ? ['AI', '네트워킹'] : [] },
    questions: QUESTIONS,
  }));
  regs.push({
    registrationId: 299,
    eventId: 3,
    nickname: null,
    email: null,
    channel: 'OFFLINE',
    status: 'CANCELLED',
    cancelReason: 'ACCOUNT_DELETED',
    createdAt: iso(NOW0 - 2 * DAY),
    answers: {},
    questions: QUESTIONS,
  });
  const mails: MockMail[] = [
    {
      mailId: 1,
      eventId: 3,
      type: 'ANNOUNCEMENT',
      subject: '[StudyClub] 연말 네트워킹 밋업 안내',
      body: '안녕하세요, {{nickname}}님.\n\n행사장 5층 엘리베이터가 점검 중이라 계단을 이용해 주세요.',
      audience: 'OFFLINE',
      recipients: ['m***@example.com', 'h***@example.com'],
      createdAt: iso(NOW0 - 6 * HOUR),
    },
  ];
  return { events, regs, mails };
}

let db = seed();
let nextEventId = 4;
let nextMailId = 2;

export function resetMockEvents() {
  db = seed();
  nextEventId = 4;
  nextMailId = 2;
}

const mask = (email: string) => `${email[0]}***${email.slice(email.indexOf('@'))}`;
const occupies = (r: MockReg) => r.status === 'PENDING' || r.status === 'CONFIRMED';
const channelsOf = (e: MockEvent): Channel[] => [...(e.online ? (['ONLINE'] as const) : []), ...(e.offline ? (['OFFLINE'] as const) : [])];
const formatOf = (e: MockEvent) => (e.online && e.offline ? 'HYBRID' : e.online ? 'ONLINE' : 'OFFLINE');

function effectiveEndsAt(e: MockEvent): number {
  if (e.endsAt) return Date.parse(e.endsAt);
  // 행사 시간대의 시작일 다음 날 00:00. 목은 서울 기준 +9h 로 근사한다
  const startKst = Date.parse(e.startsAt) + 9 * HOUR;
  return Math.floor(startKst / DAY) * DAY + DAY - 9 * HOUR;
}

function seatsOf(e: MockEvent) {
  return channelsOf(e).map((channel) => {
    const capacity = (channel === 'ONLINE' ? e.online : e.offline)!.capacity;
    const rows = db.regs.filter((r) => r.eventId === e.eventId && r.channel === channel);
    const pending = rows.filter((r) => r.status === 'PENDING').length;
    const confirmed = rows.filter((r) => r.status === 'CONFIRMED').length;
    return { channel, capacity, pending, confirmed, remaining: Math.max(0, capacity - pending - confirmed) };
  });
}

function displayStatus(e: MockEvent, now = Date.now()) {
  if (e.status === 'CANCELLED') return 'CANCELLED';
  if (now >= effectiveEndsAt(e)) return 'ENDED';
  if (e.status === 'CLOSED' || now >= Date.parse(e.deadlineAt) || now >= Date.parse(e.startsAt)) return 'RECRUITMENT_CLOSED';
  if (seatsOf(e).every((s) => s.remaining === 0)) return 'FULL';
  return 'RECRUITING';
}

function recipientsOf(e: MockEvent, audience: string) {
  return db.regs.filter(
    (r) =>
      r.eventId === e.eventId &&
      r.email &&
      (audience === 'CANCELLED_ACTIVE'
        ? r.status === 'CANCELLED' && r.cancelReason === 'EVENT_CANCELLED'
        : r.status === 'CONFIRMED' && (audience === 'ALL' || r.channel === audience)),
  );
}

function detailOf(e: MockEvent) {
  const now = Date.now();
  const manageable = e.status !== 'CANCELLED' && now < effectiveEndsAt(e);
  const seats = seatsOf(e);
  const activeCount = db.regs.filter((r) => r.eventId === e.eventId && occupies(r) && r.email).length;
  const recipientCount =
    e.status === 'CANCELLED' ? recipientsOf(e, 'CANCELLED_ACTIVE').length : activeCount;
  const reopenBlockedReason =
    e.status === 'CLOSED' && manageable ? (now >= Date.parse(e.startsAt) ? 'STARTED' : now >= Date.parse(e.deadlineAt) ? 'DEADLINE_PASSED' : null) : null;
  return {
    eventId: e.eventId,
    version: e.version,
    title: e.title,
    summary: e.summary,
    description: e.description,
    timeZone: e.timeZone,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    effectiveEndsAt: iso(effectiveEndsAt(e)),
    deadlineAt: e.deadlineAt,
    format: formatOf(e),
    offline: e.offline,
    online: e.online,
    confirmation: e.confirmation,
    status: e.status,
    displayStatus: displayStatus(e, now),
    publishedAt: e.publishedAt,
    questions: e.questions,
    seats,
    canEdit: manageable,
    canChangeConfirmation: manageable && now < Date.parse(e.startsAt),
    canSetFutureStart: manageable && now < Date.parse(e.startsAt),
    removableChannels: channelsOf(e).filter((c) => seats.length > 1 && seats.find((s) => s.channel === c)!.pending + seats.find((s) => s.channel === c)!.confirmed === 0),
    canClose: e.status === 'PUBLISHED' && now < effectiveEndsAt(e),
    canReopen: e.status === 'CLOSED' && manageable && now < Date.parse(e.startsAt) && now < Date.parse(e.deadlineAt),
    reopenBlockedReason,
    canCancel: manageable,
    hasCancellationRecipients: recipientCount > 0,
    cancellationRecipientCount: recipientCount,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function regRow(r: MockReg, manageable: boolean) {
  return {
    registrationId: r.registrationId,
    accountId: 40 + (r.registrationId % 100),
    nickname: r.nickname,
    accountDeleted: r.email === null,
    maskedEmail: r.email ? mask(r.email) : null,
    channel: r.channel,
    status: r.status,
    createdAt: r.createdAt,
    canConfirm: manageable && r.status === 'PENDING',
    canDecline: manageable && r.status === 'PENDING',
    canCancel: manageable && occupies(r),
  };
}

const err = (status: number, errorCode: string, errorMessage: string) =>
  HttpResponse.json({ errorCode, errorMessage }, { status });
const notFound = () => err(404, 'NOT_FOUND', '행사를 찾을 수 없습니다.');
const find = (id: string | string[]) => db.events.find((e) => e.eventId === Number(id));
const pageOf = (request: Request, max: number) => {
  const url = new URL(request.url);
  return {
    offset: Math.max(0, Number(url.searchParams.get('offset') ?? 0)),
    limit: Math.min(max, Math.max(1, Number(url.searchParams.get('limit') ?? 20))),
  };
};

type Body = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function applyBody(e: MockEvent, body: Body) {
  e.title = body.title;
  e.summary = body.summary;
  e.description = body.description;
  e.timeZone = body.timeZone;
  e.startsAt = body.startsAt;
  e.endsAt = body.endsAt ?? null;
  e.deadlineAt = body.deadlineAt;
  e.offline = body.offline ?? null;
  e.online = body.online ?? null;
  e.confirmation = body.confirmation ?? 'AUTO';
  let n = 0;
  const existing = new Set(e.questions.map((q) => q.questionId));
  e.questions = ((body.questions ?? []) as Body[]).map((q) => ({
    questionId: q.questionId && existing.has(q.questionId) ? q.questionId : `q_${e.eventId}_${Date.now()}_${n++}`,
    label: q.label,
    type: q.type,
    required: q.required,
    options: q.options,
  }));
  e.updatedAt = new Date().toISOString();
}

const created = new Map<string, number>();

export const adminEventsHandlers = mockClient.createHandlerGroup('/api/admin/events', [
  {
    method: 'GET',
    path: '/',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ request }: MockResolveContext) => {
          const { offset, limit } = pageOf(request, 100);
          const sorted = [...db.events].sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt) || b.eventId - a.eventId);
          return {
            items: sorted.slice(offset, offset + limit).map((e) => ({
              eventId: e.eventId,
              title: e.title,
              startsAt: e.startsAt,
              endsAt: e.endsAt,
              effectiveEndsAt: iso(effectiveEndsAt(e)),
              timeZone: e.timeZone,
              status: e.status,
              displayStatus: displayStatus(e),
            })),
            total: sorted.length,
            offset,
            limit,
          };
        },
      },
      { label: '빈 목록', status: 200, response: { items: [], total: 0, offset: 0, limit: 20 } },
      { label: '서버 오류', status: 500, response: { errorCode: 'INTERNAL_ERROR', errorMessage: '서버 오류가 발생했습니다.' } },
    ],
  },
  {
    method: 'POST',
    path: '/',
    presets: [
      {
        label: '정상',
        status: 201,
        response: async ({ request }: MockResolveContext) => {
          const key = request.headers.get('Idempotency-Key') ?? '';
          const again = created.get(key);
          if (again) return HttpResponse.json(detailOf(find(String(again))!), { status: 201 });
          const body = (await request.json()) as Body;
          const now = new Date().toISOString();
          const e: MockEvent = { eventId: nextEventId++, version: 0, publishedAt: now, createdAt: now, updatedAt: now, status: 'PUBLISHED', questions: [], ...body } as unknown as MockEvent;
          applyBody(e, body);
          db.events.push(e);
          if (key) created.set(key, e.eventId);
          return HttpResponse.json(detailOf(e), { status: 201 });
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId',
    presets: [{ label: '정상', status: 200, response: ({ params }: MockResolveContext) => { const e = find(params.eventId!); return e ? detailOf(e) : notFound(); } }],
  },
  {
    method: 'PUT',
    path: '/:eventId',
    presets: [
      {
        label: '정상',
        status: 200,
        response: async ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          if (!e) return notFound();
          const body = (await request.json()) as Body;
          const d = detailOf(e);
          if (e.status === 'CANCELLED') return err(409, 'EVENT_CANCELLED', '취소된 행사는 수정할 수 없습니다.');
          if (!d.canEdit) return err(409, 'EVENT_ENDED', '종료된 행사는 수정할 수 없습니다.');
          if (body.version !== e.version) return err(409, 'EVENT_VERSION_CONFLICT', '다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었습니다.');
          if (body.confirmation !== e.confirmation && !d.canChangeConfirmation)
            return err(409, 'EVENT_ALREADY_STARTED', '행사가 시작된 뒤에는 확정 방식을 바꿀 수 없습니다.');
          if (e.confirmation === 'REVIEW' && body.confirmation === 'AUTO')
            db.regs.filter((r) => r.eventId === e.eventId && r.status === 'PENDING').forEach((r) => (r.status = 'CONFIRMED'));
          applyBody(e, body);
          e.version += 1;
          return detailOf(e);
        },
      },
    ],
  },
  {
    method: 'PATCH',
    path: '/:eventId/status',
    presets: [
      {
        label: '정상',
        status: 200,
        response: async ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          if (!e) return notFound();
          const { status, version } = (await request.json()) as Body;
          if (e.status === 'CANCELLED') return err(409, 'EVENT_CANCELLED', '취소된 행사는 모집 상태를 변경할 수 없습니다.');
          if (Date.now() >= effectiveEndsAt(e)) return err(409, 'EVENT_ENDED', '종료된 행사는 모집 상태를 변경할 수 없습니다.');
          if (status === e.status) return detailOf(e);
          if (version !== e.version) return err(409, 'EVENT_VERSION_CONFLICT', '다른 캡틴이 먼저 저장했거나 행사 상태가 바뀌었습니다.');
          if (status === 'PUBLISHED') {
            if (Date.now() >= Date.parse(e.startsAt)) return err(409, 'EVENT_ALREADY_STARTED', '이미 시작한 행사에는 새 신청을 받을 수 없어요.');
            if (Date.now() >= Date.parse(e.deadlineAt)) return err(409, 'EVENT_REOPEN_DEADLINE_PASSED', '신청 마감 시간이 지나 모집을 다시 열 수 없습니다.');
          }
          if (status === 'CANCELLED')
            db.regs.filter((r) => r.eventId === e.eventId && occupies(r)).forEach((r) => ((r.status = 'CANCELLED'), (r.cancelReason = 'EVENT_CANCELLED')));
          e.status = status;
          e.version += 1;
          return detailOf(e);
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId/registrations',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          if (!e) return notFound();
          const { offset, limit } = pageOf(request, 100);
          const manageable = detailOf(e).canEdit;
          const rows = db.regs.filter((r) => r.eventId === e.eventId).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
          return {
            canManageRegistrations: manageable,
            pendingCount: rows.filter((r) => r.status === 'PENDING').length,
            items: rows.slice(offset, offset + limit).map((r) => regRow(r, manageable)),
            total: rows.length,
            offset,
            limit,
          };
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId/registrations/:registrationId',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const r = db.regs.find((x) => x.eventId === Number(params.eventId) && x.registrationId === Number(params.registrationId));
          if (!r) return notFound();
          return {
            registrationId: r.registrationId,
            nickname: r.nickname,
            accountDeleted: r.email === null,
            channel: r.channel,
            status: r.status,
            createdAt: r.createdAt,
            questions: r.questions.map((q) => ({ ...q, answer: r.answers[q.questionId] ?? [] })),
          };
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/:eventId/registrations/:registrationId/email-reveals',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const r = db.regs.find((x) => x.eventId === Number(params.eventId) && x.registrationId === Number(params.registrationId));
          if (!r?.email) return notFound();
          return { registrationId: r.registrationId, accountId: 40 + (r.registrationId % 100), email: r.email };
        },
      },
    ],
  },
  {
    method: 'PATCH',
    path: '/:eventId/registrations/:registrationId',
    presets: [
      {
        label: '정상',
        status: 200,
        response: async ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          const r = db.regs.find((x) => x.eventId === Number(params.eventId) && x.registrationId === Number(params.registrationId));
          if (!e || !r) return notFound();
          const { status } = (await request.json()) as Body;
          const manageable = detailOf(e).canEdit;
          if (e.status === 'CANCELLED') return err(409, 'EVENT_CANCELLED', '취소된 행사의 신청은 처리할 수 없습니다.');
          if (!manageable) return err(409, 'EVENT_ENDED', '종료된 행사의 신청은 처리할 수 없습니다.');
          const allowed = status === 'CANCELLED' ? occupies(r) : r.status === 'PENDING';
          if (!allowed) return err(409, 'EVENT_REGISTRATION_STATUS_NOT_ALLOWED', '현재 신청 상태에서는 처리할 수 없습니다.');
          r.status = status;
          if (status === 'CANCELLED') r.cancelReason = 'ADMIN_CANCELLED';
          return regRow(r, manageable);
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/:eventId/mails/preview',
    presets: [
      {
        label: '정상',
        status: 200,
        response: async ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          if (!e) return notFound();
          const { type, audience, notice } = (await request.json()) as Body;
          const count = recipientsOf(e, audience).length;
          const cancellation = type === 'CANCELLATION';
          let blockedReason: string | null = null;
          if (!cancellation && e.status === 'CANCELLED') blockedReason = 'EVENT_CANCELLED';
          else if (cancellation && e.status !== 'CANCELLED') blockedReason = 'EVENT_NOT_CANCELLED';
          else if (count === 0) blockedReason = 'NO_RECIPIENTS';
          else if (!String(notice ?? '').trim()) blockedReason = 'NOTICE_REQUIRED';
          return {
            type,
            audience,
            templateId: 1,
            templateExists: true,
            subject: cancellation ? `[StudyClub] ${e.title} 취소 안내` : `[StudyClub] ${e.title} 안내`,
            body: `안녕하세요, {{nickname}}님.\n\n${e.title}\n\n${String(notice ?? '').trim()}`,
            format: 'TEXT',
            displayTimeZone: 'Asia/Seoul',
            recipientCount: count,
            canSend: blockedReason === null,
            blockedReason,
          };
        },
      },
    ],
  },
  {
    method: 'POST',
    path: '/:eventId/mails',
    presets: [
      {
        label: '정상',
        status: 201,
        response: async ({ request, params }: MockResolveContext) => {
          const e = find(params.eventId!);
          if (!e) return notFound();
          const body = (await request.json()) as Body;
          const targets = recipientsOf(e, body.audience);
          if (targets.length === 0) return err(409, 'EVENT_MAIL_NO_RECIPIENTS', '메일을 받을 사람이 없습니다.');
          const mail: MockMail = {
            mailId: nextMailId++,
            eventId: e.eventId,
            type: body.type,
            subject: body.type === 'CANCELLATION' ? `[StudyClub] ${e.title} 취소 안내` : `[StudyClub] ${e.title} 안내`,
            body: `안녕하세요, {{nickname}}님.\n\n${e.title}\n\n${String(body.notice).trim()}`,
            audience: body.audience,
            recipients: targets.map((r) => mask(r.email!)),
            createdAt: new Date().toISOString(),
          };
          db.mails.push(mail);
          return HttpResponse.json(mailDetail(mail), { status: 201 });
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId/mails',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ request, params }: MockResolveContext) => {
          const { offset, limit } = pageOf(request, 50);
          const rows = db.mails.filter((m) => m.eventId === Number(params.eventId)).sort((a, b) => b.mailId - a.mailId);
          return {
            items: rows.slice(offset, offset + limit).map((m) => ({ mailId: m.mailId, subject: m.subject, audience: m.audience, recipientCount: m.recipients.length, createdAt: m.createdAt })),
            total: rows.length,
            offset,
            limit,
          };
        },
      },
    ],
  },
  {
    method: 'GET',
    path: '/:eventId/mails/:mailId',
    presets: [
      {
        label: '정상',
        status: 200,
        response: ({ params }: MockResolveContext) => {
          const m = db.mails.find((x) => x.eventId === Number(params.eventId) && x.mailId === Number(params.mailId));
          return m ? mailDetail(m) : notFound();
        },
      },
    ],
  },
]);

function mailDetail(m: MockMail) {
  return {
    mailId: m.mailId,
    type: m.type,
    subject: m.subject,
    body: m.body,
    format: 'TEXT',
    audience: m.audience,
    recipientCount: m.recipients.length,
    maskedRecipients: m.recipients,
    createdAt: m.createdAt,
  };
}
