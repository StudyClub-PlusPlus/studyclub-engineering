import { z } from 'zod';

export const apiStudySchema = z.object({
  studyId: z.number(),
  title: z.string(),
  oneLineSummary: z.string(),
  category: z.string(),
  studyKind: z.union([z.literal('STUDY'), z.literal('CLUB')]),
  thumbnailUrl: z.union([z.string(), z.null()]),
  schedule: z.union([z.string(), z.null()]),
  timezone: z.union([z.literal('KST'), z.literal('PST'), z.literal('BOTH'), z.null()]),
  status: z.enum(['DRAFT', 'OPEN', 'ONGOING', 'ENDED', 'CLOSED']),
  phase: z.union([z.literal('RECRUITING'), z.literal('ONGOING'), z.literal('CLOSED')]),
  recruitStatus: z.union([z.literal('RECRUITING'), z.literal('RECRUIT_CLOSED')]),
  capacity: z.union([z.number(), z.null()]),
  currentApplicants: z.number(),
  recruitDeadlineAt: z.union([z.string(), z.null()]),
  startAt: z.union([z.string(), z.null()]),
  endAt: z.union([z.string(), z.null()]),
  closingSoon: z.boolean(),
});

export const apiStudyDetailSchema = z.object({
  id: z.number(),
  programId: z.number(),
  title: z.string(),
  oneLineSummary: z.string(),
  description: z.union([z.string(), z.null()]),
  category: z.string(),
  studyKind: z.union([z.literal('STUDY'), z.literal('CLUB')]),
  thumbnailUrl: z.union([z.string(), z.null()]),
  status: z.union([
    z.literal('DRAFT'),
    z.literal('OPEN'),
    z.literal('ONGOING'),
    z.literal('ENDED'),
    z.literal('CLOSED'),
  ]),
  recruitStatus: z.union([z.literal('RECRUITING'), z.literal('RECRUIT_CLOSED'), z.null()]),
  curriculum: z.union([z.string(), z.null()]),
  capacity: z.union([z.number(), z.null()]),
  recruitDeadlineAt: z.union([z.string(), z.null()]),
  schedule: z.union([z.string(), z.null()]),
  timezone: z.union([z.literal('KST'), z.literal('PST'), z.literal('BOTH'), z.null()]),
  startAt: z.union([z.string(), z.null()]),
  endAt: z.union([z.string(), z.null()]),
  discordChannelUrl: z.union([z.string(), z.null()]),
  driveUrl: z.union([z.string(), z.null()]),
  programTitle: z.string(),
  discordLinked: z.boolean(),
});

export const apiStudyPageSchema = z.object({
  items: z.array(apiStudySchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
