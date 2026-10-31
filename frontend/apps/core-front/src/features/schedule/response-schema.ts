import { z } from 'zod';

export const apiMeetingListSchema = z.object({
  study: z.object({
    id: z.number(),
    title: z.string(),
    discordChannelUrl: z.union([z.string(), z.null()]),
    driveUrl: z.union([z.string(), z.null()]),
  }),
  studyGroup: z.object({
    id: z.number(),
    name: z.string(),
    timezone: z.string(),
    startTime: z.union([z.string(), z.null()]),
    navigatorName: z.union([z.string(), z.null()]),
    rules: z.union([z.string(), z.null()]),
  }),
  me: z.object({
    participantId: z.union([z.number(), z.null()]),
    canEdit: z.boolean(),
  }),
  participants: z.array(
    z.object({
      participantId: z.number(),
      name: z.string(),
      discordNickname: z.union([z.string(), z.null()]).optional(),
      left: z.boolean().optional(),
      active: z.boolean().optional(),
    }),
  ),
  meetings: z.array(
    z.object({
      id: z.number(),
      type: z.string(),
      number: z.number(),
      scheduledAt: z.string(),
      title: z.union([z.string(), z.null()]),
      presenter1: z.union([
        z.object({
          participantId: z.number(),
          name: z.string(),
          active: z.boolean(),
        }),
        z.null(),
      ]),
      presenter2: z.union([
        z.object({
          participantId: z.number(),
          name: z.string(),
          active: z.boolean(),
        }),
        z.null(),
      ]),
      started: z.boolean(),
    }),
  ),
});
