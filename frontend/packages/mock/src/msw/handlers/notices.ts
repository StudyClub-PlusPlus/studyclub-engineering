// 스터디 공지 보내기 API 목 — specs/study-notice/spec.md 의 응답 모양 그대로.
//
// 서버가 하는 판정(받는 사람 후보 · 디스코드 가능 여부 · 1분 간격/하루 30회 한도 · 429)을 목에서도 같은 순서로 흉내 낸다.
// 프로토로는 못 보는 상태(건너뜀 · 한도 · 서버 오류)는 MSW 데브툴의 프리셋으로 바꿔 본다.
// 메일 결과는 보낸 지 몇 초가 지나면 「대기」에서 「완료」로 넘어간다 — 서버 폴러의 흉내다.
// 이메일은 내려주지 않는다. 사람 이름은 목 크루 명단(getStudyCrew)에서 온다.
import { HttpResponse } from 'msw';

import { studies } from '../../data';
import { getStudyCrew } from '../../data/crew';
import { currentUserName, mockClient, type MockResolveContext } from '../utils';
import { MOCK_DISCORD_LINKED_KEY } from './discord';

export type ApiDiscordSkipReason = 'BOT_NOT_CONFIGURED' | 'NO_DISCORD_CHANNEL' | 'SENDER_NOT_LINKED' | 'NO_TEXT_CHANNEL';
export type ApiDiscordStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';
export type ApiBlockedReason = 'STUDY_ENDED' | 'COOLDOWN' | 'DAILY_LIMIT';

export type ApiNoticeRecipient = {
  participantId: number;
  displayName: string;
  participantRole: 'MEMBER' | 'LEADER';
  participantStatus: 'ACTIVE' | 'PAUSED';
  discordLinked: boolean;
};

export type ApiNoticeCompose = {
  recipients: ApiNoticeRecipient[];
  discord: { available: boolean; unavailableReason: ApiDiscordSkipReason | null };
  canSend: boolean;
  blockedReason: ApiBlockedReason | null;
  nextAvailableAt: string | null;
  remainingToday: number;
};

export type ApiNoticeItem = {
  noticeId: number;
  title: string;
  body: string;
  senderName: string;
  sentAt: string;
  recipientCount: number;
  email: { requested: boolean; pending: number; sent: number; failed: number };
  discord: {
    requested: boolean;
    status: ApiDiscordStatus;
    skipReason: ApiDiscordSkipReason | null;
    mentionedCount: number;
  };
};

export type ApiNoticeList = { items: ApiNoticeItem[]; total: number; offset: number; limit: number };

const COOLDOWN_MS = 60_000;
const DAILY_MAX = 30;
const TITLE_MAX = 60;
const BODY_MAX = 1500;
const MAX_LIMIT = 50;
/** 메일이 「대기」에서 「완료」로 넘어가기까지 — 서버 폴러(30초)의 흉내. */
const MAIL_SETTLE_MS = 8_000;

/** 목 반 ID = study_id + 1000 (meetings 핸들러와 같다). */
const GROUP_ID_OFFSET = 1000;

type StoredNotice = ApiNoticeItem & { mailFailed: number };

/** 반마다 보낸 공지. 목 서버를 다시 띄우기 전까지 남는다. */
const sentByGroup = new Map<string, StoredNotice[]>();

const key = (studyId: string, groupId: string) => `${studyId}:${groupId}`;

const invalidInput = () =>
  HttpResponse.json({ errorCode: 'INVALID_INPUT', errorMessage: '입력값이 올바르지 않습니다.' }, { status: 400 });
const forbidden = () =>
  HttpResponse.json({ errorCode: 'FORBIDDEN', errorMessage: '이 반에 공지를 보낼 권한이 없습니다.' }, { status: 403 });
const serverError = () =>
  HttpResponse.json({ errorCode: 'INTERNAL_ERROR', errorMessage: '서버 오류가 발생했습니다.' }, { status: 500 });

