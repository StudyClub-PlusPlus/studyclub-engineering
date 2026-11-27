import { notFound } from 'next/navigation';

import type { Locale } from '@studyclub/types';
import type { Metadata } from 'next';

import { FollowStrip } from '@/components/SocialLinks';
import { EVENT_DETAILS, EVENT_KINDS, EVENT_VOICES } from '@/features/events/content';
import { EventListView } from '@/features/events/EventListView';
import { fetchEventListServer, getArchiveEvents } from '@/features/events/server';
import { FEATURES } from '@/lib/features';
import { m, t } from '@/lib/i18n';
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

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  if (!FEATURES.EVENTS) notFound();
  const { locale } = await params;
  const initial = await fetchEventListServer();
  const archiveEvents = getArchiveEvents();
  const today = new Date().toISOString().slice(0, 10);
  const pastArchive = archiveEvents.filter((event) => event.date < today);
  const archiveDetailIds = Object.keys(EVENT_DETAILS);

  return (
    <div className='mx-auto max-w-6xl px-6 pb-14 pt-6'>
      <EventListView
        locale={locale}
        initial={initial}
        archiveEvents={pastArchive}
        archiveDetailIds={archiveDetailIds}
      />
      <section className='mt-12 rounded-2xl bg-brand-subtle p-6 sm:p-8'>
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
      <FollowStrip locale={locale} />
    </div>
  );
}