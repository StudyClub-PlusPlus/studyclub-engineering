'use client';

import { useEffect } from 'react';

import { loadAnalyticsSettings, registerAnalyticsBrowser } from '@/features/analytics/repository';
import { getUser, USER_CHANGED_EVENT } from '@/features/auth/auth';
import { amplitude, analyticsEnabled, initAmplitude, IS_PRODUCTION } from '@/lib/amplitude';
import { captureFirstTouch, clearFirstTouch, syncAnalyticsUser } from '@/lib/analytics';
import {
  allowAnalytics,
  analyticsAllowed,
  analyticsUserId,
  hasLocalAnalyticsOptOut,
  optOutAnalyticsLocally,
  ownedGaClientId,
  subscribeAnalytics,
  suspendAnalytics,
  ANALYTICS_OPTOUT_KEY,
} from '@/lib/analytics-privacy-state';
import { connectClarity } from '@/lib/clarity';
import { ApiError } from '@/lib/http';

const pageVisible = () => document.visibilityState !== 'hidden';

const GA_ENABLED = IS_PRODUCTION && Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);

export function AnalyticsPrivacy() {
  useEffect(() => {
    const disconnectClarity = connectClarity();
    let disposed = false;
    let revision = 0;
    let running = false;
    const stop = () => {
      if (analyticsEnabled) {
        amplitude.setOptOut(true);
        void amplitude.flush();
      }
    };
    const unsubscribe = subscribeAnalytics(() => {
      if (!analyticsAllowed()) stop();
    });
    const refresh = async () => {
      if (running || disposed || !pageVisible()) return;
      const ticket = ++revision;
      const startedAt = Date.now();
      running = true;
      const user = getUser();
      const current = () => !disposed && ticket === revision && getUser()?.id === user?.id;
      try {
        if (hasLocalAnalyticsOptOut()) {
          suspendAnalytics();
          return;
        }
        const settings = user ? await loadAnalyticsSettings() : { userId: null, enabled: true, optedOutAt: null };
        if (!current()) return;
        if (settings.optedOutAt) {
          optOutAnalyticsLocally();
          return;
        }
        if (!settings.enabled || (user && !settings.userId)) {
          suspendAnalytics();
          return;
        }
        const gaClientId = GA_ENABLED ? ownedGaClientId(settings.userId) : undefined;
        if (user && gaClientId) {
          const confirmed = await registerAnalyticsBrowser(gaClientId);
          if (!current()) return;
          if (!confirmed.enabled) {
            if (confirmed.optedOutAt) optOutAnalyticsLocally();
            else suspendAnalytics();
            return;
          }
        }
        const previous = analyticsUserId();
        if (previous !== settings.userId) {
          if (previous !== null) clearFirstTouch();
          suspendAnalytics();
          if (analyticsEnabled) {
            amplitude.setOptOut(true);
            amplitude.reset();
          }
        }
        await initAmplitude(settings.userId ?? undefined);
        if (!current() || hasLocalAnalyticsOptOut() || !pageVisible() || Date.now() - startedAt >= 45_000) {
          stop();
          return;
        }
        if (analyticsEnabled) amplitude.setUserId(settings.userId ?? undefined);
        allowAnalytics(settings.userId, gaClientId, startedAt);
        if (analyticsEnabled) amplitude.setOptOut(false);
        captureFirstTouch();
        syncAnalyticsUser(user);
      } catch (error) {
        if (!current()) return;
        if (user && error instanceof ApiError && (error.status === 401 || error.status === 404))
          optOutAnalyticsLocally();
        else suspendAnalytics();
      } finally {
        if (ticket === revision) running = false;
      }
    };
    const changed = () => {
      ++revision;
      running = false;
      suspendAnalytics();
      void refresh();
    };
    const visible = () => {
      if (pageVisible()) void refresh();
      else suspendAnalytics();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === ANALYTICS_OPTOUT_KEY || event.key === 'sc_user' || event.key === null) changed();
    };
    suspendAnalytics();
    void refresh();
    const interval = setInterval(() => void refresh(), 30_000);
    window.addEventListener(USER_CHANGED_EVENT, changed);
    window.addEventListener('storage', storage);
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      disposed = true;
      ++revision;
      clearInterval(interval);
      unsubscribe();
      suspendAnalytics();
      stop();
      disconnectClarity();
      window.removeEventListener(USER_CHANGED_EVENT, changed);
      window.removeEventListener('storage', storage);
      window.removeEventListener('focus', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return null;
}
