import Link from 'next/link';

import { JoinCta } from '@core/components/JoinCta';
import { getNotices, getSite, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';

/** 한 페이지에 보이는 공지 수 */
const PAGE_SIZE = 10;

/**
 * 공지 목록 — 제목 · 게시일. 게시일 내림차순 고정, 10건씩.
 * 작성자·분류·고정 표시는 없다. 줄을 누르면 상세로 간다. 로그인 없이 볼 수 있다.
 * TODO(api): GET /api/notices — 삭제된 건은 서버가 뺀다
 */
export default async function NoticesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: raw } = await searchParams;
  const [notices, site] = await Promise.all([getNotices(), getSite()]);
  const pageCount = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(raw) || 1), pageCount);
  const rows = notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = `/proto/core/${locale}/notices`;

  return (
    <div className='mx-auto max-w-3xl px-6 py-14'>
      <header>
        <h1 className='text-3xl font-extrabold tracking-tight sm:text-4xl'>{m('notices.title', locale)}</h1>
        <p className='mt-3 text-lg text-(--color-fg-muted)'>{m('notices.subtitle', locale)}</p>
      </header>

      {rows.length === 0 ? (
        <p className='card mt-10 px-6 py-16 text-center text-sm text-(--color-fg-muted)'>
          {t({ ko: '등록된 공지가 없습니다.', en: 'No notices yet.' }, locale)}
        </p>
      ) : (
        <ul className='card mt-10 divide-y divide-(--color-border) overflow-hidden p-0'>
          {rows.map((n) => (
            <li key={n.id}>
              <Link
                href={`${base}/${n.id}`}
                className='flex items-center gap-4 px-6 py-4 transition-colors hover:bg-(--color-surface-subtle)'
              >
                {/* 제목은 남는 폭을 다 쓰고 한 줄로 자른다. 게시일은 고정폭·줄바꿈 없음 */}
                <span className='min-w-0 flex-1 truncate text-[15px] font-semibold'>{t(n.title, locale)}</span>
                <time className='w-24 shrink-0 whitespace-nowrap text-right text-sm tabular-nums text-(--color-fg-muted)'>
                  {n.date}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <nav aria-label={t({ ko: '페이지', en: 'Pages' }, locale)} className='mt-6 flex justify-center gap-1'>
          {Array.from({ length: pageCount }, (_, k) => k + 1).map((p) => (
            <Link
              key={p}
              href={p === 1 ? base : `${base}?page=${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={`grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums ${
                p === page ? 'bg-(--color-brand) font-semibold text-white' : 'hover:bg-(--color-surface-subtle)'
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}

      <div className='mt-12'>
        <JoinCta locale={locale} discordUrl={site.discord_invite} />
      </div>
    </div>
  );
}
