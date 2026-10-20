import * as amplitude from '@amplitude/analytics-browser';

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

/** 키가 없으면 SDK 를 아예 부르지 않는다 — init 전 호출은 SDK 큐에 쌓이기만 하고 비워지지 않는다. */
export const analyticsEnabled = Boolean(API_KEY);

let initialized = false;

export function initAmplitude() {
  if (initialized) return;
  if (!API_KEY) {
    console.warn('Amplitude API key missing: analytics disabled');
    return;
  }
  initialized = true;
  amplitude.init(API_KEY, {
    // user_id 는 회원 번호(숫자)라 짧다 — 기본값(5자 미만 거부)이면 로그인 사용자가 전부 익명으로 남는다
    minIdLength: 1,
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
  amplitude.add({
    name: 'common-enrichment',
    type: 'enrichment',
    execute: async (event) => {
      const locale = window.location.pathname.startsWith('/en') ? 'en' : 'ko';
      event.event_properties = { platform: 'web', locale, ...event.event_properties };
      return event;
    },
  });
}

export { amplitude };
