import Link from 'next/link';

import { MobileNav } from '@/components/MobileNav';
import { MyStudiesLink } from '@/components/MyStudiesLink';
import { NavAuth } from '@/components/NavAuth';
import { NavLinks } from '@/components/NavLinks';
import type { Locale } from '@/lib/content';
import { m } from '@/lib/i18n';

export function SiteHeader({
  locale,
  discordUrl,
  mentoringUrl,
}: {
  locale: Locale;
  discordUrl: string;
  mentoringUrl?: string;
}) {
  const other: Locale = locale === 'ko' ? 'en' : 'ko';
  const links = [
    { href: `/${locale}/studies`, label: m('nav.studies', locale) },
    { href: `/${locale}/events`, label: m('nav.events', locale) },
    { href: `/${locale}/guide`, label: m('nav.guide', locale) },
    { href: `/${locale}/notices`, label: m('nav.notices', locale) },
    { href: `/${locale}/about`, label: m('nav.about', locale) },
  ];
  const mentoring = mentoringUrl ? { href: mentoringUrl, label: m('nav.mentoring', locale) } : undefined;

  return (
    <header className='sticky top-0 z-30 border-b border-(--color-border) bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6 md:gap-7'>
        <Link href={`/${locale}`} className='flex shrink-0 items-center gap-2 type-title-md'>
          <span
            className='grid h-7 w-7 place-items-center rounded-lg type-label-lg text-white'
            style={{ background: 'var(--color-brand)' }}
          >
            S
          </span>
          StudyClub++
        </Link>

        <NavLinks links={links} mentoring={mentoring} />

        <div className='ml-auto flex items-center gap-2 sm:gap-3'>
          <Link
            href={`/${other}`}
            className='rounded-full px-2 py-1 type-label-sm text-(--color-fg-muted) transition-colors hover:bg-(--color-surface-subtle) hover:text-(--color-fg)'
          >
            {other.toUpperCase()}
          </Link>
          <a
            href={discordUrl}
            target='_blank'
            rel='noreferrer'
            className='hidden rounded-full px-4 py-2 type-label-lg text-white shadow-sm transition-colors sm:block'
            style={{ background: 'var(--color-brand)' }}
          >
            {m('nav.join', locale)}
          </a>
          <MyStudiesLink locale={locale} />
          <NavAuth locale={locale} />
          <MobileNav
            locale={locale}
            links={links}
            mentoring={mentoring}
            join={{ href: discordUrl, label: m('nav.join', locale) }}
          />
        </div>
      </div>
    </header>
  );
}
