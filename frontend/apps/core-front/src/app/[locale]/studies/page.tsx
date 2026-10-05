import type { Metadata } from 'next';

import { StudyBrowser } from '@/components/StudyBrowser';
import { getOperatorMap, type Locale } from '@/lib/content';
import { m } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/studies',
    title: m('studies.title', locale),
    description: m('seo.studies_description', locale),
  });
}

export default async function StudiesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const leads = await getOperatorMap();

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <StudyBrowser locale={locale} leads={leads} />
    </div>
  );
}
