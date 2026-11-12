import { z } from 'zod';

export const apiSiteNoticeSummarySchema = z.object({
  noticeId: z.number(),
  title: z.string(),
  publishedAt: z.string(),
});

export const apiSiteNoticeDetailSchema = z
  .object({
    noticeId: z.number(),
    title: z.string(),
    publishedAt: z.string(),
  })
  .and(
    z.object({
      body: z.string(),
      newer: z.union([
        z.object({
          noticeId: z.number(),
          title: z.string(),
          publishedAt: z.string(),
        }),
        z.null(),
      ]),
      older: z.union([
        z.object({
          noticeId: z.number(),
          title: z.string(),
          publishedAt: z.string(),
        }),
        z.null(),
      ]),
    }),
  );

export const apiSiteNoticePageSchema = z.object({
  items: z.array(apiSiteNoticeSummarySchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
