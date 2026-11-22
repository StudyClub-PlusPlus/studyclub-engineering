import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { Locale } from '@studyclub/types';
import { ArrowLeft, CalendarDays, MapPin, Tag, ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';

import { EVENT_DETAILS, EVENT_KINDS, EVENT_VOICES } from '@/features/events/content';
import { EventDetailView } from '@/features/events/EventDetailView';
import { fetchEventDetailServer, getEvent } from '@/features/events/server';
import { FEATURES } from '@/lib/features';
import { m, t } from '@/lib/i18n';
import { JsonLd, breadcrumbJsonLd, eventJsonLd } from '@/lib/jsonld';
import { PAGE, DETAIL_GRID, DETAIL_ASIDE } from '@/lib/layout';
import { SITE_URL, pageMetadata } from '@/lib/seo';

function fullDate(iso: string, locale: Locale) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const loc = locale === 'ko' ? 'ko-KR' : 'en-US';
  return d.toLocaleDateString(loc, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: iso.includes('T') ? '2-digit' : undefined,
    minute: iso.includes('T') ? '2-digit' : undefined,
  });
}

export async function generateStaticParams() {
  if (!FEATURES.EVENTS) return [];
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  if (/^\d+$/.test(id)) {
    const detail = await fetchEventDetailServer(Number(id));
    if (!detail) return {};
    return pageMetadata({
      locale,
      path: `/events/${id}`,
      title: detail.title,
      description: detail.summary.slice(0, 155),
    });
  }
  const event = await getEvent(id);
  if (!event) return {};
  return pageMetadata({
    locale,
    path: `/events/${id}`,
    title: t(event.title, locale),
    description: t(event.summary, locale).slice(0, 155),
    image: event.image,
    ogType: 'article',
  });
}

async function ArchiveEventDetail({ locale, id }: { locale: Locale; id: string }) {
  const event = await getEvent(id);
  if (!event) notFound();
  const detail = EVENT_DETAILS[id];

  const facts = [
    {
      icon: CalendarDays,
      label: m('common.when', locale),
      value:
        event.datePrecision === 'year'
          ? t({ ko: `${event.date.slice(0, 4)}년`, en: event.date.slice(0, 4) }, locale)
          : fullDate(event.date, locale),
    },
    { icon: Tag, label: m('common.type', locale), value: m(`event_type.${event.type}`, locale) },
    event.location && { icon: MapPin, label: m('common.where', locale), value: t(event.location, locale) },
  ].filter(Boolean) as { icon: typeof Tag; label: string; value: string }[];

  const url = `${SITE_URL}/${locale}/events/${id}`;

  return (
    <div className={`${PAGE} py-12`}>
      <JsonLd
        data={[
          eventJsonLd(event, locale, url),
          breadcrumbJsonLd([
            { name: m('nav.home', locale), path: `/${locale}` },
            { name: m('events.title', locale), path: `/${locale}/events` },
            { name: t(event.title, locale), path: `/${locale}/events/${id}` },
          ]),
        ]}
      />
      <Link
        href={`/${locale}/events`}
        className='inline-flex items-center gap-1.5 type-label-lg text-fg-muted hover:text-fg'
      >
        <ArrowLeft size={15} /> {m('common.back_events', locale)}
      </Link>
      <div className={`mt-4 ${DETAIL_GRID}`}>
        <div className='min-w-0'>
          <article className='card overflow-hidden p-0'>
            <header
              className='flex flex-col gap-3 px-6 pb-7 pt-6 sm:px-8'
              style={{
                background:
                  'linear-gradient(135deg, var(--color-brand-subtle), color-mix(in oklab, var(--color-brand) 16%, white))',
              }}
            >
              <span className='inline-flex w-fit items-center rounded-full bg-white/85 px-2.5 py-1 type-label-sm shadow-sm text-brand'>
                {m(`event_type.${event.type}`, locale)}
              </span>
              <h1 className='type-headline-lg'>{t(event.title, locale)}</h1>
              <p className='type-body-md text-fg-muted'>{t(event.summary, locale)}</p>
            </header>
          </article>
          {detail && (
            <section className='mt-10'>
              <h2 className='type-title-md'>{t({ ko: '어떤 행사였나요', en: 'About this event' }, locale)}</h2>
              <div className='mt-3 flex max-w-2xl flex-col gap-3 type-body-md text-fg'>
                {detail.about.map((p, i) => (
                  <p key={i}>{t(p, locale)}</p>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className={`card overflow-hidden p-0 ${DETAIL_ASIDE}`}>
          <dl className='flex flex-col divide-y divide-border'>
            {facts.map((f) => (
              <div key={f.label} className='flex items-center gap-3 px-6 py-4'>
                <f.icon size={18} className='shrink-0 text-brand' />
                <div className='min-w-0'>
                  <dt className='type-label-sm text-fg-muted'>{f.label}</dt>
                  <dd className='font-semibold'>{f.value}</dd>
                </div>
              </div>
            ))}
          </dl>
          {event.link && (
            <a
              href={event.link}
              target='_blank'
              rel='noreferrer'
              className='m-6 mt-2 inline-flex w-[calc(100%-3rem)] items-center justify-center gap-2 rounded-full px-6 py-3 type-label-lg text-white shadow-sm'
              style={{ background: 'var(--color-brand)' }}
            >
              {m('common.rsvp', locale)} <ArrowUpRight size={17} />
            </a>
          )}
        </aside>
      </div>
    </div>
  );
}

export default async function EventDetailPage({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  if (!FEATURES.EVENTS) notFound();
  const { locale, id } = await params;

  if (/^\d+$/.test(id)) {
    const eventId = Number(id);
    const initial = await fetchEventDetailServer(eventId);
    if (!initial) notFound();
    return <EventDetailView eventId={eventId} locale={locale} initial={initial} />;
  }

  return <ArchiveEventDetail locale={locale} id={id} />;
}