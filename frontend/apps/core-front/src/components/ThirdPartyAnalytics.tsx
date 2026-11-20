'use client';

import Script from 'next/script';
import { useEffect } from 'react';

import { IS_PRODUCTION } from '@/lib/amplitude';
import {
  analyticsAllowed,
  analyticsClientId,
  analyticsUserId,
  subscribeAnalytics,
  markGoogleTagLoaded,
} from '@/lib/analytics-privacy-state';
import { useAnalyticsAllowed } from '@/lib/use-analytics-allowed';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * GA4 — production 빌드에서만, 키가 있을 때만 로드한다.
 * GA4는 허용 상태 확인 뒤 로드한다. 페이지 조회는 PageViewTracker가 한 번씩 보낸다.
 * Clarity의 로딩·중단·식별자는 lib/clarity가 분석 허용 상태에 맞춰 제어한다.
 */
let configuredOwner: string | undefined;
function configureGa() {
  if (!GA_ID || !IS_PRODUCTION || !analyticsAllowed()) return;
  const owner = `${analyticsUserId() ?? 'anonymous'}:${analyticsClientId()}`;
  if (owner === configuredOwner) return;
  const target = window as unknown as { dataLayer?: unknown[] };
  target.dataLayer ??= [];
  window.gtag ??= function () {
    // gtag가 요구하는 arguments 객체를 dataLayer에 그대로 전달한다.
    // eslint-disable-next-line prefer-rest-params
    target.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID, { user_id: analyticsUserId(), client_id: analyticsClientId(), send_page_view: false });
  configuredOwner = owner;
}
export function ThirdPartyAnalytics() {
  const allowed = useAnalyticsAllowed();
  useEffect(() => {
    const update = () => {
      if (analyticsAllowed()) configureGa();
      else configuredOwner = undefined;
    };
    update();
    return subscribeAnalytics(update);
  }, []);
  if (!IS_PRODUCTION) return null;
  return (
    <>
      {GA_ID && allowed && (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy='afterInteractive'
          onReady={() => {
            markGoogleTagLoaded();
            configureGa();
          }}
        />
      )}
    </>
  );
}
