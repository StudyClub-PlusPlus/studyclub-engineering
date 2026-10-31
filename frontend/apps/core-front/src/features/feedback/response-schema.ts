import { z } from 'zod';

// 응답 모양은 specs/feedback/spec.md 「내 문의 목록」 · 「내 문의 상세」 · 「제출」 201.
// vitest 에 @ 별칭이 없어 queries.ts 가 상대 경로로 부른다 — 이 파일도 바깥을 import 하지 않는다.

const feedbackTypeSchema = z.enum(['QUESTION', 'IDEA', 'BUG']);
const feedbackStatusSchema = z.enum(['RECEIVED', 'ANSWERED']);

export const myFeedbackItemSchema = z.object({
  id: z.number(),
  type: feedbackTypeSchema,
  title: z.string(),
  status: feedbackStatusSchema,
  createdAt: z.string(),
});

export const myFeedbackPageSchema = z.object({
  items: z.array(myFeedbackItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const myFeedbackDetailSchema = myFeedbackItemSchema.extend({
  content: z.string(),
  images: z.array(z.object({ url: z.string() })),
  reply: z.object({ content: z.string(), repliedAt: z.string() }).nullable(),
});
