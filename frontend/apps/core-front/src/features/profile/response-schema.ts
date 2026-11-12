import { z } from 'zod';
export const marketingConsentSchema = z.object({ agreed: z.boolean(), agreedAt: z.string().nullable() });
export const nicknameAvailabilitySchema = z.object({ available: z.boolean() });
