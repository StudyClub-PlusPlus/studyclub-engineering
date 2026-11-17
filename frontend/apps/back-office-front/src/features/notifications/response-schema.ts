import { z } from 'zod';

export const apiNotificationPageSchema = z.object({
  items: z.array(
    z.object({
      id: z.number(),
      eventType: z.string(),
      recipientType: z.string(),
      recipientValue: z.string(),
      status: z.union([
        z.literal('PENDING'),
        z.literal('PROCESSING'),
        z.literal('SENT'),
        z.literal('FAILED'),
        z.string(),
      ]),
      templateId: z.number(),
      sentAt: z.union([z.null(), z.string()]),
      createdAt: z.string(),
      canResend: z.boolean(),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
export const apiNotificationResendSchema = z.object({
  accepted: z.array(z.number()),
  skipped: z.array(z.object({ id: z.number(), reason: z.enum(['NOT_FAILED', 'RECIPIENT_GONE']) })),
});
