// 공지 탭의 순수 규칙 — 고르기 · 길이 · 안내 문구. 서버가 내려준 값을 읽어 그릴 문장만 만들고, 판정(보낼 수 있는가 · 한도)은 다시 하지 않는다.
import { z } from 'zod';

import type { ApiNoticeCompose, ApiNoticeItem, ApiNoticeList, ApiNoticeRecipient, DiscordSkipReason, NoticeChannel, NoticeParticipantStatus } from '@/features/study-notices/types';

/** POL-0010. 서버가 같은 값으로 검증한다. */
export const NOTICE_LIMITS = { title: 60, body: 1500 } as const;

export type StatusFilter = 'ALL' | NoticeParticipantStatus;

/** 처음에는 참여 중(ACTIVE) 전원이 골라져 있다. 쉬는 중은 비어 있다. */
export function defaultSelection(recipients: ApiNoticeRecipient[]): Set<number> {
  return new Set(recipients.filter((r) => r.participantStatus === 'ACTIVE').map((r) => r.participantId));
}

export function visibleRecipients(recipients: ApiNoticeRecipient[], filter: StatusFilter): ApiNoticeRecipient[] {
  return filter === 'ALL' ? recipients : recipients.filter((r) => r.participantStatus === filter);
}

export function statusCounts(recipients: ApiNoticeRecipient[]): Record<StatusFilter, number> {
  return {
    ALL: recipients.length,
    ACTIVE: recipients.filter((r) => r.participantStatus === 'ACTIVE').length,
    PAUSED: recipients.filter((r) => r.participantStatus === 'PAUSED').length,
  };
}

/**
 * 보이는(거른) 사람만 켜거나 끈다. 보이지 않는 사람의 선택은 건드리지 않는다. 거르기는 보이는 줄을 좁힐 뿐 이미 고른 사람을 지우지 않는다.
 */
export function toggleVisible(selected: ReadonlySet<number>, visible: ApiNoticeRecipient[], on: boolean): Set<number> {
  const next = new Set(selected);
  for (const r of visible) {
    if (on) next.add(r.participantId);
    else next.delete(r.participantId);
  }
  return next;
}

export function toggleOne(selected: ReadonlySet<number>, id: number, on: boolean): Set<number> {
  const next = new Set(selected);
  if (on) next.add(id);
  else next.delete(id);
  return next;
}

/** 디스코드 글에서 멘션되는 사람 수 — 고른 사람 중 디스코드를 연동한 사람. */
export function mentionedCount(recipients: ApiNoticeRecipient[], selected: ReadonlySet<number>): number {
  return recipients.filter((r) => selected.has(r.participantId) && r.discordLinked).length;
}

export const noticeDraftSchema = z.object({
  title: z
    .string()
    .refine(
      (value) => value.trim().length > 0 && value.trim().length <= NOTICE_LIMITS.title,
      `제목은 1~${NOTICE_LIMITS.title}자로 써 주세요.`,
    ),
  body: z
    .string()
    .refine(
      (value) => value.trim().length > 0 && value.trim().length <= NOTICE_LIMITS.body,
      `본문은 1~${NOTICE_LIMITS.body.toLocaleString()}자로 써 주세요.`,
    ),
  channels: z.array(z.enum(['EMAIL', 'DISCORD'])).min(1, '보낼 곳을 하나 이상 골라 주세요.'),
  selectedCount: z.number().int().positive('받는 사람을 하나 이상 골라 주세요.'),
});
export type Draft = z.infer<typeof noticeDraftSchema>;

/** 앞뒤 공백을 자른 길이. 서버도 같은 기준으로 센다. */
export const lengthOf = (value: string) => value.trim().length;

export function draftProblems(draft: Draft) {
  const titleLen = lengthOf(draft.title);
  const bodyLen = lengthOf(draft.body);
  return {
    titleLen,
    bodyLen,
    titleOver: titleLen > NOTICE_LIMITS.title,
    bodyOver: bodyLen > NOTICE_LIMITS.body,
  };
}

