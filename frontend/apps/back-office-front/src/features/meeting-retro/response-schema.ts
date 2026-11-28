import { z } from 'zod';

const sectionCounts = z.object({ GOOD: z.number(), IMPROVE: z.number(), FEELING: z.number() });

export const apiRetroStatusSchema = z.object({
  meetings: z.array(
    z.object({
      meetingId: z.number(),
      meetingEndAt: z.string().nullable(),
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

export const apiAdminRetrosSchema = z.object({
  summary: z.object({
    rows: z.number(),
    written: z.number(),
    closedRows: z.number(),
    closedWritten: z.number(),
    good: z.number(),
    improve: z.number(),
    feeling: z.number(),
  }),
  total: z.number(),
  items: z.array(
    z.object({
      studyId: z.number(),
      studyTitle: z.string(),
      groupName: z.string(),
      meetingId: z.number(),
      meetingNo: z.number(),
      meetingStartAt: z.string(),
      participantName: z.string(),
      closed: z.boolean(),
      retro: z.object({
        good: z.string(),
        improve: z.string(),
        feeling: z.string().nullable(),
        likes: sectionCounts.partial(),
        writtenAt: z.string(),
      }),
    }),
  ),
});

/** 회고 모아보기의 스터디 고르기 — 진행 중인 스터디 목록에서 이름만 쓴다. */
export const apiRetroStudyOptionsSchema = z.object({
  items: z.array(z.object({ studyId: z.number(), title: z.string() })),
});
