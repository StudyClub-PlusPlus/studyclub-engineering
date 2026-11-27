import { z } from 'zod';

const sectionCounts = z.object({ GOOD: z.number(), IMPROVE: z.number(), FEELING: z.number() });

export const apiRetroStatusSchema = z.object({
  meetings: z.array(
    z.object({
      meetingId: z.number(),
      // 백엔드보다 먼저 배포돼도 상태 응답 전체가 깨지지 않게 빠져도 받는다
      meetingEndAt: z.string().nullable().optional(),
      retroDeadline: z.string().nullable(),
      retroOpen: z.boolean().nullable(),
      retroMine: z.boolean().nullable(),
    }),
  ),
});

export const apiRetroListSchema = z.object({
  meetingId: z.number(),
  deadline: z.string(),
  open: z.boolean(),
  targets: z.number().nullable(),
  retros: z.array(
    z.object({
      retroId: z.number(),
      author: z.object({ participantId: z.number(), displayName: z.string(), role: z.string() }),
      good: z.string(),
      improve: z.string(),
      feeling: z.string().nullable(),
      writtenAt: z.string(),
      likes: sectionCounts.partial(),
    }),
  ),
  missing: z.array(z.object({ participantId: z.number(), displayName: z.string() })),
});

export const apiRetroViewerSchema = z.object({
  participantId: z.number().nullable(),
  retroId: z.number().nullable(),
  liked: z.record(z.string(), z.record(z.string(), z.boolean())),
});

export const apiRetroLikeSchema = z.object({ count: z.number(), liked: z.boolean() });