/**
 * 다시 받은 명단에 더는 없는 사람(중단·탈퇴 등)을 선택에서 걷어낸다. 걷어내지 않으면 「N명 선택」과 확인 창의 인원이 부풀고, 모두 사라지면 빈 목록을
 * 보내 400 이 난다.
 */
export function pruneSelection(selected: ReadonlySet<number>, recipients: ApiNoticeRecipient[]): Set<number> {
  const present = new Set(recipients.map((r) => r.participantId));
  return new Set([...selected].filter((id) => present.has(id)));
}

/**
 * 쿨다운이 끝나는 때 화면 값(compose)을 다시 받을 때까지의 밀리초. 다시 받을 때가 없으면 false.
 * 다시 받지 않으면 시각이 지나도 서버가 준 `canSend=false` 가 그대로라 버튼이 안 풀린다. 시각이 막 지난 순간에 서버가 아직 막고 있을 수 있어 조금 더 기다린다.
 */
/**
 * 보내기 화면을 무엇으로 그릴지. 이미 받은 값이 있으면 다시 받기가 실패해도 폼을 그대로 둔다 — 폼을 걷으면 제목 · 본문이 컴포넌트 안의
 * 상태라 사라진다(쿨다운이 끝나 자동으로 다시 받다가 실패하는 경우). 권한이 없어진 것(403)만 안내 화면으로 바꾼다.
 *
 * - `loading`: 처음 받는 중 · `error`: 처음부터 못 받음 · `forbidden`: 권한 없음
 * - `form`: 폼을 그린다. `staleError` 가 true 면 최신 값을 못 받았다는 안내를 폼 위에 함께 보인다
 */
export type ComposeView =
  { kind: 'loading' } | { kind: 'error' } | { kind: 'forbidden' } | { kind: 'form'; staleError: boolean };

export function composeView(state: { hasData: boolean; isError: boolean; errorStatus?: number | null }): ComposeView {
  if (state.isError && state.errorStatus === 403) return { kind: 'forbidden' };
  if (state.hasData) return { kind: 'form', staleError: state.isError };
  return state.isError ? { kind: 'error' } : { kind: 'loading' };
}

/** 보낸 공지 기록 한 쪽의 크기. 서버가 한 번에 주는 최대(50)보다 작아야 「더 보기」가 이어진다. */
export const NOTICE_PAGE = 20;

/** 지금까지 불러온 쪽들을 한 줄로 잇는다. 쪽을 받는 사이에 새 공지가 생겨 경계가 밀리면 같은 공지가 두 쪽에 올 수 있어 한 번만 남긴다. */
export function mergeNoticePages(pages: ApiNoticeList[]): ApiNoticeItem[] {
  const seen = new Set<number>();
  const items: ApiNoticeItem[] = [];
  for (const page of pages) {
    for (const item of page.items) {
      if (seen.has(item.noticeId)) continue;
      seen.add(item.noticeId);
      items.push(item);
    }
  }
  return items;
}

/** 다음 쪽의 시작 위치. 더 받을 것이 없으면 undefined. 서버가 쪽을 잘라 주어도(최대 50) 받은 개수만큼 이어 간다. */
export function nextNoticeOffset(pages: ApiNoticeList[]): number | undefined {
  const last = pages[pages.length - 1];
  if (!last || last.items.length === 0) return undefined;
  const loaded = last.offset + last.items.length;
  return loaded < last.total ? loaded : undefined;
}

export function nextRefetchDelay(
  compose: Pick<ApiNoticeCompose, 'blockedReason' | 'nextAvailableAt'>,
  now: number = Date.now(),
): number | false {
  if (compose.blockedReason !== 'COOLDOWN' || !compose.nextAvailableAt) return false;
  const at = Date.parse(compose.nextAvailableAt);
  if (Number.isNaN(at)) return false;
  return Math.max(0, at - now) + 500;
}

