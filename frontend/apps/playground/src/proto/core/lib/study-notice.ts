'use client';

import { getDiscordNickname } from '@core/lib/me';
import type { NavigatorGroup } from '@core/lib/meetings';
import { participantsOf } from '@core/lib/schedule-board';
import type { Study } from '@studyclub/mock';

/**
 * 스터디 공지 보내기 (프로토) — 네비게이터가 자기 반 팀원 중 고른 사람에게 메일·디스코드로 보낸다.
 *
 * 프로토에는 서버가 없다. **서버가 내려줄 판정**(보낼 수 있는가 · 디스코드가 되는가 · 한도)을 여기서 흉내 낸다.
 * 실제 화면은 이 값을 그리기만 한다 — 날짜·횟수로 다시 계산하지 않는다 (POL-0010).
 * 기록은 브라우저(localStorage)에만 남는다.
 *
 * TODO(api): GET  /api/studies/{studyId}/groups/{groupId}/notices/compose
 *            POST /api/studies/{studyId}/groups/{groupId}/notices
 *            GET  /api/studies/{studyId}/groups/{groupId}/notices
 */

/** POL-0010 */
export const NOTICE_LIMITS = {
  title: 60,
  body: 1500,
  /** 직전 발송 뒤 다시 보낼 수 있기까지. */
  cooldownMs: 60_000,
  /** 한 반이 하루(KST)에 보낼 수 있는 횟수. */
  dailyMax: 30,
} as const;

export type NoticeChannel = 'EMAIL' | 'DISCORD';
export type NoticeParticipantStatus = 'ACTIVE' | 'PAUSED';

export type NoticeRecipient = {
  participantId: string;
  displayName: string;
  participantRole: 'MEMBER' | 'LEADER';
  participantStatus: NoticeParticipantStatus;
  discordLinked: boolean;
};

export type DiscordUnavailableReason = 'BOT_NOT_CONFIGURED' | 'NO_DISCORD_CHANNEL' | 'SENDER_NOT_LINKED';
export type BlockedReason = 'COOLDOWN' | 'DAILY_LIMIT';

export type NoticeCompose = {
  recipients: NoticeRecipient[];
  discord: { available: boolean; unavailableReason: DiscordUnavailableReason | null };
  canSend: boolean;
  blockedReason: BlockedReason | null;
  /** ISO-8601. COOLDOWN 일 때만. */
  nextAvailableAt: string | null;
  remainingToday: number;
};

export type DiscordStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';

export type NoticeRecord = {
  noticeId: string;
  title: string;
  body: string;
  senderName: string;
  /** ISO-8601 */
  sentAt: string;
  recipientCount: number;
  email: { requested: boolean; pending: number; sent: number; failed: number };
  discord: {
    requested: boolean;
    status: DiscordStatus;
    skipReason: DiscordUnavailableReason | 'NO_TEXT_CHANNEL' | null;
    mentionedCount: number;
  };
};

export class NoticeRateLimitedError extends Error {
  constructor(
    readonly reason: BlockedReason,
    readonly nextAvailableAt: string | null,
  ) {
    super('STUDY_NOTICE_RATE_LIMITED');
  }
}

const KEY = 'sc_study_notices';
/** 프로토의 메일은 이만큼 지나면 나간 것으로 본다 — 서버는 30초 폴러가 나른다. */
const MAIL_SETTLE_MS = 30_000;

type Store = Record<string, NoticeRecord[]>;

function read(): Store {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // 저장 실패해도 화면 동작은 막지 않는다
  }
}

const groupKey = (study: Study, group: NavigatorGroup) => `${study.id}:${group.id}`;

/** 한국 시간 기준 날짜(yyyy-MM-dd). 하루 한도는 KST 0시에 풀린다. */
const kstDay = (ms: number) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10);

/** 후보 = 이 반의 참여 중·쉬는 중 멤버. 중단된 사람은 뺀다. */
function candidates(study: Study): NoticeRecipient[] {
  const rows = participantsOf(study).filter((p) => !p.left);
  return rows.map((p, i) => ({
    participantId: p.id,
    displayName: p.nickname ?? p.name,
    participantRole: p.role ? 'LEADER' : 'MEMBER',
    // 프로토 가정 — 명부 7번째가 쉬는 중이다.
    participantStatus: !p.me && i === 6 ? 'PAUSED' : 'ACTIVE',
    discordLinked: p.me ? Boolean(getDiscordNickname()) : Boolean(p.discordNickname),
  }));
}

