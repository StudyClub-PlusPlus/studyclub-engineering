import { z } from 'zod';

export const notificationTemplateSchema = z.object({
  id: z.number(),
  eventType: z.string(),
  channel: z.string(),
  subject: z.string(),
  body: z.string(),
  updatedAt: z.union([z.null(), z.string()]),
  updatedByAdminId: z.union([z.null(), z.number()]),
});

export const emptyResponseSchema = z.null();