/** 서버가 보낼 수 있다고 한 때(`canSend`)에만, 글과 보낼 곳과 받는 사람이 갖춰졌을 때 보낼 수 있다. */
export function canSubmit(draft: Draft, compose: Pick<ApiNoticeCompose, 'canSend'>): boolean {
  return compose.canSend && noticeDraftSchema.safeParse(draft).success;
}

/** 보낼 곳을 서버 값에 맞춘다 — 디스코드를 못 쓰는 상태에서 고른 디스코드는 뺀다. */
export function effectiveChannels(channels: NoticeChannel[], discordAvailable: boolean): NoticeChannel[] {
  return discordAvailable ? channels : channels.filter((c) => c !== 'DISCORD');
}

const DISCORD_UNAVAILABLE: Record<DiscordSkipReason, string> = {
  BOT_NOT_CONFIGURED: '디스코드 봇이 연결되어 있지 않아 보낼 수 없습니다.',
  NO_DISCORD_CHANNEL: '이 스터디에 디스코드 채널이 만들어져 있지 않아 보낼 수 없습니다.',
  SENDER_NOT_LINKED: '내 디스코드가 연동되어 있지 않아 보낼 수 없습니다.',
  NO_TEXT_CHANNEL: '디스코드 텍스트 채널을 찾지 못해 보낼 수 없습니다.',
};

export const discordUnavailableMessage = (reason: DiscordSkipReason | null) =>
  reason ? DISCORD_UNAVAILABLE[reason] : '디스코드로 보낼 수 없습니다.';

const SKIP_LABEL: Record<DiscordSkipReason, string> = {
  BOT_NOT_CONFIGURED: '봇 미연결',
  NO_DISCORD_CHANNEL: '스터디 디스코드 채널 없음',
  SENDER_NOT_LINKED: '보낸 사람 디스코드 미연동',
  NO_TEXT_CHANNEL: '텍스트 채널 없음',
};

/** 한국 시간이 아니라 보는 사람의 시간대로 HH:mm. */
export function clock(iso: string, locale = 'ko-KR'): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** 보내기 줄 왼쪽의 한 줄 안내. 사유와 시각은 서버가 준 값을 그대로 쓴다. 안내할 것이 없으면 null. */
export function limitNote(compose: ApiNoticeCompose): string | null {
  if (compose.blockedReason === 'STUDY_ENDED') return '끝난 스터디라 새 공지를 보낼 수 없습니다.';
  if (compose.blockedReason === 'COOLDOWN' && compose.nextAvailableAt) {
    return `방금 공지를 보냈습니다. ${clock(compose.nextAvailableAt)} 이후에 다시 보낼 수 있습니다.`;
  }
  if (compose.blockedReason === 'DAILY_LIMIT') {
    return '오늘 보낼 수 있는 횟수를 모두 썼습니다. 내일 다시 보낼 수 있습니다.';
  }
  if (compose.remainingToday <= 5) return `오늘 ${compose.remainingToday}번 더 보낼 수 있습니다.`;
  return null;
}

export function mailResultLabel(email: ApiNoticeItem['email']): string | null {
  if (!email.requested) return null;
  return `메일 · 대기 ${email.pending} · 완료 ${email.sent} · 실패 ${email.failed}`;
}

/** 건너뜀(우리가 못 보냄)과 실패(보냈는데 안 됨)를 가른다. */
export function discordResultLabel(discord: ApiNoticeItem['discord']): string | null {
  if (!discord.requested) return null;
  switch (discord.status) {
    case 'SENT':
      return `디스코드 · 완료 (멘션 ${discord.mentionedCount}명 요청)`;
    case 'SKIPPED':
      return `디스코드 · 건너뜀 (${discord.skipReason ? SKIP_LABEL[discord.skipReason] : '사유 없음'})`;
    case 'FAILED':
      return '디스코드 · 실패';
    case 'PENDING':
      return '디스코드 · 대기';
    default:
      return null;
  }
}
