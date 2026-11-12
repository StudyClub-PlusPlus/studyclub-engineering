import { z } from 'zod';

export const siteNoticeSchema = z.object({
  title: z.string().refine((value) => Boolean(value.trim()), '제목을 입력하세요.'),
  body: z.string().refine((value) => Boolean(value.trim()), '본문을 입력하세요.'),
});
export type SiteNoticeValues = z.infer<typeof siteNoticeSchema>;
