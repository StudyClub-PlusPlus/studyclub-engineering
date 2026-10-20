import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Footer } from '@core/components/Footer';
import { RegistrationNavigation } from '@core/components/RegistrationNavigation';
import { SiteHeader } from '@core/components/SiteHeader';
import { getSite } from '@core/lib/content';
import { LOCALES, isLocale } from '@core/lib/i18n';
import { Toaster } from '@studyclub/ui';

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
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
    <div className='flex min-h-screen flex-col'>
      <Suspense fallback={<div className='h-16 border-b border-border' />}>
        <RegistrationNavigation locale={locale}>
          <SiteHeader locale={locale} discordUrl={site.discord_invite} mentoringUrl={site.mentoring_url} />
        </RegistrationNavigation>
      </Suspense>
      <main className='flex-1'>{children}</main>
      <Footer locale={locale} />
      {/* 문의 전송 뒤 내 문의로 돌아와 감사 알림을 띄운다 */}
      <Toaster position='bottom-right' />
    </div>
  );
}