function discordLinkedForMe(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    // 데브툴 「디스코드 연동됨/미연동」과 신청 흐름이 쓰는 같은 키 — 연동 상태를 한 곳에서 바꾼다
    return window.localStorage.getItem(MOCK_DISCORD_LINKED_KEY) === 'true';
  } catch {
    return false;
  }
}

/** 이 반의 명단: 나(네비게이터) + 목 크루. 쉬는 중 한 명, 디스코드 별명이 있는 사람이 연동한 사람. */
function roster(studyId: string, request: Request): ApiNoticeRecipient[] {
  const study = studies.find((s) => String(s.study_id) === studyId);
  const crew = study ? getStudyCrew(study).crew.slice(0, 14) : [];
  const people: ApiNoticeRecipient[] = [
    {
      participantId: 1,
      displayName: currentUserName(request),
      participantRole: 'LEADER',
      participantStatus: 'ACTIVE',
      discordLinked: discordLinkedForMe(),
    },
    ...crew.map<ApiNoticeRecipient>((c, i) => ({
      participantId: 100 + i,
      displayName: c.name,
      participantRole: 'MEMBER',
      participantStatus: i === 6 ? 'PAUSED' : 'ACTIVE',
      discordLinked: Boolean(c.discordNickname),
    })),
  ];
  return people.sort(
    (a, b) =>
      Number(a.participantStatus !== 'ACTIVE') - Number(b.participantStatus !== 'ACTIVE') ||
      a.displayName.localeCompare(b.displayName, 'ko'),
  );
}

/** KST 날짜(yyyy-MM-dd) — 하루 한도는 한국 시간 0시에 풀린다. */
const kstDay = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);

function limitState(sent: StoredNotice[], now = Date.now()) {
  const last = sent.reduce((m, n) => Math.max(m, Date.parse(n.sentAt)), 0);
  const today = sent.filter((n) => kstDay(Date.parse(n.sentAt)) === kstDay(now)).length;
  if (last && now - last < COOLDOWN_MS) {
    return { reason: 'COOLDOWN' as const, next: new Date(last + COOLDOWN_MS).toISOString(), today };
  }
  if (today >= DAILY_MAX) return { reason: 'DAILY_LIMIT' as const, next: null, today };
  return { reason: null, next: null, today };
}

function compose(overrides: Partial<ApiNoticeCompose> = {}) {
  return ({ request, params }: MockResolveContext): ApiNoticeCompose => {
    const sent = sentByGroup.get(key(String(params.studyId), String(params.groupId))) ?? [];
    const state = limitState(sent);
    const recipients = roster(String(params.studyId), request);
    const meLinked = recipients.find((r) => r.participantId === 1)?.discordLinked ?? false;
    return {
      recipients,
      discord: { available: meLinked, unavailableReason: meLinked ? null : 'SENDER_NOT_LINKED' },
      canSend: state.reason === null,
      blockedReason: state.reason,
      nextAvailableAt: state.next,
      remainingToday: Math.max(0, DAILY_MAX - state.today),
      ...overrides,
    };
  };
}

