import { z } from 'zod';

// 응답 모양은 specs/feedback/spec.md 「운영 목록」 · 「운영 상세」 — types.ts 와 1:1 이다.

const feedbackTypeSchema = z.enum(['QUESTION', 'IDEA', 'BUG']);
const feedbackStatusSchema = z.enum(['NEW', 'SEEN', 'DONE']);
const personSchema = z.object({ nickname: z.string().nullable() });

const apiAdminFeedbackSchema = z.object({
  id: z.number(),
  createdAt: z.string(),
  type: feedbackTypeSchema,
  title: z.string(),
  submitter: personSchema,
  status: feedbackStatusSchema,
  doneBy: personSchema.nullable(),
});

export const apiAdminFeedbackPageSchema = z.object({
  items: z.array(apiAdminFeedbackSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const apiAdminFeedbackDetailSchema = apiAdminFeedbackSchema.extend({
  selectableStatuses: z.array(feedbackStatusSchema),
  content: z.string(),
  images: z.array(z.object({ url: z.string() })),
  browser: z.string().nullable(),
  viewport: z.object({ width: z.number(), height: z.number() }).nullable(),
  reply: z.object({ content: z.string(), repliedAt: z.string() }).nullable(),
  adminMemo: z.string().nullable(),
});
