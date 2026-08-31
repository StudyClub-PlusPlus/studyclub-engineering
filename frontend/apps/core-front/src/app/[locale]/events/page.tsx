import { EventBrowser } from '@/components/EventBrowser';
import { getEvents, type Locale } from '@/lib/content';

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