async function send({ request, params }: MockResolveContext) {
  const k = key(String(params.studyId), String(params.groupId));
  const sent = sentByGroup.get(k) ?? [];
  const body = (await request.json().catch(() => null)) as {
    title?: string;
    body?: string;
    channels?: string[];
    participantIds?: number[];
  } | null;
  const title = body?.title?.trim() ?? '';
  const text = body?.body?.trim() ?? '';
  const channels = body?.channels ?? [];
  const ids = body?.participantIds ?? [];
  const valid =
    title.length > 0 &&
    title.length <= TITLE_MAX &&
    text.length > 0 &&
    text.length <= BODY_MAX &&
    channels.length > 0 &&
    channels.every((c) => c === 'EMAIL' || c === 'DISCORD') &&
    new Set(channels).size === channels.length &&
    ids.length > 0 &&
    new Set(ids).size === ids.length;
  if (!valid) return invalidInput();

  const state = limitState(sent);
  if (state.reason) {
    return HttpResponse.json(
      {
        errorCode: 'STUDY_NOTICE_RATE_LIMITED',
        errorMessage:
          state.reason === 'COOLDOWN'
            ? '방금 공지를 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.'
            : `오늘 보낼 수 있는 공지 횟수(${DAILY_MAX}회)를 모두 썼습니다. 내일 다시 보낼 수 있습니다.`,
      },
      { status: 429 },
    );
  }

  const people = roster(String(params.studyId), request);
  const chosen = people.filter((p) => ids.includes(p.participantId));
  if (chosen.length !== ids.length) return invalidInput();

  const meLinked = people.find((p) => p.participantId === 1)?.discordLinked ?? false;
  const wantsDiscord = channels.includes('DISCORD');
  const wantsEmail = channels.includes('EMAIL');
  const noticeId = Date.now();
  const item: StoredNotice = {
    noticeId,
    title,
    body: text,
    senderName: currentUserName(request),
    sentAt: new Date().toISOString(),
    recipientCount: chosen.length,
    email: { requested: wantsEmail, pending: wantsEmail ? chosen.length : 0, sent: 0, failed: 0 },
    discord: {
      requested: wantsDiscord,
      status: !wantsDiscord ? 'NOT_REQUESTED' : meLinked ? 'SENT' : 'SKIPPED',
      skipReason: wantsDiscord && !meLinked ? 'SENDER_NOT_LINKED' : null,
      mentionedCount: wantsDiscord && meLinked ? chosen.filter((p) => p.discordLinked).length : 0,
    },
    mailFailed: 0,
  };
  sentByGroup.set(k, [item, ...sent]);
  return HttpResponse.json({ noticeId, recipientCount: chosen.length }, { status: 201 });
}

/** 보낸 지 충분히 지난 메일은 완료로 본다. */
function settled(n: StoredNotice, now = Date.now()): ApiNoticeItem {
  const { mailFailed: _failed, ...item } = n;
  if (!n.email.requested || now - Date.parse(n.sentAt) < MAIL_SETTLE_MS) return item;
  return { ...item, email: { ...n.email, pending: 0, sent: n.recipientCount - n.mailFailed, failed: n.mailFailed } };
}

/** 처음 열어도 기록이 보이도록 깔아 두는 두 건: 메일 일부 실패 + 디스코드 완료 / 디스코드 건너뜀. */
function seed(): StoredNotice[] {
  const day = 86_400_000;
  const now = Date.now();
  return [
    {
      noticeId: 2,
      title: '이번 주 모임은 온라인으로 합니다',
      body: '장소 사정으로 이번 주만 온라인으로 진행합니다.\n링크는 디스코드 로비 채널에 올려 둘게요.',
      senderName: '네비게이터',
      sentAt: new Date(now - 2 * day).toISOString(),
      recipientCount: 10,
      email: { requested: true, pending: 0, sent: 9, failed: 1 },
      discord: { requested: true, status: 'SENT', skipReason: null, mentionedCount: 7 },
      mailFailed: 1,
    },
    {
      noticeId: 1,
      title: '킥오프 안내',
      body: '킥오프는 다음 주 수요일 20:30 입니다.',
      senderName: '네비게이터',
      sentAt: new Date(now - 9 * day).toISOString(),
      recipientCount: 12,
      email: { requested: true, pending: 0, sent: 12, failed: 0 },
      discord: { requested: true, status: 'SKIPPED', skipReason: 'SENDER_NOT_LINKED', mentionedCount: 0 },
      mailFailed: 0,
    },
  ];
}

function list({ request, params }: MockResolveContext): ApiNoticeList {
  const k = key(String(params.studyId), String(params.groupId));
  if (!sentByGroup.has(k)) sentByGroup.set(k, seed());
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
  const all = sentByGroup.get(k)!.map((n) => settled(n));
  return { items: all.slice(offset, offset + limit), total: all.length, offset, limit };
}

