import Link from 'next/link';

import { JoinCta } from '@core/components/JoinCta';
import { getNotices, getSite, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';

export default async function NoticesPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const [notices, site] = await Promise.all([getNotices(), getSite()]);

  return (
    <div className='mx-auto max-w-6xl px-6 py-14'>
      <header className='max-w-2xl'>
        <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{m('notices.title', locale)}</h1>
        <p className='mt-3 text-lg text-(--color-fg-muted)'>{m('notices.subtitle', locale)}</p>
      </header>

      <div className='mt-10 flex flex-col gap-4'>
        {notices.map((n) => (
          <Link
            key={n.id}
            href={`/proto/core/${locale}/notices/${n.id}`}
            className='card card-hover block p-6'
          >
            <div className='flex flex-wrap items-center gap-2'>
              {/* 공지에는 분류·상단 고정이 없다 — 날짜 순으로만 선다 */}
              <time className='ml-auto text-xs font-medium text-(--color-fg-faint)'>{n.date}</time>
            </div>
            <h2 className='mt-3 text-lg font-bold tracking-tight'>{t(n.title, locale)}</h2>
            <p className='mt-2 line-clamp-2 text-[15px] leading-relaxed text-(--color-fg-muted)'>{t(n.body, locale)}</p>
          </Link>
        ))}
      </div>

      <div className='mt-12'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
