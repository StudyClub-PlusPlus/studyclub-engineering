import Link from 'next/link';

import { MyStudiesLink } from '@/components/MyStudiesLink';
import { NavAuth } from '@/components/NavAuth';
import { NavLinks } from '@/components/NavLinks';
import type { Locale } from '@/lib/content';
import { m } from '@/lib/i18n';

export function Nav({
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

  return (
    <header className='sticky top-0 z-30 border-b border-(--color-border) bg-[color-mix(in_srgb,var(--color-bg)_82%,transparent)] backdrop-blur-md'>
      <div className='mx-auto flex h-16 max-w-6xl items-center gap-7 px-6'>
        <Link href={`/${locale}`} className='flex items-center gap-2 text-lg font-bold tracking-tight'>
          <span
            className='grid h-7 w-7 place-items-center rounded-lg text-sm font-extrabold text-white'
            style={{ background: 'var(--color-accent)' }}
          >
            S
          </span>
          StudyClub++
        </Link>

        <NavLinks
          links={links}
          mentoring={mentoringUrl ? { href: mentoringUrl, label: m('nav.mentoring', locale) } : undefined}
        />

        <div className='ml-auto flex items-center gap-3'>
          <Link
            href={`/${other}`}
            className='rounded-full px-2 py-1 text-xs font-semibold text-(--color-fg-subtle) transition-colors hover:bg-(--color-surface-subtle) hover:text-(--color-fg)'
          >
            {other.toUpperCase()}
          </Link>
          <MyStudiesLink locale={locale} />
          <a
            href={discordUrl}
            target='_blank'
            rel='noreferrer'
            className='hidden rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors sm:block'
            style={{ background: 'var(--color-accent)' }}
          >
            {m('nav.join', locale)}
          </a>
          <NavAuth locale={locale} />
        </div>
      </div>
    </header>
  );
}
