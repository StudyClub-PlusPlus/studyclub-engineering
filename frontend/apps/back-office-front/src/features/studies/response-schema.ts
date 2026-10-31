import { z } from 'zod';

export const studyProgramsSchema = z.object({
  items: z.array(
    z.object({
      programId: z.number(),
      title: z.string(),
      latestStudyId: z.union([z.null(), z.number()]),
    }),
  ),
});

export const apiStudyDetailSchema = z.object({
  id: z.number(),
  programId: z.number(),
  programTitle: z.string(),
  title: z.string(),
  oneLineSummary: z.string(),
  description: z.union([z.null(), z.string()]),
  category: z.string(),
  studyKind: z.union([z.literal('STUDY'), z.literal('CLUB')]),
  thumbnailUrl: z.union([z.null(), z.string()]),
  status: z.union([
    z.literal('DRAFT'),
    z.literal('OPEN'),
    z.literal('ONGOING'),
    z.literal('ENDED'),
    z.literal('CLOSED'),
  ]),
  recruitStatus: z.union([z.null(), z.literal('RECRUITING'), z.literal('RECRUIT_CLOSED')]),
  curriculum: z.union([z.null(), z.string()]),
  capacity: z.union([z.null(), z.number()]),
  schedule: z.union([z.null(), z.string()]),
  timezone: z.union([z.null(), z.literal('KST'), z.literal('PST'), z.literal('BOTH')]),
  recruitDeadlineAt: z.union([z.null(), z.string()]),
  startAt: z.union([z.null(), z.string()]),
  endAt: z.union([z.null(), z.string()]),
  discordLinked: z.boolean(),
  discordChannelUrl: z.union([z.null(), z.string()]),
  driveUrl: z.union([z.null(), z.string()]),
});

export const emptyResponseSchema = z.null();

export const studyDiscordLinkSchema = z.object({
  discordStudyId: z.string(),
  discordRoleId: z.string(),
});