/** 테스트·스토리에서 처음 상태로 되돌린다. */
export function resetMockNotices() {
  sentByGroup.clear();
}

export const studyNoticesHandlers = mockClient.createHandlerGroup('/api/studies', [
  {
    method: 'GET',
    path: '/:studyId/groups/:groupId/notices/compose',
    presets: [
      { label: '정상', status: 200, response: compose() },
      {
        label: '디스코드 미연동 (보내는 사람)',
        status: 200,
        response: (ctx: MockResolveContext) => ({
          ...compose()(ctx),
          discord: { available: false, unavailableReason: 'SENDER_NOT_LINKED' as const },
        }),
      },
      {
        label: '디스코드 봇 미연결',
        status: 200,
        response: (ctx: MockResolveContext) => ({
          ...compose()(ctx),
          discord: { available: false, unavailableReason: 'BOT_NOT_CONFIGURED' as const },
        }),
      },
      {
        label: '스터디 디스코드 채널 없음',
        status: 200,
        response: (ctx: MockResolveContext) => ({
          ...compose()(ctx),
          discord: { available: false, unavailableReason: 'NO_DISCORD_CHANNEL' as const },
        }),
      },
      {
        label: '1분 안 재발송 (COOLDOWN)',
        status: 200,
        response: (ctx: MockResolveContext) =>
          compose({
            canSend: false,
            blockedReason: 'COOLDOWN',
            nextAvailableAt: new Date(Date.now() + 45_000).toISOString(),
            remainingToday: 24,
          })(ctx),
      },
      {
        label: '하루 한도 (DAILY_LIMIT)',
        status: 200,
        response: (ctx: MockResolveContext) =>
          compose({ canSend: false, blockedReason: 'DAILY_LIMIT', nextAvailableAt: null, remainingToday: 0 })(ctx),
      },
      {
        label: '끝난 스터디 (STUDY_ENDED)',
        status: 200,
        response: (ctx: MockResolveContext) =>
          compose({ canSend: false, blockedReason: 'STUDY_ENDED', nextAvailableAt: null })(ctx),
      },
      {
        label: '받는 사람 없음 (명단 비어 있음)',
        status: 200,
        response: (ctx: MockResolveContext) => ({ ...compose()(ctx), recipients: [] }),
      },
      { label: '403 권한 없음', status: 403, response: forbidden },
      { label: '500 서버 오류', status: 500, response: serverError },
    ],
  },
  {
    method: 'POST',
    path: '/:studyId/groups/:groupId/notices',
    presets: [
      { label: '접수 (201)', status: 201, response: send },
      {
        label: '429 한도 (COOLDOWN)',
        status: 429,
        response: {
          errorCode: 'STUDY_NOTICE_RATE_LIMITED',
          errorMessage: '방금 공지를 보냈습니다. 1분 뒤에 다시 보낼 수 있습니다.',
        },
      },
      {
        label: '409 끝난 스터디',
        status: 409,
        response: { errorCode: 'STUDY_ENDED', errorMessage: '끝난 스터디입니다.' },
      },
      { label: '400 입력 오류', status: 400, response: invalidInput },
      { label: '403 권한 없음', status: 403, response: forbidden },
      { label: '500 서버 오류', status: 500, response: serverError },
    ],
  },
  {
    method: 'GET',
    path: '/:studyId/groups/:groupId/notices',
    presets: [
      { label: '정상', status: 200, response: list },
      {
        label: '기록 없음',
        status: 200,
        response: { items: [], total: 0, offset: 0, limit: 20 } satisfies ApiNoticeList,
      },
      { label: '403 권한 없음', status: 403, response: forbidden },
      { label: '500 서버 오류', status: 500, response: serverError },
    ],
  },
]);
