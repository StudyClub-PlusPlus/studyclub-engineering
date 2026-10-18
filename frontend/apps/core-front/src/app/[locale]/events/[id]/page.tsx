import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft, CalendarDays, MapPin, Tag, ArrowUpRight } from 'lucide-react';
import type { Metadata } from 'next';

import { getEvent, getEvents, type Locale } from '@/lib/content';
import { EVENT_DETAILS, EVENT_KINDS, EVENT_VOICES } from '@/lib/event-details';
import { m, t } from '@/lib/i18n';
import { JsonLd, breadcrumbJsonLd, eventJsonLd } from '@/lib/jsonld';
import { PAGE, DETAIL_GRID, DETAIL_ASIDE } from '@/lib/layout';
import { SITE_URL, pageMetadata } from '@/lib/seo';

export async function generateStaticParams() {
  const events = await getEvents();
  return events.map((e) => ({ id: e.id }));
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
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

export default async function EventDetail({ params }: { params: Promise<{ locale: Locale; id: string }> }) {
  const { locale, id } = await params;
  const event = await getEvent(id);
  if (!event) notFound();
  const detail = EVENT_DETAILS[id];

  const facts = [
    {
      icon: CalendarDays,
      label: m('common.when', locale),
      // 연도만 아는 행사는 월·일을 지어내지 않는다
      value: event.datePrecision === 'year' ? t({ ko: `${event.date.slice(0, 4)}년`, en: event.date.slice(0, 4) }, locale) : fullDate(event.date, locale),
    },
    { icon: Tag, label: m('common.type', locale), value: m(`event_type.${event.type}`, locale) },
    event.location && {
      icon: MapPin,
      label: m('common.where', locale),
      value: t(event.location, locale),
    },
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
        className='inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
      >
        <ArrowLeft size={15} /> {m('common.back_events', locale)}
      </Link>

      {/* 머리 — 스터디 상세와 같은 틀: 옅은 바탕 + 배지 + 제목 + 한 줄, 아래 정보 칸 */}
      <div className={`mt-4 ${DETAIL_GRID}`}>
        <div className='min-w-0'>
      <article className='card overflow-hidden p-0'>
        <header
          className='flex flex-col gap-3 px-6 pb-7 pt-6 sm:px-8'
          style={{ background: 'linear-gradient(135deg, var(--color-brand-subtle), color-mix(in oklab, var(--color-brand) 16%, white))' }}
        >
          <span className='inline-flex w-fit items-center rounded-full bg-white/85 px-2.5 py-1 text-xs font-semibold shadow-sm' style={{ color: 'var(--color-brand)' }}>
            {m(`event_type.${event.type}`, locale)}
          </span>
          <h1 className='text-[26px] font-bold leading-[1.25] tracking-tight sm:text-[30px]'>{t(event.title, locale)}</h1>
          <p className='text-[16px] leading-relaxed text-[var(--color-fg-muted)]'>{t(event.summary, locale)}</p>
        </header>
      </article>
      {detail && (
        <section className='mt-10'>
          <h2 className='text-lg font-bold tracking-tight'>{t({ ko: '어떤 행사였나요', en: 'About this event' }, locale)}</h2>
          <div className='mt-3 flex max-w-2xl flex-col gap-3 text-[16px] leading-relaxed text-[var(--color-fg)]'>
            {detail.about.map((p, i) => (
              <p key={i}>{t(p, locale)}</p>
            ))}
          </div>
          {detail.voices && (
            <div className='mt-6 grid gap-3 sm:grid-cols-2'>
              {detail.voices.map((v, i) => (
                <blockquote key={i} className='card p-5 text-[15px] leading-relaxed text-[var(--color-fg)]'>
                  “{t(v, locale)}”
                  <footer className='mt-2 text-xs text-[var(--color-fg-muted)]'>{t({ ko: '참가자 후기', en: 'Attendee' }, locale)}</footer>
                </blockquote>
              ))}
            </div>
          )}
        </section>
      )}

        </div>
        <aside className={`card overflow-hidden p-0 ${DETAIL_ASIDE}`}>
        <dl className='flex flex-col divide-y divide-[var(--color-border)]'>
          {facts.map((f) => (
            <div key={f.label} className='flex items-center gap-3 px-6 py-4'>
              <f.icon size={18} className='shrink-0' style={{ color: 'var(--color-brand)' }} />
              <div className='min-w-0'>
                <dt className='text-xs text-[var(--color-fg-muted)]'>{f.label}</dt>
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
          className='m-6 mt-2 inline-flex justify-center items-center gap-2 rounded-full px-6 py-3 text-base font-semibold text-white shadow-sm transition-transform hover:scale-[1.02]'
          style={{ background: 'var(--color-brand)' }}
        >
          {m('common.rsvp', locale)} <ArrowUpRight size={17} />
        </a>
      )}
        </aside>
      </div>

      {/* 공통 — 스터디클럽 행사는 이런 것들 */}
      <section className='mt-12 rounded-2xl p-6 sm:p-8' style={{ background: 'var(--color-brand-subtle)' }}>
        <h2 className='text-lg font-bold tracking-tight'>{t({ ko: '스터디클럽 행사는 이렇게 열려요', en: 'How StudyClub events work' }, locale)}</h2>
        <ul className='mt-4 grid gap-3 sm:grid-cols-2'>
          {EVENT_KINDS.map((k) => (
            <li key={k.title.ko} className='rounded-xl bg-[var(--color-bg)] p-4 text-[15px] leading-relaxed'>
              <span className='font-semibold'>{t(k.title, locale)}</span>
              <span className='text-[var(--color-fg-muted)]'> {t(k.body, locale)}</span>
            </li>
          ))}
        </ul>
        <div className='mt-6 grid gap-3 md:grid-cols-3'>
          {EVENT_VOICES.map((v, i) => (
            <blockquote key={i} className='rounded-xl bg-[var(--color-bg)] p-4 text-sm leading-relaxed text-[var(--color-fg)]'>
              “{t(v.quote, locale)}”
              <footer className='mt-2 text-xs text-[var(--color-fg-muted)]'>{t(v.from, locale)}</footer>
            </blockquote>
          ))}
        </div>
      </section>

    </div>
  );
}
