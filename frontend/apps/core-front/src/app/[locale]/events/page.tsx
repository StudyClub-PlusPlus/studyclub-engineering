import type { Metadata } from 'next';

import { EventBrowser } from '@/components/EventBrowser';
import { getEvents, type Locale } from '@/lib/content';
import { m } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/events',
    title: m('events.title', locale),
    description: m('seo.events_description', locale),
  });
}

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  // 최신순 (newest-first)
  const byDateDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <EventBrowser events={byDateDesc} locale={locale} />
    </div>
  );
}
