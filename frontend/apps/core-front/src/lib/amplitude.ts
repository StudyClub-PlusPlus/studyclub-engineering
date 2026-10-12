import * as amplitude from '@amplitude/analytics-browser';

const API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

let initialized = false;

export function initAmplitude() {
  if (initialized) return;
  if (!API_KEY) {
    console.warn('Amplitude API key missing — analytics disabled');
    return;
  }
  initialized = true;
  amplitude.init(API_KEY, {
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
