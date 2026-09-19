import { notFound } from 'next/navigation';
import { Suspense } from 'react';

import { Footer } from '@core/components/Footer';
import { Nav } from '@core/components/Nav';
import { RegistrationNavigation } from '@core/components/RegistrationNavigation';
import { getSite } from '@core/lib/content';
import { LOCALES, isLocale } from '@core/lib/i18n';

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
          <Nav locale={locale} discordUrl={site.discord_invite} mentoringUrl={site.mentoring_url} />
        </RegistrationNavigation>
      </Suspense>
      <main className='flex-1'>{children}</main>
      <Footer locale={locale} />
    </div>
  );
}
