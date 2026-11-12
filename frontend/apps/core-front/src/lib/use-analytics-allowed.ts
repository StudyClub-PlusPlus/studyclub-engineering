'use client';

import { useSyncExternalStore } from 'react';

import { analyticsAllowed, subscribeAnalytics } from './analytics-privacy-state';

export function useAnalyticsAllowed(): boolean {
  return useSyncExternalStore(subscribeAnalytics, analyticsAllowed, () => false);
}
