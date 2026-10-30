import Link from 'next/link';


import { EventCard } from '@core/components/EventCard';
import { FeaturedStudies } from '@core/components/FeaturedStudies';
import { JoinCta } from '@core/components/JoinCta';
import { getStudies, getEvents, getOperatorMap, getMembers, getSite, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { ArrowRight } from 'lucide-react';

export default async function Landing({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, events, leads, members, site] = await Promise.all([
    getStudies(),
    getEvents(),
    getOperatorMap(),
    getMembers(),
    getSite(),
  ]);
  const upcoming = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const stats = [
    { k: `${site.community.member_count}+`, v: t({ ko: '커뮤니티 멤버', en: 'Members' }, locale) },
    { k: `${members.length}`, v: t({ ko: '활동 스터디원', en: 'Active members' }, locale) },
    { k: `${studies.length}`, v: t({ ko: '스터디', en: 'Studies' }, locale) },
  ];

  return (
    <div className='mx-auto max-w-6xl px-6'>
      {/* Hero */}
      <section className='relative py-16 sm:py-24'>
        <div className='hero-glow' />
        <div className='inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 type-label-sm text-[var(--color-fg-muted)] shadow-sm'>
          <span className='h-1.5 w-1.5 rounded-full' style={{ background: 'var(--color-brand)' }} />
          {m('hero.eyebrow', locale)}
        </div>
        <h1 className='mt-5 max-w-3xl whitespace-pre-line type-display-lg'>
          {m('hero.title', locale)}
        </h1>
        <p className='mt-5 max-w-2xl type-body-lg text-[var(--color-fg-muted)] type-prose'>
          {m('hero.subtitle', locale)}
        </p>
        <div className='mt-8 flex flex-wrap items-center gap-3'>
          <a
            href={site.discord_invite}
            target='_blank'
            rel='noreferrer'
            className='sc-button type-label-lg gap-2'
            data-variant='primary'
            data-size='lg'
          >
            {m('hero.cta', locale)}
            <ArrowRight size={20} aria-hidden='true' />
          </a>
          <Link
            href={`/proto/core/${locale}/studies`}
            className='sc-button type-label-lg'
            data-variant='secondary'
            data-size='lg'
          >
            {m('hero.cta_studies', locale)}
          </Link>
        </div>

        {/* Stats */}
        <div className='mt-12 flex flex-wrap gap-8'>
          {stats.map((s) => (
            <div key={s.v}>
              <div className='type-headline-md'>{s.k}</div>
              <div className='mt-0.5 type-body-sm text-[var(--color-fg-muted)]'>{s.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured studies (MSW 반응형) */}
      <FeaturedStudies locale={locale} leads={leads} />

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section className='pb-14'>
          <SectionHead
            title={m('events.title', locale)}
            subtitle={m('events.subtitle', locale)}
            href={`/proto/core/${locale}/events`}
            more={t({ ko: '전체 보기', en: 'View all' }, locale)}
          />
          <div className='card divide-y divide-[var(--color-border)] overflow-hidden p-0'>
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} locale={locale} />
            ))}
          </div>
        </section>
      )}

      <section className='pb-4'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </section>
    </div>
  );
}

function SectionHead({
  title,
  subtitle,
  href,
  more,
}: {
  title: string;
  subtitle?: string;
  href: string;
  more: string;
}) {
  return (
    <div className='mb-5 flex items-end justify-between gap-4'>
      <div>
        <h2 className='type-title-lg'>{title}</h2>
        {subtitle && <p className='mt-1 type-body-sm text-[var(--color-fg-muted)]'>{subtitle}</p>}
      </div>
      <Link href={href} className='sc-button type-label-lg' data-variant='tertiary' data-size='md'>
        {more} →
      </Link>
    </div>
  );
}
