import { EventBrowser } from '@core/components/EventBrowser';
import { getEvents, type Locale } from '@core/lib/content';

import { EventGuestList } from '@/proto/events/EventGuestList';

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  // 최신순 (newest-first)
  const byDateDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <EventGuestList locale={locale} />
      <details className='border-t border-border pt-6'>
        <summary className='cursor-pointer type-label-lg text-fg-muted'>지난 행사 둘러보기</summary>
        <div className='mt-6'><EventBrowser events={byDateDesc} locale={locale} /></div>
      </details>
    </div>
  );
}
