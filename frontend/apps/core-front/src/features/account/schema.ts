import { z } from 'zod';

export const leaveFormSchema = z.object({ reason: z.enum(['', 'NO_DESIRED_STUDY', 'PARTICIPATION_BURDEN', 'OTHER']) });
export type LeaveFormValues = z.infer<typeof leaveFormSchema>;
