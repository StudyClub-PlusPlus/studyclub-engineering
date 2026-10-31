import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Toaster } from '@studyclub/ui';
import type { Metadata } from 'next';

import '@/app/globals.css';
import { Providers } from '@/app/providers';
import { Footer } from '@/components/Footer';
import { RegistrationNavigation } from '@/components/RegistrationNavigation';
import { SiteHeader } from '@/components/SiteHeader';
import { getSite } from '@/features/community/server';
import { LOCALES, isLocale, m } from '@/lib/i18n';
import { JsonLd, organizationJsonLd, webSiteJsonLd } from '@/lib/jsonld';
import { IS_INDEXABLE, SITE_NAME, SITE_URL, alternatesFor } from '@/lib/seo';

/**
 * **이 파일이 루트 레이아웃이다** (`app/layout.tsx` 는 없다).
 *
 * `<html lang>` 을 실제 로케일로 내려면 로케일을 아는 레이아웃이 `<html>` 을 소유해야 한다.
 * 상위에 `app/layout.tsx` 를 두면 거기서는 params 를 못 읽어 `lang` 이 상수로 굳는다
 * (예전엔 그래서 `lang='ko'` 고정 + 클라이언트에서 교체하는 LangSync 를 썼는데,
 * 크롤러는 초기 HTML 만 보므로 아무 효과가 없었다).
 *
 * 로케일 없는 경로(`/`, `/studies`)는 `src/middleware.ts` 가 기본 로케일로 리다이렉트한다.
 */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    verification: { other: { 'naver-site-verification': '704d84f239ac8c0255ff0d16fff86b95ce6138c9' } },
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
    description: m('seo.site_description', locale),
    applicationName: SITE_NAME,
    keywords: m('seo.keywords', locale)
      .split(',')
      .map((k) => k.trim()),
    alternates: alternatesFor(locale),
    // stage·프리뷰 빌드는 통째로 색인 금지 (lib/seo.ts IS_INDEXABLE 주석 참고)
    ...(IS_INDEXABLE ? {} : { robots: { index: false, follow: false } }),
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      locale: locale === 'ko' ? 'ko_KR' : 'en_US',
      url: `${SITE_URL}/${locale}`,
      title: SITE_NAME,
      description: m('seo.site_description', locale),
    },
    twitter: { card: 'summary_large_image', title: SITE_NAME, description: m('seo.site_description', locale) },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const site = await getSite();

  return (
    <html lang={locale} className='h-full' suppressHydrationWarning>
      <head>
        {/* Pretendard — 버전 고정(@latest 는 어느 날 바뀐다). dynamic-subset 은 화면에 쓰인 글자 묶음만 받아 첫 로딩이 가볍다 */}
        <link rel='preconnect' href='https://cdn.jsdelivr.net' crossOrigin='anonymous' />
        <link
          rel='stylesheet'
          crossOrigin='anonymous'
          href='https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'
        />
      </head>
      <body className='min-h-full'>
        <JsonLd data={[organizationJsonLd(locale, site), webSiteJsonLd(locale)]} />
        <Providers>
          <div className='flex min-h-screen flex-col'>
            <Suspense fallback={<div className='h-16 border-b border-border' />}>
              <RegistrationNavigation locale={locale}>
                <SiteHeader locale={locale} discordUrl={site.discord_invite} mentoringUrl={site.mentoring_url} />
              </RegistrationNavigation>
            </Suspense>
            {/* 장식(히어로 글로우 등)이 화면 밖으로 번져 가로 스크롤을 만들지 않게 자른다. clip 은 sticky 를 깨지 않는다 */}
            <main className='flex-1 overflow-x-clip'>{children}</main>
            <Footer locale={locale} site={site} />
            <Toaster position='bottom-center' />
          </div>
        </Providers>
      </body>
    </html>
  );
}
