export type NoticeChannel = 'EMAIL' | 'DISCORD';
export type NoticeParticipantStatus = 'ACTIVE' | 'PAUSED';
export type DiscordSkipReason = 'BOT_NOT_CONFIGURED' | 'NO_DISCORD_CHANNEL' | 'SENDER_NOT_LINKED' | 'NO_TEXT_CHANNEL';
export type DiscordStatus = 'NOT_REQUESTED' | 'PENDING' | 'SENT' | 'SKIPPED' | 'FAILED';
/** 끝난 스터디(`STUDY_ENDED`)가 가장 먼저, 그다음 쿨다운, 하루 한도. */
export type NoticeBlockedReason = 'STUDY_ENDED' | 'COOLDOWN' | 'DAILY_LIMIT';

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

