import { getEvents, type Locale } from '@core/lib/content';
import { EVENT_DETAILS, EVENT_KINDS, EVENT_VOICES } from '@core/lib/event-details';
import { t } from '@core/lib/i18n';

import { EventGuestList } from '@/proto/events/EventGuestList';

export default async function EventsPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const events = await getEvents();

  // 최신순 (newest-first)
  const byDateDesc = [...events].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date().toISOString().slice(0, 10);
  const pastEvents = byDateDesc.filter((event) => event.date < today);

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <EventGuestList
        locale={locale}
        archiveEvents={pastEvents}
        archiveDetailIds={Object.keys(EVENT_DETAILS)}
      />
      <section className='rounded-2xl bg-brand-subtle p-6 sm:p-8'>
        <h2 className='type-title-md'>
          {t({ ko: '스터디클럽 행사는 이렇게 열려요', en: 'How StudyClub events work' }, locale)}
        </h2>
        <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
          {EVENT_KINDS.map((kind) => (
            <li key={kind.title.ko} className='rounded-xl bg-bg p-4 type-body-sm'>
              <span className='font-semibold'>{t(kind.title, locale)}</span>
              <span className='text-fg-muted'> {t(kind.body, locale)}</span>
            </li>
          ))}
        </ul>
        <div className='mt-6 grid gap-3 md:grid-cols-3'>
          {EVENT_VOICES.map((voice) => (
            <blockquote key={voice.from.ko} className='rounded-xl bg-bg p-4 type-body-sm text-fg'>
              “{t(voice.quote, locale)}”
              <footer className='mt-2 type-label-sm text-fg-muted'>{t(voice.from, locale)}</footer>
            </blockquote>
          ))}
        </div>
      </section>
    </div>
  );
}