/** 서버가 정할 값: 한도에 걸렸는가. 걸렸으면 사유와 다시 보낼 수 있는 시각. */
function sendBlock(sent: NoticeRecord[], now: number): { reason: BlockedReason; next: string | null } | null {
  const last = sent.reduce((m, n) => Math.max(m, Date.parse(n.sentAt)), 0);
  if (last && now - last < NOTICE_LIMITS.cooldownMs) {
    return { reason: 'COOLDOWN', next: new Date(last + NOTICE_LIMITS.cooldownMs).toISOString() };
  }
  const today = sent.filter((n) => kstDay(Date.parse(n.sentAt)) === kstDay(now)).length;
  if (today >= NOTICE_LIMITS.dailyMax) return { reason: 'DAILY_LIMIT', next: null };
  return null;
}

export function getCompose(study: Study, group: NavigatorGroup): NoticeCompose {
  const now = Date.now();
  const sent = read()[groupKey(study, group)] ?? [];
  const block = sendBlock(sent, now);
  const recipients = candidates(study);
  const senderLinked = recipients.find((r) => r.participantId === 'me')?.discordLinked ?? false;
  const today = sent.filter((n) => kstDay(Date.parse(n.sentAt)) === kstDay(now)).length;
  return {
    recipients,
    discord: {
      available: senderLinked,
      unavailableReason: senderLinked ? null : 'SENDER_NOT_LINKED',
    },
    canSend: block === null,
    blockedReason: block?.reason ?? null,
    nextAvailableAt: block?.next ?? null,
    remainingToday: Math.max(0, NOTICE_LIMITS.dailyMax - today),
  };
}

export function sendNotice(
  study: Study,
  group: NavigatorGroup,
  input: { title: string; body: string; channels: NoticeChannel[]; participantIds: string[] },
): { noticeId: string; recipientCount: number } {
  const compose = getCompose(study, group);
  if (!compose.canSend && compose.blockedReason) {
    throw new NoticeRateLimitedError(compose.blockedReason, compose.nextAvailableAt);
  }
  const chosen = compose.recipients.filter((r) => input.participantIds.includes(r.participantId));
  const sendEmail = input.channels.includes('EMAIL');
  const sendDiscord = input.channels.includes('DISCORD');
  const me = compose.recipients.find((r) => r.participantId === 'me');
  const record: NoticeRecord = {
    noticeId: String(Date.now()),
    title: input.title.trim(),
    body: input.body.trim(),
    senderName: me?.displayName ?? '나',
    sentAt: new Date().toISOString(),
    recipientCount: chosen.length,
    email: { requested: sendEmail, pending: sendEmail ? chosen.length : 0, sent: 0, failed: 0 },
    discord: {
      requested: sendDiscord,
      status: !sendDiscord ? 'NOT_REQUESTED' : compose.discord.available ? 'SENT' : 'SKIPPED',
      skipReason: sendDiscord && !compose.discord.available ? compose.discord.unavailableReason : null,
      mentionedCount: sendDiscord && compose.discord.available ? chosen.filter((r) => r.discordLinked).length : 0,
    },
  };
  const store = read();
  const key = groupKey(study, group);
  store[key] = [record, ...(store[key] ?? [])];
  write(store);
  return { noticeId: record.noticeId, recipientCount: record.recipientCount };
}

/** 최근 순. 메일은 보낸 지 30초가 지나면 나간 것으로 보인다 (서버 폴러 주기). */
export function listNotices(study: Study, group: NavigatorGroup): NoticeRecord[] {
  const now = Date.now();
  return (read()[groupKey(study, group)] ?? []).map((n) =>
    n.email.requested && now - Date.parse(n.sentAt) >= MAIL_SETTLE_MS
      ? { ...n, email: { ...n.email, pending: 0, sent: n.recipientCount } }
      : n,
  );
}
