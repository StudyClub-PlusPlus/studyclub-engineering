import Link from 'next/link';

import { Pin } from 'lucide-react';
import type { Metadata } from 'next';

import { JoinCta } from '@/components/JoinCta';
import { Pill } from '@/components/StatusBadge';
import { getNotices, getSite, type Locale } from '@/lib/content';
import { m, t } from '@/lib/i18n';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  return pageMetadata({
    locale,
    path: '/notices',
    title: m('notices.title', locale),
    description: m('seo.notices_description', locale),
  });
}

export default async function NoticesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [notices, site] = await Promise.all([getNotices(), getSite()]);

  return (
    <div className='mx-auto max-w-6xl px-6 py-14'>
      <header className='max-w-2xl'>
        <h1 className='type-headline-lg sm:type-headline-lg'>{m('notices.title', locale)}</h1>
        <p className='mt-3 type-body-lg text-(--color-fg-muted) type-prose'>{m('notices.subtitle', locale)}</p>
      </header>

      <div className='mt-10 flex flex-col gap-4'>
        {notices.length === 0 && (
          <p className='type-body-sm text-(--color-fg-muted)'>
            {t({ ko: '아직 등록된 공지가 없어요.', en: 'No notices yet.' }, locale)}
          </p>
        )}
        {notices.map((n) => (
          <Link
            key={n.id}
            href={`/${locale}/notices/${n.id}`}
            className='card card-hover block p-6'
            style={
              n.pinned ? { borderColor: 'var(--color-brand)', background: 'var(--color-brand-subtle)' } : undefined
            }
          >
            <div className='flex flex-wrap items-center gap-2'>
              {n.pinned && <Pin size={14} aria-label='pinned' style={{ color: 'var(--color-brand)' }} />}
              {n.tag && <Pill>{m(`notice_tag.${n.tag}`, locale)}</Pill>}
              <time className='ml-auto type-label-sm text-(--color-fg-faint)'>{n.date}</time>
            </div>
            <h2 className='mt-3 type-title-md'>{t(n.title, locale)}</h2>
            <p className='mt-2 line-clamp-2 type-body-md text-(--color-fg-muted)'>{t(n.body, locale)}</p>
          </Link>
        ))}
      </div>

      <div className='mt-12'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
