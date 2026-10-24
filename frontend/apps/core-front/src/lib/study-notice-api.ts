// 스터디 공지 보내기 — specs/study-notice/spec.md 의 요청·응답 모양 그대로. 판정(보낼 수 있는가 · 디스코드가 되는가 · 한도)은
// 서버가 내려준다. 화면은 이 값을 그린다 (docs/backend-development-guide/api/endpoint-convention.md 「판정은 서버가 내려준다」).
import { http } from './http';

export type NoticeChannel = 'EMAIL' | 'DISCORD';
export type NoticeParticipantStatus = 'ACTIVE' | 'PAUSED';
export type DiscordSkipReason = 'BOT_NOT_CONFIGURED' | 'NO_DISCORD_CHANNEL' | 'SENDER_NOT_LINKED' | 'NO_TEXT_CHANNEL';
export type DiscordStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';
export type NoticeBlockedReason = 'COOLDOWN' | 'DAILY_LIMIT';

export type ApiNoticeRecipient = {
  /** 보낼 때 `participantIds` 에 넣는 값 (STUDY_PARTICIPANT.ID). */
  participantId: number;
  displayName: string;
  participantRole: 'MEMBER' | 'LEADER';
  participantStatus: NoticeParticipantStatus;
  /** 디스코드를 연동했는가. 아니면 멘션에서 빠진다. */
  discordLinked: boolean;
};

export type ApiNoticeCompose = {
  recipients: ApiNoticeRecipient[];
  discord: { available: boolean; unavailableReason: DiscordSkipReason | null };
  canSend: boolean;
  blockedReason: NoticeBlockedReason | null;
  /** ISO-8601. `COOLDOWN` 일 때만. */
  nextAvailableAt: string | null;
  remainingToday: number;
};

export type ApiNoticeSendRequest = {
  title: string;
  body: string;
  channels: NoticeChannel[];
  participantIds: number[];
};

export type ApiNoticeItem = {
  noticeId: number;
  title: string;
  body: string;
  /** 탈퇴했으면 「탈퇴한 회원」. */
  senderName: string;
  sentAt: string;
  recipientCount: number;
  email: { requested: boolean; pending: number; sent: number; failed: number };
  discord: {
    requested: boolean;
    status: DiscordStatus;
    skipReason: DiscordSkipReason | null;
    mentionedCount: number;
  };
};

export type ApiNoticeList = { items: ApiNoticeItem[]; total: number; offset: number; limit: number };

const base = (studyId: number, groupId: number) => `/api/studies/${studyId}/groups/${groupId}/notices`;

export function getNoticeCompose(studyId: number, groupId: number) {
  return http<ApiNoticeCompose>(`${base(studyId, groupId)}/compose`);
}

/** 접수까지만 응답한다. 메일이 나갔는지·디스코드가 올라갔는지는 기록으로 본다. */
export function sendNotice(studyId: number, groupId: number, body: ApiNoticeSendRequest) {
  return http<{ noticeId: number; recipientCount: number }>(base(studyId, groupId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getNotices(studyId: number, groupId: number, limit: number) {
  return http<ApiNoticeList>(`${base(studyId, groupId)}?offset=0&limit=${limit}`);
}
