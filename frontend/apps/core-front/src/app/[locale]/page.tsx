import Link from 'next/link';

import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';

import { EventCard } from '@/components/EventCard';
import { FeaturedStudies } from '@/components/FeaturedStudies';
import { HeroCTADiscordLink, HeroCTAStudiesLink } from '@/components/HeroCTAButton';
import { JoinCta } from '@/components/JoinCta';
import { Marquee } from '@/components/Marquee';
import { PAST_STUDIES, VOICES } from '@/lib/community-voices';
import { getStudies, getEvents, getOperatorMap, getSite, type Locale } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '',
    title: m('seo.home_title', locale),
    description: m('seo.site_description', locale),
    titleAbsolute: true,
  });
}

export default async function Landing({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [studies, events, leads, site] = await Promise.all([getStudies(), getEvents(), getOperatorMap(), getSite()]);
  const upcoming = [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const stats = [
    { k: `${site.community.member_count.toLocaleString()}+`, v: t({ ko: '커뮤니티 멤버', en: 'Members' }, locale) },
    { k: `${studies.length}`, v: t({ ko: '스터디', en: 'Studies' }, locale) },
    { k: '2024', v: t({ ko: '실리콘밸리에서 시작', en: 'Started in Silicon Valley' }, locale) },
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
          <HeroCTADiscordLink
            href={site.discord_invite}
            target='_blank'
            rel='noreferrer'
            className='group inline-flex items-center gap-2 rounded-full px-6 py-3 type-label-lg text-white shadow-sm transition-transform hover:scale-[1.02]'
            style={{ background: 'var(--color-brand)' }}
          >
            {m('hero.cta', locale)}
            <ArrowRight size={17} className='transition-transform group-hover:translate-x-0.5' />
          </HeroCTADiscordLink>
          <HeroCTAStudiesLink
            href={`/${locale}/studies`}
            className='rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-3 type-label-lg shadow-sm transition-colors hover:border-[var(--color-border-interactive)] hover:bg-[var(--color-surface-2)]'
          >
            {m('hero.cta_studies', locale)}
          </HeroCTAStudiesLink>
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

      {/* 지금까지 열린 스터디 — 흐르는 띠 */}
      <section className='-mx-6 pb-14'>
        <p className='mb-4 px-6 type-label-lg text-[var(--color-fg-muted)]'>
          {t({ ko: '지금까지 함께 공부한 주제들', en: "Topics we've studied together" }, locale)}
        </p>
        <Marquee label={t({ ko: '지난 스터디 목록', en: 'Past studies' }, locale)} seconds={60}>
          {PAST_STUDIES.map((name) => (
            <span
              key={name}
              className='whitespace-nowrap rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 type-label-lg text-[var(--color-fg)]'
            >
              {name}
            </span>
          ))}
        </Marquee>
      </section>

      {/* Featured studies (MSW / API 반응형) */}
      <FeaturedStudies locale={locale} leads={leads} />

      {/* 함께한 사람들의 이야기 — 실제 후기(이름 대신 직군·도시) */}
      <section className='-mx-6 pb-14'>
        <div className='px-6'>
          <SectionHead
            title={t({ ko: '함께한 사람들의 이야기', en: 'What members say' }, locale)}
            subtitle={t(
              { ko: '미국·캐나다·한국에서 같이 공부한 크루들이 남긴 후기예요.', en: 'Reviews from crew across the US, Canada, and Korea.' },
              locale,
            )}
          />
        </div>
        <Marquee label={t({ ko: '회원 후기', en: 'Member reviews' }, locale)} seconds={80}>
          {VOICES.map((v, i) => (
            <figure key={i} className='card flex w-80 shrink-0 flex-col justify-between gap-4 p-5'>
              <blockquote className='type-body-md text-[var(--color-fg)]'>“{t(v.quote, locale)}”</blockquote>
              <figcaption className='type-label-sm text-[var(--color-fg-muted)]'>
                {v.who ? `${t(v.who, locale)} · ` : ''}
                {t(v.from, locale)}
              </figcaption>
            </figure>
          ))}
        </Marquee>
      </section>

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <section className='pb-14'>
          <SectionHead
            title={m('events.title', locale)}
            subtitle={m('events.subtitle', locale)}
            href={`/${locale}/events`}
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
  href?: string;
  more?: string;
}) {
  return (
    <div className='mb-5 flex items-end justify-between gap-4'>
      <div>
        <h2 className='type-title-lg'>{title}</h2>
        {subtitle && <p className='mt-1 type-body-sm text-[var(--color-fg-muted)]'>{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className='shrink-0 type-label-lg text-[var(--color-brand)] hover:underline'>
          {more} →
        </Link>
      )}
    </div>
  );
}
