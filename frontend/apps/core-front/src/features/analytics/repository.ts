import { z } from 'zod';

import { http } from '@/lib/http';

export const analyticsSettingsSchema = z.object({
  userId: z.string().nullable(),
  enabled: z.boolean(),
  optedOutAt: z.string().nullable(),
});
export const loadAnalyticsSettings = () =>
  http(
    '/api/me/analytics',
    analyticsSettingsSchema,
    { signal: AbortSignal.timeout(10_000) },
  );
export const registerAnalyticsBrowser = (clientId: string) =>
  http('/api/me/analytics/browser', analyticsSettingsSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
    signal: AbortSignal.timeout(10_000),
  });
