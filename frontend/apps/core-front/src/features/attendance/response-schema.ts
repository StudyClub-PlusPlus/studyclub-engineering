import { z } from 'zod';

export const apiAttendanceSchema = z.object({
  study: z.object({
    id: z.number(),
    title: z.string(),
    participantCount: z.number(),
    totalMeetings: z.number(),
    avgAttendanceRate: z.union([z.number(), z.null()]),
  }),
  meetings: z.array(
    z.object({
      id: z.number(),
      scheduledAt: z.string(),
    }),
  ),
  participants: z.array(
    z.object({
      participantId: z.number(),
      displayName: z.string(),
      discordNickname: z.union([z.string(), z.null()]).optional(),
      participantRole: z.string(),
      captain: z.boolean(),
      participantStatus: z.string(),
      leftAt: z.union([z.string(), z.null()]),
      attendances: z.array(
        z.object({
          meetingId: z.number(),
          status: z.union([z.string(), z.null()]),
        }),
      ),
      attendanceRate: z.union([z.number(), z.null()]),
    }),
  ),
});
