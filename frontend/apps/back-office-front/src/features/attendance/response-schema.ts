import { z } from 'zod';

export const apiAttendanceSchema = z.object({
  study: z.object({
    id: z.number(),
    title: z.string(),
    participantCount: z.number(),
    totalMeetings: z.number(),
    avgAttendanceRate: z.union([z.null(), z.number()]),
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
      participantRole: z.string(),
      captain: z.boolean(),
      participantStatus: z.string(),
      leftAt: z.union([z.null(), z.string()]),
      attendances: z.array(
        z.object({
          meetingId: z.number(),
          status: z.union([
            z.null(),
            z.literal('PRESENT'),
            z.literal('LATE'),
            z.literal('ABSENT'),
            z.literal('EXCUSED'),
          ]),
        }),
      ),
      attendanceRate: z.union([z.null(), z.number()]),
    }),
  ),
});

export const emptyResponseSchema = z.null();
