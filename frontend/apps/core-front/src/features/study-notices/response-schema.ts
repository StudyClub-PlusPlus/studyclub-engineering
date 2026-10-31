import { z } from 'zod';

export const apiNoticeComposeSchema = z.object({
  recipients: z.array(
    z.object({
      participantId: z.number(),
      displayName: z.string(),
      participantRole: z.union([z.literal('MEMBER'), z.literal('LEADER')]),
      participantStatus: z.union([z.literal('ACTIVE'), z.literal('PAUSED')]),
      discordLinked: z.boolean(),
    }),
  ),
  discord: z.object({
    available: z.boolean(),
    unavailableReason: z.union([
      z.union([
        z.literal('BOT_NOT_CONFIGURED'),
        z.literal('NO_DISCORD_CHANNEL'),
        z.literal('SENDER_NOT_LINKED'),
        z.literal('NO_TEXT_CHANNEL'),
      ]),
      z.null(),
    ]),
  }),
  canSend: z.boolean(),
  blockedReason: z.union([
    z.union([z.literal('STUDY_ENDED'), z.literal('COOLDOWN'), z.literal('DAILY_LIMIT')]),
    z.null(),
  ]),
  nextAvailableAt: z.union([z.string(), z.null()]),
  remainingToday: z.number(),
});

export const apiNoticeListSchema = z.object({
  items: z.array(
    z.object({
      noticeId: z.number(),
      title: z.string(),
      body: z.string(),
      senderName: z.string(),
      sentAt: z.string(),
      recipientCount: z.number(),
      email: z.object({
        requested: z.boolean(),
        pending: z.number(),
        sent: z.number(),
        failed: z.number(),
      }),
      discord: z.object({
        requested: z.boolean(),
        status: z.union([
          z.literal('NOT_REQUESTED'),
          z.literal('PENDING'),
          z.literal('SENT'),
          z.literal('SKIPPED'),
          z.literal('FAILED'),
        ]),
        skipReason: z.union([
          z.union([
            z.literal('BOT_NOT_CONFIGURED'),
            z.literal('NO_DISCORD_CHANNEL'),
            z.literal('SENDER_NOT_LINKED'),
            z.literal('NO_TEXT_CHANNEL'),
          ]),
          z.null(),
        ]),
        mentionedCount: z.number(),
      }),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const noticeSentSchema = z.object({ noticeId: z.number(), recipientCount: z.number() });
