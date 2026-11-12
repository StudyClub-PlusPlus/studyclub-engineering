import Link from 'next/link';

import { getNotices, type Locale } from '@core/lib/content';
import { m, t } from '@core/lib/i18n';
import { PAGE } from '@core/lib/layout';

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
  const notices = await getNotices();
  const pageCount = Math.max(1, Math.ceil(notices.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(raw) || 1), pageCount);
  const rows = notices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = `/proto/core/${locale}/notices`;

  return (
    <div className={`${PAGE} py-14`}>
      <h1 className='type-headline-lg sm:type-headline-lg'>{m('notices.title', locale)}</h1>

      {/* 게시판 모양 — 페이지 폭을 다 쓰고 카드로 감싸지 않는다. 가운데 한 덩어리로 두면 앱 화면처럼 보인다 */}
      <div className='mt-10 border-t-2 border-(--color-fg)'>
        <div className='hidden items-center gap-6 border-b border-(--color-border) px-2 py-3 type-label-sm text-(--color-fg-muted) sm:flex'>
          <span className='flex-1'>{t({ ko: '제목', en: 'Title' }, locale)}</span>
          <span className='w-28 text-right'>{t({ ko: '게시일', en: 'Posted' }, locale)}</span>
        </div>
        {rows.length === 0 ? (
          <p className='border-b border-(--color-border) py-20 text-center type-body-sm text-(--color-fg-muted)'>
            {t({ ko: '등록된 공지가 없습니다.', en: 'No notices yet.' }, locale)}
          </p>
        ) : (
          <ul>
            {rows.map((n) => (
              <li key={n.id} className='border-b border-(--color-border)'>
                <Link
                  href={`${base}/${n.id}`}
                  className='flex flex-col gap-1 px-2 py-5 transition-colors hover:bg-(--color-surface-subtle) sm:flex-row sm:items-center sm:gap-6'
                >
                  {/* 제목은 남는 폭을 다 쓰고 한 줄로 자른다. 게시일은 고정폭·줄바꿈 없음 */}
                  <span className='min-w-0 flex-1 truncate type-title-md'>{t(n.title, locale)}</span>
                  <time className='shrink-0 whitespace-nowrap type-body-sm tabular-nums text-(--color-fg-muted) sm:w-28 sm:text-right'>
                    {n.date}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pageCount > 1 && (
        <nav aria-label={t({ ko: '페이지', en: 'Pages' }, locale)} className='mt-8 flex justify-center gap-1'>
          {Array.from({ length: pageCount }, (_, k) => k + 1).map((p) => (
            <Link
              key={p}
              href={p === 1 ? base : `${base}?page=${p}`}
              aria-current={p === page ? 'page' : undefined}
              className={`grid h-9 w-9 place-items-center rounded-full type-body-sm tabular-nums ${
                p === page ? 'bg-(--color-brand) font-semibold text-white' : 'hover:bg-(--color-surface-subtle)'
              }`}
            >
              {p}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
