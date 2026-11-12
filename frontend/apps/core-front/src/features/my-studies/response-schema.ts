import { z } from 'zod';

export const apiMyStudiesSchema = z.object({
  items: z.array(
    z.object({
      studyId: z.number(),
      title: z.string(),
      category: z.string(),
      studyKind: z.union([z.literal('STUDY'), z.literal('CLUB')]),
      startAt: z.union([z.string(), z.null()]),
      endAt: z.union([z.string(), z.null()]),
      relation: z.union([z.literal('UPCOMING'), z.literal('ONGOING'), z.literal('COMPLETED'), z.literal('WITHDRAWN')]),
      participantStatus: z
        .union([
          z.literal('ACTIVE'),
          z.literal('PAUSED'),
          z.literal('COMPLETED'),
          z.literal('WITHDRAWN'),
          z.literal('DELETED'),
        ])
        .optional(),
      participantRole: z.union([z.union([z.literal('MEMBER'), z.literal('LEADER')]), z.null()]),
      captain: z.boolean(),
      discordChannelUrl: z.union([z.string(), z.null()]),
      driveUrl: z.union([z.string(), z.null()]),
      attendanceRate: z.union([z.number(), z.null()]),
      meetings: z.array(
        z.object({
          meetingId: z.number(),
          sequence: z.number(),
          scheduledAt: z.string(),
          startAt: z.union([z.string(), z.null()]),
          endAt: z.union([z.string(), z.null()]),
          attendanceStatus: z.union([
            z.literal('PRESENT'),
            z.literal('LATE'),
            z.literal('ABSENT'),
            z.literal('EXCUSED'),
            z.null(),
          ]),
          countedInRate: z.boolean(),
        }),
      ),
    }),
  ),
});
