import { z } from 'zod';

export const apiDashboardSummarySchema = z.object({
  asOf: z.string(),
  timeZone: z.string(),
  activeCrew: z.union([z.undefined(), z.number()]).optional(),
  activeEnrollments: z.union([z.undefined(), z.number()]).optional(),
  studiesPerCrew: z.union([z.undefined(), z.null(), z.number()]).optional(),
  communityMembers: z.union([z.undefined(), z.number()]).optional(),
  attendanceRate: z.union([z.undefined(), z.null(), z.number()]).optional(),
  attendanceComparison: z
    .union([
      z.undefined(),
      z.object({
        currentWeekStart: z.string(),
        previousWeekStart: z.string(),
        currentRate: z.union([z.null(), z.number()]),
        previousRate: z.union([z.null(), z.number()]),
        deltaPercentagePoints: z.union([z.null(), z.number()]),
      }),
    ])
    .optional(),
  errors: z.object({
    participation: z
      .union([
        z.undefined(),
        z.object({
          errorCode: z.string(),
          errorMessage: z.string(),
        }),
      ])
      .optional(),
    attendance: z
      .union([
        z.undefined(),
        z.object({
          errorCode: z.string(),
          errorMessage: z.string(),
        }),
      ])
      .optional(),
    communityMembers: z
      .union([
        z.undefined(),
        z.object({
          errorCode: z.string(),
          errorMessage: z.string(),
        }),
      ])
      .optional(),
  }),
});

export const apiStudyBoardSchema = z.object({
  asOf: z.string(),
  timeZone: z.string(),
  view: z.union([z.literal('ONGOING'), z.literal('RECRUITMENT')]),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  items: z.array(
    z.object({
      studyId: z.number(),
      programId: z.number(),
      title: z.string(),
      recruitStatus: z
        .union([z.undefined(), z.null(), z.literal('RECRUITING'), z.literal('RECRUIT_CLOSED')])
        .optional(),
      recruitDeadlineAt: z.union([z.undefined(), z.null(), z.string()]).optional(),
      deadlineBadge: z
        .union([
          z.undefined(),
          z.null(),
          z.literal('DEADLINE_PASSED'),
          z.literal('CAPACITY_FULL'),
          z.literal('DEADLINE_MISSING'),
          z.literal('CLOSING_SOON'),
          z.literal('NORMAL'),
        ])
        .optional(),
    }),
  ),
});

export const apiCrewTimezonesSchema = z.object({
  asOf: z.string(),
  totalCrew: z.number(),
  timeZoneGroups: z.array(
    z.object({
      code: z.union([z.literal('KST'), z.literal('ET'), z.literal('PT'), z.literal('UNKNOWN')]),
      count: z.number(),
      percentage: z.union([z.null(), z.number()]),
    }),
  ),
});

export const apiAttendanceTrendSchema = z.object({
  asOf: z.string(),
  timeZone: z.string(),
  averageRate: z.union([z.null(), z.number()]),
  points: z.array(
    z.object({
      weekStart: z.string(),
      isCurrentWeek: z.boolean(),
      weightedAttended: z.number(),
      eligibleCount: z.number(),
      rate: z.union([z.null(), z.number()]),
    }),
  ),
});

export const apiStudiesByCategorySchema = z.object({
  asOf: z.string(),
  categories: z.array(
    z.object({
      code: z.string(),
      ongoingCount: z.number(),
      totalCount: z.number(),
    }),
  ),
});
