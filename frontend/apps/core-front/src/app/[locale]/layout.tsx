import { notFound } from 'next/navigation';

import { Toaster } from '@studyclub/ui';

import { Footer } from '@/components/Footer';
import { LangSync } from '@/components/LangSync';
import { Nav } from '@/components/Nav';
import { getSite } from '@/lib/content';
import { LOCALES, isLocale } from '@/lib/i18n';

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
      <LangSync locale={locale} />
      <Nav locale={locale} discordUrl={site.discord_invite} mentoringUrl={site.mentoring_url} />
      <main className='flex-1'>{children}</main>
      <Footer locale={locale} site={site} />
      <Toaster position='bottom-center' />
    </div>
  );
}
