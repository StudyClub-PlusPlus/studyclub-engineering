import * as amplitude from '@amplitude/analytics-browser';

import { analyticsAllowed, analyticsUserId } from './analytics-privacy-state';

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

/** 키가 없으면 SDK 를 아예 부르지 않는다 — init 전 호출은 SDK 큐에 쌓이기만 하고 비워지지 않는다. */
export const analyticsEnabled = Boolean(API_KEY);

/** 빌드 인자로 박힌다 (`production`·`stage`). GA4·Clarity 는 production 에서만 로드한다. */
export const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
export const IS_PRODUCTION = APP_ENV === 'production';

/** 모든 이벤트에 붙는 공통 속성 — 서비스 공통 트래킹 규약 §3 */
export const COMMON_PROPS = { service: 'studyclub', env: APP_ENV, event_version: '1.0.0' } as const;

let initialization: Promise<void> | undefined;

export function initAmplitude(userId?: string): Promise<void> {
  if (initialization) return initialization;
  if (!API_KEY) return Promise.resolve();
  // 수집 중단 시 이미 큐에 들어간 이벤트와 다른 계정의 지연 이벤트도 마지막 전송 지점에서 버린다.
  const guard = amplitude.add({
    name: 'privacy-transport',
    type: 'before',
    setup: async (config) => {
      const original = config.transportProvider;
      config.transportProvider = {
        send: (...args) => {
          const owner = analyticsUserId();
          if (!analyticsAllowed() || args[1].events.some((event) => (event.user_id ?? null) !== owner))
            return Promise.resolve(null);
          return original.send(...args);
        },
      };
    },
    execute: async (event) => (analyticsAllowed() ? event : null),
  });
  const initialized = amplitude.init(API_KEY, userId, {
    optOut: true,
    // 이벤트 큐를 디스크에 남기지 않는다. 재접속 때 중단 전 이벤트가 다시 전송되는 것을 막는다.
    storageProvider: {
      isEnabled: async () => true,
      get: async () => undefined,
      getRaw: async () => undefined,
      set: async () => {},
      remove: async () => {},
      reset: async () => {},
    },
    // 행동 분석에 IP 는 필요 없다 — 수집 항목을 줄인다 (개인정보 처리방침 제2조·제8조)
    trackingOptions: { ipAddress: false },
    autocapture: {
      pageViews: false,
      elementInteractions: false,
      formInteractions: false,
      fileDownloads: false,
      sessions: true,
      webVitals: false,
    },
  });
  const enrichment = amplitude.add({
    name: 'common-enrichment',
    type: 'enrichment',
    execute: async (event) => {
      const locale = window.location.pathname.startsWith('/en') ? 'en' : 'ko';
      event.event_properties = { ...COMMON_PROPS, platform: 'web', locale, ...event.event_properties };
      return event;
    },
  });
  initialization = Promise.all([initialized.promise, guard.promise, enrichment.promise]).then(() => {});
  return initialization;
}

export { amplitude };
