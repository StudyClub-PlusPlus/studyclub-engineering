'use client';

import Script from 'next/script';

import { IS_PRODUCTION } from '@/lib/amplitude';

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

/**
 * GA4 · Microsoft Clarity — production 빌드에서만, 키가 있을 때만 로드한다.
 * GA4 의 SPA 라우트 이동 page_view 는 향상된 측정(브라우저 기록 이벤트 기반 페이지 변경)이 잡는다.
 * Clarity identify·태그는 lib/analytics 의 syncAnalyticsUser 가 붙인다.
 */
export function ThirdPartyAnalytics() {
  if (!IS_PRODUCTION) return null;
  return (
    <>
      {GA_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy='afterInteractive' />
          <Script id='ga4-init' strategy='afterInteractive'>
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
          </Script>
        </>
      )}
      {CLARITY_ID && (
        <Script id='clarity-init' strategy='afterInteractive'>
          {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
        </Script>
      )}
    </>
  );
}
