import { z } from 'zod';

export const apiSiteNoticePageSchema = z.object({
  items: z.array(
    z.object({
      noticeId: z.number(),
      title: z.string(),
      author: z.string(),
      publishedAt: z.string(),
      updatedAt: z.string(),
    }),
  ),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});

export const apiSiteNoticeDetailSchema = z.object({
  noticeId: z.number(),
  title: z.string(),
  author: z.string(),
  publishedAt: z.string(),
  updatedAt: z.string(),
  body: z.string(),
});

export const emptyResponseSchema = z.null();
